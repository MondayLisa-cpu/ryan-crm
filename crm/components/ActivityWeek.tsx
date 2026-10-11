"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveActivityWeekAction } from "@/app/(app)/activity/actions";
import {
  ACTIVITIES,
  APPT_SLOTS,
  KPI_LABEL,
  PERFECT_TOTAL,
  kpiOf,
  pointsByActivity,
  sumCounts,
  totalPoints,
  type ActivityKey,
  type Counts,
} from "@/lib/activity";
import { WEEKDAY_LABELS, shortDate } from "@/lib/weeks";

export type WeekDay = { day: string; counts: Counts; appts: Record<string, string> };

const KPI_CLASS = { green: "badge-green", yellow: "badge-yellow", red: "badge-red" } as const;

export function KpiBadge({ total }: { total: number }) {
  const k = kpiOf(total);
  return (
    <span className={`badge ${KPI_CLASS[k]}`} data-testid="kpi">
      {total} 分 · {KPI_LABEL[k]}
    </span>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
  label,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  label: string;
  compact?: boolean;
}) {
  const set = (v: number) => onChange(Math.max(0, Math.min(99, v)));
  if (compact)
    return (
      <input
        className={`num-cell${value > 0 ? " has" : ""}`}
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value === 0 ? "" : value}
        placeholder="0"
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
      />
    );
  return (
    <div className="stepper">
      <button type="button" disabled={disabled || value <= 0} onClick={() => set(value - 1)} aria-label={`${label} 減一`}>
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
          set(n);
        }}
      />
      <button type="button" disabled={disabled || value >= 99} onClick={() => set(value + 1)} aria-label={`${label} 加一`}>
        ＋
      </button>
    </div>
  );
}

