import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVITIES, APPT_SLOTS } from "../activity";
import { apptRecordId } from "../activity-data";
import { decryptColumn, encryptColumn } from "../secure";
import { ALL_CHECKS, FORMS, GENDERS, MARITAL, STAGES, type FormColumn } from "../stages";
import { SEASONS } from "../seasons";
import { shortDate } from "../weeks";
import type { Extraction } from "./schema";

export type ClientTarget =
  | { mode: "none" }
  | { mode: "existing"; id: string; name: string }
  | { mode: "new"; id: string; name: string }
  | { mode: "ambiguous"; name: string; candidates: string[] };

export type Draft = { texts: string[]; today: string; extraction: Extraction; target: ClientTarget };

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 喺員工自己嘅客入面搵名：完全相同優先，其次互相包含（例如「陳大文」同「陳大文先生」） */
export function matchClient(name: string, clients: { id: string; name: string }[]): ClientTarget {
  const n = norm(name);
  if (!n) return { mode: "none" };
  const exact = clients.filter((c) => norm(c.name) === n);
  if (exact.length === 1) return { mode: "existing", id: exact[0].id, name: exact[0].name };
  const partial = exact.length > 1 ? exact : clients.filter((c) => norm(c.name).includes(n) || n.includes(norm(c.name)));
  if (partial.length === 1) return { mode: "existing", id: partial[0].id, name: partial[0].name };
  if (partial.length > 1) return { mode: "ambiguous", name, candidates: partial.map((c) => c.name) };
  return { mode: "new", id: randomUUID(), name: name.trim() };
}

export async function loadClientNames(admin: SupabaseClient, ownerId: string) {
  const { data, error } = await admin.from("clients").select("id, info").eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id as string, name: decryptColumn(c.id, "info", c.info).name ?? "" }));
}

const fieldMeta = (() => {
  const m = new Map<string, { label: string; append: boolean; number: boolean }>();
  for (const f of FORMS) {
    for (const s of f.sections)
      for (const x of s.fields)
        m.set(`${f.column}.${x.key}`, {
          label: `${f.stage}・${x.label}`,
          append: x.type === "textarea" || x.type === undefined,
          number: x.type === "number",
        });
    for (const c of f.checks?.items ?? [])
      if (c.fill) m.set(`${f.column}.${c.fill.key}`, { label: `${f.stage}・${c.fill.label}`, append: false, number: false });
  }
  return m;
})();

const NUM = /^-?\d+(\.\d+)?$/;

/** 草稿嘅內容有冇任何可以寫入嘅嘢 */
export function hasContent(d: Draft): boolean {
  const e = d.extraction;
  return (
    d.target.mode === "existing" ||
    d.target.mode === "new" ||
    ACTIVITIES.some((a) => e.activity[a.key] > 0) ||
    (e.appointment.slot !== "" && e.appointment.text.trim() !== "")
  );
}

/** 俾員工睇嘅確認訊息 */
export function describeDraft(d: Draft): string {
  const e = d.extraction;
  const lines: string[] = ["📝 幫你整理咗（未儲存）："];
  if (d.target.mode === "existing") lines.push(`客戶：${d.target.name}`);
  if (d.target.mode === "new") {
    const meta = [
      e.client.age && `${e.client.age}歲`,
      GENDERS.find((g) => g.value === e.client.gender)?.label,
      e.client.occupation,
      MARITAL.find((m) => m.value === e.client.marital)?.label,
    ].filter(Boolean);
    lines.push(`客戶：${d.target.name}（🆕 新客${meta.length ? `，${meta.join("・")}` : ""}）`);
  }
  if (d.target.mode !== "none" && d.target.mode !== "ambiguous") {
    for (const f of e.fields) {
      const meta = fieldMeta.get(f.field);
      if (meta && f.text.trim()) lines.push(`\n【${meta.label}】\n${f.text.trim()}`);
    }
    const checks = ALL_CHECKS.filter((c) => e.checks.includes(c.key));
    if (checks.length) lines.push(`\n✅ 簽單條件：${checks.map((c) => c.label).join("、")}`);
    if (e.stage) lines.push(`➡️ 階段：${STAGES.find((s) => s.key === e.stage)?.short}`);
    if (e.season) {
      const s = SEASONS.find((x) => x.key === e.season)!;
      lines.push(`${s.emoji} 四季：${s.label}`);
    }
  }
  const acts = ACTIVITIES.filter((a) => e.activity[a.key] > 0);
  if (acts.length || e.appointment.slot) {
    lines.push(`\n📊 活動（${shortDate(e.date)}）：${acts.map((a) => `${a.code}+${e.activity[a.key]}`).join("、") || "—"}`);
    if (e.appointment.slot && e.appointment.text.trim()) {
      const slot = APPT_SLOTS.find((s) => s.key === e.appointment.slot)!;
      lines.push(`🍽 ${slot.label}約會：${e.appointment.text.trim()}`);
    }
  }
  lines.push("\n回覆「確認」儲存，「取消」放棄；想補充就直接再講。");
  return lines.join("\n");
}

