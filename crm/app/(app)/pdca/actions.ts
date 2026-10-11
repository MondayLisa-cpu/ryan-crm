"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { encryptColumn } from "@/lib/secure";
import { isDate, weekdayIndex } from "@/lib/weeks";

export type SaveResult = { ok: true } | { ok: false; error: string };

const clip = (v: unknown, n = 2000) => String(v ?? "").slice(0, n);

/** 儲存多個星期嘅 PDCA 焦點（宣告焦點 plan／焦點進度 progress） */
export async function savePdcaWeeksAction(weeks: { week_start: string; plan: string; progress: string }[]): Promise<SaveResult> {
  if (!Array.isArray(weeks) || weeks.length > 14) return { ok: false, error: "資料無效" };
  for (const w of weeks) if (!isDate(w.week_start) || weekdayIndex(w.week_start) !== 0) return { ok: false, error: "週次無效" };

  const { supabase, profile } = await requireUser();
  const { data: existing, error: loadErr } = await supabase
    .from("pdca_weeks")
    .select("id, week_start, focus")
    .eq("owner_id", profile.id)
    .in("week_start", weeks.map((w) => w.week_start));
  if (loadErr) return { ok: false, error: "讀取失敗：" + loadErr.message };
  const byWeek = new Map((existing ?? []).map((r) => [r.week_start as string, r]));

  for (const w of weeks) {
    const row = byWeek.get(w.week_start);
    const focus = encryptColumn(`${profile.id}:${w.week_start}`, "focus", row?.focus ?? {}, {
      plan: clip(w.plan),
      progress: clip(w.progress),
    });
    if (row) {
      const { error } = await supabase.from("pdca_weeks").update({ focus }).eq("id", row.id);
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    } else if (Object.keys(focus).length > 0) {
      const { error } = await supabase.from("pdca_weeks").insert({ owner_id: profile.id, week_start: w.week_start, focus });
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    }
  }
  revalidatePath("/pdca");
  return { ok: true };
}

export async function saveOkrAction(year: number, objective: string, keyResults: string): Promise<SaveResult> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { ok: false, error: "年份無效" };
  const { supabase, profile } = await requireUser();
  const { data: row } = await supabase.from("okrs").select("id, okr").eq("owner_id", profile.id).eq("year", year).maybeSingle();
  const okr = encryptColumn(`${profile.id}:${year}`, "okr", row?.okr ?? {}, {
    objective: clip(objective),
    key_results: clip(keyResults, 4000),
  });
  const { error } = row
    ? await supabase.from("okrs").update({ okr }).eq("id", row.id)
    : await supabase.from("okrs").insert({ owner_id: profile.id, year, okr });
  if (error) return { ok: false, error: "儲存失敗：" + error.message };
  revalidatePath("/pdca");
  return { ok: true };
}
