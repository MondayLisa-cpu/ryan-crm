// 日期工具：全部用香港時間、星期一開始；日期一律用 "YYYY-MM-DD" 字串

const DAY = 86_400_000;

const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && fmt(parse(v)) === v;

/** 香港今日 */
export const hkToday = (now = Date.now()) => fmt(now + 8 * 3600_000);

export const addDays = (d: string, n: number) => fmt(parse(d) + n * DAY);

/** 0 = 星期一 … 6 = 星期日 */
export const weekdayIndex = (d: string) => (new Date(parse(d)).getUTCDay() + 6) % 7;

export const mondayOf = (d: string) => addDays(d, -weekdayIndex(d));

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const WEEKDAY_LABELS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

/** ISO 週：{ year, week }（第 1 週 = 包含 1 月 4 日嗰週） */
export function isoWeek(d: string): { year: number; week: number } {
  const thursday = addDays(mondayOf(d), 3);
  const year = +thursday.slice(0, 4);
  const week1Monday = mondayOf(`${year}-01-04`);
  return { year, week: Math.round((parse(mondayOf(d)) - parse(week1Monday)) / (7 * DAY)) + 1 };
}

export const weeksInIsoYear = (year: number) => isoWeek(`${year}-12-28`).week;

/** 季度（1–4）：第 1–13 週 = Q1 … 第 40–52／53 週 = Q4 */
export const quarterOfWeek = (week: number) => Math.min(4, Math.ceil(week / 13));

/** 某年某季嘅所有星期一（13 個，有第 53 週嘅年份 Q4 係 14 個） */
export function quarterMondays(year: number, quarter: number): string[] {
  const week1Monday = mondayOf(`${year}-01-04`);
  const first = (quarter - 1) * 13 + 1;
  const last = quarter === 4 ? weeksInIsoYear(year) : quarter * 13;
  return Array.from({ length: last - first + 1 }, (_, i) => addDays(week1Monday, (first - 1 + i) * 7));
}

export const shortDate = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
