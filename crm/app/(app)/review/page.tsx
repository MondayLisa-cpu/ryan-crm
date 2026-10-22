import Link from "next/link";
import { requireAdmin, displayName, type Profile } from "@/lib/auth";
import { loadTasks } from "@/lib/planner-data";
import { summarizeTasks, PLAN_STAGES } from "@/lib/planner";
import { addDays, hkToday, isDate, mondayOf } from "@/lib/weeks";
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{week?: string}> }) {
  const { supabase } = await requireAdmin(); const sp = await searchParams;
  const today = hkToday(), monday = mondayOf(isDate(sp.week) ? sp.week : today);
  const { data: people, error } = await supabase.from("profiles").select("id,email,full_name,role,active").order("full_name");
  let tasks; try { if (error) throw error; tasks = await loadTasks(supabase, monday, addDays(monday,6)); } catch { return <p className="error" role="alert">未能讀取團隊進度，請稍後重新載入。</p>; }
  return <><h1>團隊 Review</h1><p className="muted">對照今週計劃同實際結果，再同下線定下一步。預計 stage 唔代表已完成。</p>
    <div className="row"><Link className="btn" href={`/review?week=${addDays(monday,-7)}`}>上週</Link><strong>{monday} — {addDays(monday,6)}</strong><Link className="btn" href={`/review?week=${addDays(monday,7)}`}>下週</Link><Link href="/review">今週</Link></div>
    <div className="table-wrap planner-week"><table><thead><tr><th>下線</th><th>計劃</th><th>完成</th><th>未完成</th><th>逾期</th><th>Review 重點</th></tr></thead><tbody>{(people as Profile[] ?? []).filter(p => p.active || tasks.some(t => t.owner_id === p.id)).map(p => {
      const mine = tasks.filter(t => t.owner_id === p.id), s = summarizeTasks(mine,today);
      return <tr key={p.id}><td><Link href={`/today?agent=${p.id}&week=${monday}`}>{displayName(p)}</Link></td><td>{s.total || "未有計劃"}</td><td>{s.done}</td><td>{s.open}</td><td>{s.overdue}</td><td>{mine.filter(t => t.status === "blocked" || (t.day < today && t.status === "planned")).map(t => <p key={t.id}><strong>{t.name}</strong> · {PLAN_STAGES[t.stage]}<br/>{t.plan}<br/>{t.result || "未有結果記錄"}</p>)}<Link href={`/today?agent=${p.id}&week=${monday}`}>睇計劃及結果</Link> · <Link href={`/admin/agents/${p.id}`}>客戶目前 stage</Link></td></tr>;
    })}</tbody></table></div></>;
}