const stamp = (date: string) => `〔${shortDate(date)}〕`;

/** 將草稿寫入資料庫（經 service role 嘅 wa_* 函數，以員工身份寫入並記審計） */
export async function applyDraft(admin: SupabaseClient, ownerId: string, d: Draft): Promise<void> {
  const e = d.extraction;

  if (d.target.mode === "existing" || d.target.mode === "new") {
    const id = d.target.id;
    let row: Record<string, unknown> = {};
    if (d.target.mode === "existing") {
      const { data, error } = await admin.from("clients").select("*").eq("id", id).eq("owner_id", ownerId).single();
      if (error || !data) throw new Error("搵唔到呢個客");
      row = data;
    }

    const patch: Record<string, unknown> = {};

    // 基本資料：新客全部填；舊客只補空白
    const curInfo = decryptColumn(id, "info", row.info as Record<string, string>);
    const nextInfo: Record<string, string> = {};
    const want: Record<string, string> = {
      name: d.target.name,
      age: /^\d{1,3}$/.test(e.client.age) ? e.client.age : "",
      gender: e.client.gender,
      occupation: e.client.occupation.slice(0, 200),
      marital: e.client.marital,
    };
    for (const [k, v] of Object.entries(want)) if (v && !curInfo[k]) nextInfo[k] = v;
    if (Object.keys(nextInfo).length) patch.info = encryptColumn(id, "info", row.info as Record<string, string>, nextInfo);

    // 表格：長文字欄位加喺原有內容後面（標日期），其他欄位直接更新
    const byColumn = new Map<FormColumn, Record<string, string>>();
    for (const f of e.fields) {
      const meta = fieldMeta.get(f.field);
      const text = f.text.trim().slice(0, 5000);
      if (!meta || !text) continue;
      const [col, key] = f.field.split(".") as [FormColumn, string];
      if (meta.number && !NUM.test(text.replace(/[,\s$HK]/gi, ""))) continue;
      const cur = byColumn.get(col) ?? decryptColumn(id, col, row[col] as Record<string, string>);
      const old = cur[key] ?? "";
      const value = meta.number ? text.replace(/[,\s$HK]/gi, "") : text;
      cur[key] = meta.append && old.trim() ? `${old.trim()}\n\n${stamp(e.date)}\n${value}` : meta.append ? `${stamp(e.date)}\n${value}` : value;
      byColumn.set(col, cur);
    }
    for (const [col, values] of byColumn) patch[col] = encryptColumn(id, col, row[col] as Record<string, string>, values);

    for (const c of e.checks) patch[c] = true;
    if (e.stage) patch.stage = e.stage;
    if (e.season) patch.season = e.season;

    const { error } = await admin.rpc("wa_save_client", {
      p_actor: ownerId,
      p_id: id,
      p_patch: patch,
      p_create: d.target.mode === "new",
    });
    if (error) throw new Error("寫入客戶失敗：" + error.message);
  }

  const hasActs = ACTIVITIES.some((a) => e.activity[a.key] > 0);
  const hasAppt = e.appointment.slot !== "" && e.appointment.text.trim() !== "";
  if (hasActs || hasAppt) {
    let appts: Record<string, string> | null = null;
    if (hasAppt) {
      const { data } = await admin.from("activity_days").select("appts").eq("owner_id", ownerId).eq("day", e.date).maybeSingle();
      const rid = apptRecordId(ownerId, e.date);
      const cur = decryptColumn(rid, "appts", data?.appts);
      const old = cur[e.appointment.slot] ?? "";
      const add = e.appointment.text.trim().slice(0, 300);
      appts = encryptColumn(rid, "appts", data?.appts ?? {}, {
        [e.appointment.slot]: old && !old.includes(add) ? `${old}；${add}`.slice(0, 300) : add,
      });
    }
    const counts = Object.fromEntries(ACTIVITIES.map((a) => [a.key, e.activity[a.key]]));
    const { error } = await admin.rpc("wa_add_activity", { p_actor: ownerId, p_day: e.date, p_counts: counts, p_appts: appts });
    if (error) throw new Error("寫入活動分失敗：" + error.message);
  }
}
