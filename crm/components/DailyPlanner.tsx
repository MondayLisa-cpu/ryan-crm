"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, PLAN_STAGES, STATUSES, type Task } from "@/lib/planner";
import { WEEKDAY_LABELS, weekDays } from "@/lib/weeks";
import { createTask, updateTask } from "@/app/(app)/today/actions";

function TaskRow({ task, readOnly }: { task: Task; readOnly: boolean }) {
  const [status, setStatus] = useState(task.status);
  const [result, setResult] = useState(task.result || "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return <article className="planner-task">
    <strong>{task.name}</strong><span className="small muted">{PLAN_STAGES[task.stage]}</span>
    <p>{task.plan}</p><span className="badge badge-grey">{STATUSES[task.status]}</span>
    {readOnly ? <p className="small">{task.result || "未有結果記錄"}</p> : <details><summary>更新結果</summary>
      <form onSubmit={e => { e.preventDefault(); start(async () => { try { const r = await updateTask({ id: task.id, updated_at: task.updated_at, status, result }); setError(r.error); if (!r.error) router.refresh(); } catch { setError("儲存失敗，請重試。"); } }); }}>
        <label className="field"><span>狀態</span><select value={status} onChange={e => setStatus(e.target.value as Task["status"])}>{Object.entries(STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>實際結果／下一步</span><textarea maxLength={2000} value={result} onChange={e => setResult(e.target.value)} /></label>
        <button className="btn" disabled={pending}>{pending ? "儲存中…" : "儲存結果"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form></details>}
  </article>;
}

export default function DailyPlanner({ tasks, monday, today, readOnly }: { tasks: Task[]; monday: string; today: string; readOnly: boolean }) {
  const days = weekDays(monday);
  const [day, setDay] = useState(days.includes(today) ? today : monday);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return <>
    {!readOnly && <details className="planner-add"><summary>新增計劃</summary><form onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; const values = Object.fromEntries(new FormData(form));
      start(async () => { try { const r = await createTask(values); setError(r.error); if (!r.error) { form.reset(); router.refresh(); } } catch { setError("儲存失敗，請重試。"); } });
    }}>
      <div className="grid-2"><label className="field"><span>日期</span><input name="day" type="date" defaultValue={day} required /></label>
      <label className="field"><span>對象</span><input name="name" type="text" placeholder="例如 Mary" maxLength={120} required /></label>
      <label className="field"><span>工作欄</span><select name="category">{Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="field"><span>今次打算做嘅 stage</span><select name="stage">{Object.entries(PLAN_STAGES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
      <label className="field"><span>打算做乜</span><input name="plan" type="text" placeholder="例如邀約 Mary，安排了解需要" maxLength={1000} required /></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "儲存中…" : "加入待辦"}</button>{error && <p role="alert" className="error">{error}</p>}
    </form></details>}
    <div className="planner-days" role="group" aria-label="選擇日期">{days.map((d,i) => <button key={d} className={`btn ${day === d ? "btn-primary" : ""}`} aria-pressed={day === d} onClick={() => setDay(d)}>{WEEKDAY_LABELS[i]}<small>{d.slice(5)}{d === today ? " · 今日" : ""}</small></button>)}</div>
    <div className="planner-columns">{Object.entries(CATEGORIES).map(([key,label]) => {
      const items = tasks.filter(t => t.day === day && t.category === key);
      return <section key={key}><h2>{label} <span className="muted small">{items.length}</span></h2>{items.length ? items.map(t => <TaskRow key={`${t.id}:${t.updated_at}`} task={t} readOnly={readOnly} />) : <p className="planner-empty">未有安排</p>}</section>;
    })}</div>
    <details className="planner-week"><summary>睇全週紙本表</summary><div className="table-wrap"><table><thead><tr><th>日期</th>{Object.values(CATEGORIES).map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{days.map((d,i) => <tr key={d}><th>{WEEKDAY_LABELS[i]}<br/>{d}</th>{Object.keys(CATEGORIES).map(k => <td key={k}>{tasks.filter(t => t.day === d && t.category === k).map(t => <p key={t.id}><strong>{t.name}</strong> · {STATUSES[t.status]}<br/>{t.plan}<br/><small>{PLAN_STAGES[t.stage]}{t.result && `；${t.result}`}</small></p>)}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}
