"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MONEY_KEYS, isMonth, monthStart, type Target } from "@/lib/business";
import { encryptColumn } from "@/lib/secure";

export type SaveResult = { ok: true } | { ok: false; error: string };

type RowInput = {
  id: string; // 新行用 "new-…"
  client_id: string | null;
  client_name: string;
  product: string;
  note: string;
  afyp: number;
  revenue: number;
  commission: number;
};

const okAmount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e10;

export async function saveBusinessAction(ym: string, rows: RowInput[], deletedIds: string[]): Promise<SaveResult> {
  if (!isMonth(ym)) return { ok: false, error: "月份無效" };
  if (!Array.isArray(rows) || rows.length > 200 || !Array.isArray(deletedIds)) return { ok: false, error: "資料無效" };
  for (const r of rows) for (const k of MONEY_KEYS) if (!okAmount(r[k])) return { ok: false, error: "金額要係 0 或以上嘅數字" };

  const { supabase, profile } = await requireUser();
  const month = monthStart(ym);

  // 只接受自己嘅客做連結
  const { data: myClients } = await supabase.from("clients").select("id").eq("owner_id", profile.id);
  const mine = new Set((myClients ?? []).map((c) => c.id as string));
  const { data: existing } = await supabase.from("business_cases").select("id, data").eq("owner_id", profile.id).eq("month", month);
  const byId = new Map((existing ?? []).map((r) => [r.id as string, r]));

  for (const id of deletedIds) {
    if (!byId.has(id)) continue;
    const { error } = await supabase.from("business_cases").delete().eq("id", id);
    if (error) return { ok: false, error: "刪除失敗：" + error.message };
  }

  for (const r of rows) {
    const plain = {
      client_name: String(r.client_name ?? "").trim().slice(0, 200),
      product: String(r.product ?? "").trim().slice(0, 200),
      note: String(r.note ?? "").trim().slice(0, 1000),
    };
    const blank = !plain.client_name && !plain.product && MONEY_KEYS.every((k) => r[k] === 0);
    const client_id = r.client_id && mine.has(r.client_id) ? r.client_id : null;
    const money = Object.fromEntries(MONEY_KEYS.map((k) => [k, r[k]]));
    const old = byId.get(r.id);
    if (old) {
      const data = encryptColumn(r.id, "data", old.data, plain);
      const { error } = await supabase.from("business_cases").update({ data, client_id, ...money }).eq("id", r.id);
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    } else {
      if (blank) continue;
      const id = randomUUID();
      const data = encryptColumn(id, "data", {}, plain);
      const { error } = await supabase
        .from("business_cases")
        .insert({ id, owner_id: profile.id, month, client_id, data, ...money });
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    }
  }
  revalidatePath("/business");
  revalidatePath("/admin");
  return { ok: true };
}

export async function saveTargetAction(ym: string, t: Target): Promise<SaveResult> {
  if (!isMonth(ym)) return { ok: false, error: "月份無效" };
  if (!Number.isInteger(t.cases) || t.cases < 0 || t.cases > 9999 || !MONEY_KEYS.every((k) => okAmount(t[k])))
    return { ok: false, error: "目標要係 0 或以上嘅數字" };
  const { supabase, profile } = await requireUser();
  const month = monthStart(ym);
  const values = { cases: t.cases, afyp: t.afyp, revenue: t.revenue, commission: t.commission };
  const { data: row } = await supabase.from("monthly_targets").select("id").eq("owner_id", profile.id).eq("month", month).maybeSingle();
  const { error } = row
    ? await supabase.from("monthly_targets").update(values).eq("id", row.id)
    : await supabase.from("monthly_targets").insert({ owner_id: profile.id, month, ...values });
  if (error) return { ok: false, error: "儲存失敗：" + error.message };
  revalidatePath("/business");
  revalidatePath("/admin");
  return { ok: true };
}
