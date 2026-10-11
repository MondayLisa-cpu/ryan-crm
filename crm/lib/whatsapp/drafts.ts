import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptValue, encryptValue, parseKey } from "../crypto";
import type { Draft } from "./apply";

const key = () => parseKey(process.env.DATA_ENCRYPTION_KEY);
const aad = (id: string) => `wa_draft:${id}`;

export const sealDraft = (id: string, d: Draft) => encryptValue(key(), aad(id), JSON.stringify(d));
export const openDraft = (id: string, payload: string): Draft => JSON.parse(decryptValue(key(), aad(id), payload));

export async function latestPending(admin: SupabaseClient, ownerId: string) {
  const { data } = await admin
    .from("wa_drafts")
    .select("id, payload, created_at")
    .eq("owner_id", ownerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id as string, draft: openDraft(data.id, data.payload), created_at: data.created_at as string } : null;
}

/** 由 pending 轉狀態；返回 true 先代表真係由呢次轉（防止重複儲存） */
export async function setStatus(admin: SupabaseClient, id: string, status: "applied" | "cancelled"): Promise<boolean> {
  const { data } = await admin
    .from("wa_drafts")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  return (data ?? []).length === 1;
}

export async function reopen(admin: SupabaseClient, id: string) {
  await admin.from("wa_drafts").update({ status: "pending", decided_at: null }).eq("id", id);
}
