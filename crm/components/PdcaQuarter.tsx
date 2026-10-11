"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveOkrAction, savePdcaWeeksAction } from "@/app/(app)/pdca/actions";
import { ACTIVITIES, PERFECT_TOTAL, type Counts } from "@/lib/activity";
import { KpiBadge } from "./ActivityWeek";

export type PdcaRow = {
  week_start: string;
  week: number;
  label: string; // 日期範圍
  points: Counts | null; // null = 未來週
  total: number | null;
  plan: string;
  progress: string;
};

export default function PdcaQuarter({
  year,
  rows: initial,
  average,
  okr,
  readOnly,
  agentQs,
}: {
  year: number;
  rows: PdcaRow[];
  average: { points: Counts; total: number; weeks: number } | null;
  okr: { objective: string; key_results: string };
  readOnly: boolean;
  agentQs: string; // 主管睇員工時嘅 "&agent=…"

}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [objective, setObjective] = useState(okr.objective);
  const [keyResults, setKeyResults] = useState(okr.key_results);
  const [okrDirty, setOkrDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [okrMsg, setOkrMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setRows(initial);
    setDirty(new Set());
  }, [initial]);

  useEffect(() => {
    if (dirty.size === 0 && !okrDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, okrDirty]);

  const edit = (ws: string, k: "plan" | "progress", v: string) => {
    setRows((rs) => rs.map((r) => (r.week_start === ws ? { ...r, [k]: v } : r)));
    setDirty((s) => new Set(s).add(ws));
    setMsg(null);
  };

  const saveWeeks = () =>
    start(async () => {
      const res = await savePdcaWeeksAction(
        rows.filter((r) => dirty.has(r.week_start)).map((r) => ({ week_start: r.week_start, plan: r.plan, progress: r.progress })),
      );
      if (res.ok) {
        setDirty(new Set());
        setMsg({ ok: true, text: "已儲存" });
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });

  const saveOkr = () =>
    start(async () => {
      const res = await saveOkrAction(year, objective, keyResults);
      if (res.ok) {
        setOkrDirty(false);
        setOkrMsg({ ok: true, text: "已儲存" });
        router.refresh();
      } else setOkrMsg({ ok: false, text: res.error });
    });

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{year} 年度焦點 OKR</h2>
        <div className="grid-2">
          <label className="field">
            <span>O 目標</span>
            <textarea
              value={objective}
              disabled={readOnly}
              onChange={(e) => {
                setObjective(e.target.value);
                setOkrDirty(true);
                setOkrMsg(null);
              }}
            />
          </label>
          <label className="field">
            <span>KR 關鍵結果</span>
            <textarea
              value={keyResults}
              disabled={readOnly}
              placeholder={readOnly ? "" : "每行一個，例如：全年 AFYP 100 萬"}
              onChange={(e) => {
                setKeyResults(e.target.value);
                setOkrDirty(true);
                setOkrMsg(null);
              }}
            />
          </label>
        </div>
        {!readOnly && (
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={saveOkr} disabled={pending || !okrDirty}>
              儲存 OKR
            </button>
            {okrMsg && <span className={okrMsg.ok ? "notice" : "error"}>{okrMsg.text}</span>}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="pdca-table" data-testid="pdca-table">
          <thead>
            <tr>
              <th>Week</th>
              {ACTIVITIES.map((a) => (
                <th key={a.key} className="num">
                  {a.code}
                </th>
              ))}
              <th className="num">Total／KPI</th>
              <th>宣告 PDCA 焦點</th>
              <th>PDCA 焦點進度</th>
            </tr>
          </thead>
          <tbody>
            <tr className="muted">
              <td>eg. Perfect</td>
              {ACTIVITIES.map((a) => (
                <td key={a.key} className="num">
                  {a.perfect}
                </td>
              ))}
              <td className="num">{PERFECT_TOTAL} 綠</td>
              <td className="wrap small">完成3萬C，開口10個人，做準備功課，PC15分</td>
              <td className="wrap small">完成2萬C，開口8個人，100%完成功課✓，PC20分</td>
            </tr>
            {rows.map((r, i) => (
              <tr key={r.week_start} data-week={r.week_start}>
                <td>
                  <Link href={`/activity?week=${r.week_start}${agentQs}`}>
                    <b>{i + 1}</b>
                  </Link>
                  <div className="muted small">
                    W{r.week} · {r.label}
                  </div>
                  {dirty.has(r.week_start) && <span className="dot" title="未儲存" />}
                </td>
                {ACTIVITIES.map((a) => (
                  <td key={a.key} className="num">
                    {r.points ? r.points[a.key] : ""}
                  </td>
                ))}
                <td className="num">{r.total !== null ? <KpiBadge total={r.total} /> : ""}</td>
                <td>
                  <textarea
                    className="pdca-text"
                    aria-label={`第 ${i + 1} 週宣告焦點`}
                    value={r.plan}
                    disabled={readOnly}
                    onChange={(e) => edit(r.week_start, "plan", e.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    className="pdca-text"
                    aria-label={`第 ${i + 1} 週焦點進度`}
                    value={r.progress}
                    disabled={readOnly}
                    onChange={(e) => edit(r.week_start, "progress", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                Average
                {average && <div className="muted small">（已過 {average.weeks} 週）</div>}
              </td>
              {ACTIVITIES.map((a) => (
                <td key={a.key} className="num" data-testid={`avg-${a.key}`}>
                  {average ? average.points[a.key] : 0}
                </td>
              ))}
              <td className="num">{average ? <KpiBadge total={average.total} /> : "0"}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <div className="savebar">
          <button className="btn btn-primary" onClick={saveWeeks} disabled={pending || dirty.size === 0}>
            {pending ? "儲存中…" : "儲存 PDCA 焦點"}
          </button>
          {dirty.size > 0 && <span className="muted small">{dirty.size} 週未儲存</span>}
          {msg && <span className={msg.ok ? "notice" : "error"}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
