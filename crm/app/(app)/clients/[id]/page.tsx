import Link from "next/link";
import { notFound } from "next/navigation";
import ClientEditor from "@/components/ClientEditor";
import AuditList, { type AuditRow } from "@/components/AuditList";
import { requireUser, displayName, type Profile } from "@/lib/auth";
import { getClientFull } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profile } = await requireUser();

  // RLS：唔係自己嘅客（又唔係主管）會攞唔到 → 404
  const client = await getClientFull(supabase, id);
  if (!client) notFound();

  const readOnly = client.owner_id !== profile.id;

  const [{ data: people }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name"),
    supabase
      .from("audit_log")
      .select("id, at, actor_id, action, changes, via")
      .eq("record_id", id)
      .order("at", { ascending: false })
      .limit(50),
  ]);
  const names = new Map((people as Pick<Profile, "id" | "email" | "full_name">[] | null ?? []).map((p) => [p.id, displayName(p)]));
  const owner = names.get(client.owner_id) ?? "—";
  const rows: AuditRow[] = (audit ?? []).map((a) => ({
    id: a.id,
    at: a.at,
    actor: names.get(a.actor_id) ?? "系統",
    action: a.action,
    changes: a.changes,
    via: a.via,
  }));

  return (
    <div className="narrow" style={{ maxWidth: 960 }}>
      {readOnly && (
        <p className="notice">
          👁 唯讀模式 — 負責員工：
          <Link href={`/admin/agents/${client.owner_id}`}>{owner}</Link>
        </p>
      )}
      <p className="small">
        <Link href={readOnly ? `/admin/agents/${client.owner_id}` : "/board"}>← 返回看板</Link>
      </p>
      <ClientEditor
        client={{ id: client.id, stage: client.stage, season: client.season, info: client.info, checks: client.checks, forms: client.forms }}
        readOnly={readOnly}
      />
      <details className="history">
        <summary>修改記錄（{rows.length}）</summary>
        <AuditList rows={rows} />
      </details>
    </div>
  );
}
