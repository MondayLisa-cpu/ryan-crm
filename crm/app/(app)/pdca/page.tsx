import Link from "next/link";
import PdcaQuarter, { type PdcaRow } from "@/components/PdcaQuarter";
import { requireUser, displayName } from "@/lib/auth";
import { ACTIVITY_KEYS, emptyCounts, pointsByActivity, totalPoints, type Counts } from "@/lib/activity";
import { loadWeeklyCounts } from "@/lib/activity-data";
import { decryptColumn } from "@/lib/secure";
import { resolveViewedOwner } from "@/lib/viewing";
import { addDays, hkToday, isoWeek, mondayOf, quarterMondays, quarterOfWeek, shortDate } from "@/lib/weeks";

const round1 = (n: number) => Math.round(n * 10) / 10;

export default async function PdcaPage({ searchParams }: { searchParams: Promise<{ year?: string; q?: string; agent?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  const { owner, readOnly } = await resolveViewedOwner(supabase, profile, sp.agent);

  const today = hkToday();
  const nowWk = isoWeek(today);
  const year = Number(sp.year) >= 2020 && Number(sp.year) <= 2100 ? Number(sp.year) : nowWk.year;
  const quarter = [1, 2, 3, 4].includes(Number(sp.q)) ? Number(sp.q) : year === nowWk.year ? quarterOfWeek(nowWk.week) : 1;

  const mondays = quarterMondays(year, quarter);
  const from = mondays[0];
  const to = addDays(mondays[mondays.length - 1], 6);

  const [weekly, { data: focusRows }, { data: okrRow }] = await Promise.all([
    loadWeeklyCounts(supabase, from, to, owner.id),
    supabase.from("pdca_weeks").select("week_start, focus").eq("owner_id", owner.id).gte("week_start", from).lte("week_start", to),
    supabase.from("okrs").select("okr").eq("owner_id", owner.id).eq("year", year).maybeSingle(),
  ]);
  const counts = weekly.get(owner.id) ?? new Map<string, Counts>();
  const focus = new Map((focusRows ?? []).map((r) => [r.week_start as string, decryptColumn(`${owner.id}:${r.week_start}`, "focus", r.focus)]));
  const okr = okrRow ? decryptColumn(`${owner.id}:${year}`, "okr", okrRow.okr) : {};

  const thisMonday = mondayOf(today);
  const rows: PdcaRow[] = mondays.map((m) => {
    const future = m > thisMonday;
    const c = counts.get(m) ?? emptyCounts();
    return {
      week_start: m,
      week: isoWeek(m).week,
      label: `${shortDate(m)}–${shortDate(addDays(m, 6))}`,
      points: future ? null : pointsByActivity(c),
      total: future ? null : totalPoints(c),
      plan: focus.get(m)?.plan ?? "",
      progress: focus.get(m)?.progress ?? "",
    };
  });

  // 平均：只計已開始嘅週（包括今週）
  const past = rows.filter((r) => r.points);
  const average =
    past.length > 0
      ? (() => {
          const pts = emptyCounts();
          for (const k of ACTIVITY_KEYS) pts[k] = round1(past.reduce((s, r) => s + r.points![k], 0) / past.length);
          return { points: pts, total: round1(past.reduce((s, r) => s + r.total!, 0) / past.length), weeks: past.length };
        })()
      : null;

  const agentQs = readOnly ? `&agent=${owner.id}` : "";
  const prev = quarter === 1 ? { y: year - 1, q: 4 } : { y: year, q: quarter - 1 };
  const next = quarter === 4 ? { y: year + 1, q: 1 } : { y: year, q: quarter + 1 };

  return (
    <>
      {readOnly && (
        <p className="small">
          <Link href={`/admin/agents/${owner.id}`}>← {displayName(owner)} 嘅看板</Link>
        </p>
      )}
      <h1>{readOnly ? `${displayName(owner)} 嘅 PDCA` : "PDCA 季度記錄"}</h1>
      {readOnly && <p className="notice">👁 唯讀</p>}
      <div className="section-note">
        <b>生意公式：</b>心態 × 活動量 × 人脈 × 成交率
        <br />
        <b>PDCA：</b>P＝Plan（計劃）· D＝Do（行動）· C＝Check（檢查）· A＝Act（調整）
        <br />
        <span className="small muted">R／N／A／RR／NR／PC 分數自動由「活動分」計出，唔使再填。撳週數可以去返嗰週改活動。</span>
      </div>
      <div className="row" style={{ margin: "12px 0" }}>
        <Link className="btn btn-sm" href={`/pdca?year=${prev.y}&q=${prev.q}${agentQs}`}>
          ← 上季
        </Link>
        <b>
          {year} 年第 {quarter} 季（{shortDate(from)}–{shortDate(to)}，{mondays.length} 週）
        </b>
        <Link className="btn btn-sm" href={`/pdca?year=${next.y}&q=${next.q}${agentQs}`}>
          下季 →
        </Link>
      </div>
      <PdcaQuarter
        key={`${owner.id}:${year}:${quarter}`}
        year={year}
        rows={rows}
        average={average}
        okr={{ objective: okr.objective ?? "", key_results: okr.key_results ?? "" }}
        readOnly={readOnly}
        agentQs={agentQs}
      />
    </>
  );
}
