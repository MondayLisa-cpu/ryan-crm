import { ACTION_LABELS, describeChanges } from "@/lib/audit";

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  action: string;
  subject?: string;
  via?: string | null;
  changes: Record<string, unknown>;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });

export default function AuditList({ rows, showSubject }: { rows: AuditRow[]; showSubject?: boolean }) {
  if (rows.length === 0) return <p className="muted">暫時冇記錄</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>時間（香港）</th>
            <th>邊個</th>
            <th>動作</th>
            {showSubject && <th>對象</th>}
            <th>改咗乜</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ch = describeChanges(r.changes, r.action);
            return (
              <tr key={r.id}>
                <td>{fmt(r.at)}</td>
                <td>{r.actor}</td>
                <td>
                  {ACTION_LABELS[r.action] ?? r.action}
                  {r.via === "whatsapp" && <span className="badge badge-green" style={{ marginLeft: 4 }}>WhatsApp</span>}
                </td>
                {showSubject && <td>{r.subject}</td>}
                <td className="wrap">
                  {ch.length === 0
                    ? "—"
                    : ch.map((c, i) => (
                        <span key={i}>
                          {i > 0 && "、"}
                          {c.label}
                          {c.detail && <span className="muted">（{c.detail}）</span>}
                        </span>
                      ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
