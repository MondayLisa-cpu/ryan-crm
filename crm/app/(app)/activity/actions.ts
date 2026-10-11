"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ACTIVITY_KEYS, APPT_SLOTS, type Counts } from "@/lib/activity";
import { apptRecordId } from "@/lib/activity-data";
import { encryptColumn } from "@/lib/secure";
import { addDays, isDate, weekdayIndex } from "@/lib/weeks";

export type SaveResult = { ok: true } | { ok: false; error: string };

type DayInput = { day: string; counts: Counts; appts: Record<string, string> };

export async function saveActivityWeekAction(monday: string, days: DayInput[]): Promise<SaveResult> {
  if (!isDate(monday) || weekdayIndex(monday) !== 0) return { ok: false, error: "週次無效" };
  const sunday = addDays(monday, 6);
  if (!Array.isArray(days) || days.length > 7) return { ok: false, error: "資料無效" };
  for (const d of days) {
    if (!isDate(d.day) || d.day < monday || d.day > sunday) return { ok: false, error: "日期唔喺呢個星期" };
    for (const k of ACTIVITY_KEYS) {
      const v = d.counts?.[k];
      if (!Number.isInteger(v) || v < 0 || v > 99) return { ok: false, error: "次數要係 0–99 嘅整數" };
    }
  }

  const { supabase, profile } = await requireUser();
  const { data: existing, error: loadErr } = await supabase
    .from("activity_days")
    .select("id, day, appts")
    .eq("owner_id", profile.id)
    .gte("day", monday)
    .lte("day", sunday);
  if (loadErr) return { ok: false, error: "讀取失敗：" + loadErr.message };
  const byDay = new Map((existing ?? []).map((r) => [r.day as string, r]));

  for (const d of days) {
    const appts: Record<string, string> = {};
    for (const s of APPT_SLOTS) appts[s.key] = String(d.appts?.[s.key] ?? "").slice(0, 300);
    const counts = Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, d.counts[k]]));
    const row = byDay.get(d.day);
    const enc = encryptColumn(apptRecordId(profile.id, d.day), "appts", row?.appts ?? {}, appts);

    if (row) {
      const { error } = await supabase.from("activity_days").update({ ...counts, appts: enc }).eq("id", row.id);
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    } else {
      const empty = ACTIVITY_KEYS.every((k) => d.counts[k] === 0) && Object.keys(enc).length === 0;
      if (empty) continue;
      const { error } = await supabase
        .from("activity_days")
        .insert({ owner_id: profile.id, day: d.day, ...counts, appts: enc });
      if (error) return { ok: false, error: "儲存失敗：" + error.message };
    }
  }
  revalidatePath("/activity");
  revalidatePath("/pdca");
  revalidatePath("/admin");
  return { ok: true };
}