export default function ActivityWeek({ days: initial, today, readOnly }: { days: WeekDay[]; today: string; readOnly: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const todayIdx = initial.findIndex((d) => d.day === today);
  const [active, setActive] = useState(todayIdx >= 0 ? todayIdx : 0);

  useEffect(() => {
    setDays(initial);
    setDirty(new Set());
  }, [initial]);

  useEffect(() => {
    if (dirty.size === 0) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const weekCounts = useMemo(() => sumCounts(days.map((d) => d.counts)), [days]);
  const weekPoints = pointsByActivity(weekCounts);
  const weekTotal = totalPoints(weekCounts);

  const setCount = (i: number, k: ActivityKey, v: number) => {
    setDays((ds) => ds.map((d, j) => (j === i ? { ...d, counts: { ...d.counts, [k]: v } } : d)));
    setDirty((s) => new Set(s).add(days[i].day));
    setMsg(null);
  };
  const setAppt = (i: number, k: string, v: string) => {
    setDays((ds) => ds.map((d, j) => (j === i ? { ...d, appts: { ...d.appts, [k]: v } } : d)));
    setDirty((s) => new Set(s).add(days[i].day));
    setMsg(null);
  };

  const save = () =>
    start(async () => {
      const changed = days.filter((d) => dirty.has(d.day));
      const res = await saveActivityWeekAction(days[0].day, changed);
      if (res.ok) {
        setDirty(new Set());
        setMsg({ ok: true, text: "已儲存" });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });

  const dayHead = (d: WeekDay, i: number) => (
    <>
      {WEEKDAY_LABELS[i]}
      <span className="muted small">（{shortDate(d.day)}）</span>
      {dirty.has(d.day) && <span className="dot" title="未儲存" />}
    </>
  );

  return (
    <div>
      {/* 本週總結 */}
      <div className="week-summary" data-testid="week-summary">
        <div className="wk-total">
          <div className="muted small">本週總分</div>
          <div className="wk-total-num">
            {weekTotal}
            <span className="muted"> ／{PERFECT_TOTAL}</span>
          </div>
          <KpiBadge total={weekTotal} />
          <div className="muted small" style={{ marginTop: 6 }}>綠 70+ · 黃 40–69 · 紅 0–39</div>
        </div>
        {ACTIVITIES.map((a) => {
          const pct = Math.min(100, (weekPoints[a.key] / a.perfect) * 100);
          return (
            <div className="wk-tile" key={a.key}>
              <div className="row">
                <b>{a.code}</b>
                <span className="spacer" />
                <span className="small">
                  <b>{weekPoints[a.key]}</b>
                  <span className="muted">／{a.perfect} 分</span>
                </span>
              </div>
              <div className="muted small wk-label">
                {a.label} · 每次 {a.points} 分 · 本週 {weekCounts[a.key]} 次
              </div>
              <div className="progress">
                <div style={{ width: `${pct}%` }} className={pct >= 100 ? "full" : undefined} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 電腦：一週表格 */}
      <div className="table-wrap week-grid">
        <table>
          <thead>
            <tr>
              <th></th>
              {days.map((d, i) => (
                <th key={d.day} className={`num${d.day === today ? " today" : ""}`}>
                  {dayHead(d, i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPT_SLOTS.map((s) => (
              <tr key={s.key}>
                <td>
                  {s.label}
                  <div className="muted small">{s.time}</div>
                </td>
                {days.map((d, i) => (
                  <td key={d.day} className={d.day === today ? "today" : undefined}>
                    <input
                      type="text"
                      className="appt"
                      aria-label={`${WEEKDAY_LABELS[i]} ${s.label}約會`}
                      value={d.appts[s.key] ?? ""}
                      disabled={readOnly}
                      maxLength={300}
                      onChange={(e) => setAppt(i, s.key, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {ACTIVITIES.map((a) => (
              <tr key={a.key}>
                <td>
                  <b>{a.code}</b> <span className="muted small">×{a.points}</span>
                </td>
                {days.map((d, i) => (
                  <td key={d.day} className={`num${d.day === today ? " today" : ""}`}>
                    <Stepper
                      compact
                      value={d.counts[a.key]}
                      disabled={readOnly}
                      label={`${WEEKDAY_LABELS[i]} ${a.code}`}
                      onChange={(v) => setCount(i, a.key, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>每日總分</td>
              {days.map((d) => (
                <td key={d.day} className={`num${d.day === today ? " today" : ""}`}>
                  {totalPoints(d.counts)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 手機：逐日 */}
      <div className="week-cards">
        <div className="tabs" role="tablist">
          {days.map((d, i) => (
            <button
              key={d.day}
              role="tab"
              aria-selected={active === i}
              className={`tab${active === i ? " active" : ""}`}
              onClick={() => setActive(i)}
            >
              {WEEKDAY_LABELS[i].replace("星期", "")}
              <span className="muted small"> {shortDate(d.day)}</span>
              {dirty.has(d.day) && <span className="dot" />}
            </button>
          ))}
        </div>
        {(() => {
          const d = days[active];
          const i = active;
          return (
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <b>{dayHead(d, i)}</b>
                <span className="spacer" />
                <span className="badge badge-grey">當日 {totalPoints(d.counts)} 分</span>
              </div>
              {ACTIVITIES.map((a) => (
                <div className="act-row" key={a.key}>
                  <div>
                    <b>{a.code}</b> <span className="muted small">{a.label}（{a.points} 分）</span>
                  </div>
                  <Stepper value={d.counts[a.key]} disabled={readOnly} label={`${a.code}（手機）`} onChange={(v) => setCount(i, a.key, v)} />
                </div>
              ))}
              {APPT_SLOTS.map((s) => (
                <label className="field" key={s.key} style={{ marginTop: 10 }}>
                  <span>
                    {s.label}約會 <span className="muted small">{s.time}</span>
                  </span>
                  <input
                    type="text"
                    value={d.appts[s.key] ?? ""}
                    disabled={readOnly}
                    maxLength={300}
                    onChange={(e) => setAppt(i, s.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          );
        })()}
      </div>

      {!readOnly && (
        <div className="savebar">
          <button className="btn btn-primary" onClick={save} disabled={pending || dirty.size === 0}>
            {pending ? "儲存中…" : "儲存"}
          </button>
          {dirty.size > 0 && <span className="muted small">{dirty.size} 日未儲存</span>}
          {msg && <span className={msg.ok ? "notice" : "error"}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
