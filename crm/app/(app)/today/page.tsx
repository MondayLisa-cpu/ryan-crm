import Link from "next/link";
import { requireUser, displayName } from "@/lib/auth";
import { resolveViewedOwner } from "@/lib/viewing";
import { loadTasks } from "@/lib/planner-data";
import { addDays, hkToday, isDate, mondayOf } from "@/lib/weeks";
import DailyPlanner from "@/components/DailyPlanner";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ week?: string; agent?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  const { owner, readOnly } = await resolveViewedOwner(supabase, profile, sp.agent);
  const today = hkToday(), monday = mondayOf(isDate(sp.week) ? sp.week : today);
  let tasks; try { tasks = await loadTasks(supabase, monday, addDays(monday, 6), owner.id); } catch {
    return <><h1>每日待辦</h1><p className="error" role="alert">暫時未能讀取待辦，請稍後重新載入或聯絡管理員。</p></>;
  }
  const url = (w: string) => `/today?week=${w}${readOnly ? `&agent=${owner.id}` : ""}`;
  return <><h1>{readOnly ? `${displayName(owner)} 嘅每週計劃` : "每日待辦"}</h1>
    <p className="muted">朝早排計劃，完成後更新結果。{readOnly ? "主管唯讀。" : "亦可以喺 WhatsApp 講低，再確認儲存。"}</p>
    <div className="row"><Link className="btn" href={url(addDays(monday,-7))}>上週</Link><strong>{monday} — {addDays(monday,6)}</strong><Link className="btn" href={url(addDays(monday,7))}>下週</Link><Link href={url(mondayOf(today))}>今週</Link><span className="spacer"/><Link href="/whatsapp">WhatsApp 草稿</Link></div>
    <DailyPlanner key={`${owner.id}:${monday}`} tasks={tasks} monday={monday} today={today} readOnly={readOnly}/>
  </>;
}
