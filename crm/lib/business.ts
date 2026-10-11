// 功能四：每月生意表（取代《四季紅簿 2026》頂部嘅生意表）

export type Money = { afyp: number; revenue: number; commission: number };
export type Target = Money & { cases: number };
export type CaseRow = Money & {
  id: string;
  client_id: string | null;
  client_name: string;
  product: string;
  note: string;
};

export const MONEY_KEYS = ["afyp", "revenue", "commission"] as const;
export const MONEY_LABELS: Record<(typeof MONEY_KEYS)[number], string> = { afyp: "AFYP", revenue: "Revenue", commission: "佣金" };

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const monthStart = (ym: string) => `${ym}-01`;
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
export const monthLabel = (ym: string) => `${ym.slice(0, 4)} 年 ${Number(ym.slice(5))} 月`;

export const emptyTarget = (): Target => ({ cases: 0, afyp: 0, revenue: 0, commission: 0 });

export function totals(rows: Money[]): Target {
  const t = emptyTarget();
  for (const r of rows) {
    t.cases += 1;
    for (const k of MONEY_KEYS) t[k] += Number(r[k]) || 0;
  }
  for (const k of MONEY_KEYS) t[k] = Math.round(t[k] * 100) / 100;
  return t;
}

/** 完成度（%），冇目標就 null */
export const pct = (done: number, target: number) => (target > 0 ? Math.round((done / target) * 100) : null);

export const hkd = (n: number) => `$${n.toLocaleString("en-HK", { maximumFractionDigits: 2 })}`;

/** 「12,000」「1.2萬」「$3,000」→ 數字；唔識讀就 null */
export function parseAmount(v: string): number | null {
  const s = v.replace(/[,\s$HK]/gi, "");
  if (s === "") return 0;
  const wan = /^(\d+(\.\d+)?)萬$/.exec(s);
  if (wan) return Math.round(Number(wan[1]) * 10000 * 100) / 100;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 1e10 ? n : null;
}
