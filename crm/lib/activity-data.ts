import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVITY_KEYS, emptyCounts, sumCounts, type Counts } from "./activity";
import { decryptColumn } from "./secure";
import { addDays, weekDays } from "./weeks";

export type DayEntry = { day: string; counts: Counts; appts: Record<string, string> };

type Row = { owner_id: string; day: string; appts?: Record<string, string> } & Counts;

export const apptRecordId = (ownerId: string, day: string) => `${ownerId}:${day}`;

const toCounts = (r: Partial<Counts>): Counts => {
  const c = emptyCounts();
  for (const k of ACTIVITY_KEYS) c[k] = Number(r[k] ?? 0);
  return c;
};

/** 某人某週 7 日嘅記錄（冇記錄嘅日子當 0） */
export async function loadWeek(supabase: SupabaseClient, ownerId: string, monday: string): Promise<DayEntry[]> {
  const { data, error } = await supabase
    .from("activity_days")
    .select(`owner_id, day, appts, ${ACTIVITY_KEYS.join(", ")}`)
    .eq("owner_id", ownerId)
    .gte("day", monday)
    .lte("day", addDays(monday, 6));
  if (error) throw new Error(error.message);
  const byDay = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.day, r]));
  return weekDays(monday).map((day) => {
    const r = byDay.get(day);
    return {
      day,
      counts: r ? toCounts(r) : emptyCounts(),
      appts: r ? decryptColumn(apptRecordId(ownerId, day), "appts", r.appts) : {},
    };
  });
}

/** 一段日子內每人每週嘅次數加總：Map<owner_id, Map<monday, Counts>> */
export async function loadWeeklyCounts(
  supabase: SupabaseClient,
  from: string,
  to: string,
  ownerId?: string,
): Promise<Map<string, Map<string, Counts>>> {
  let q = supabase.from("activity_days").select(`owner_id, day, ${ACTIVITY_KEYS.join(", ")}`).gte("day", from).lte("day", to);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const out = new Map<string, Map<string, Counts>>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const d = new Date(r.day + "T00:00:00Z");
    const monday = addDays(r.day, -((d.getUTCDay() + 6) % 7));
    const perOwner = out.get(r.owner_id) ?? new Map<string, Counts>();
    perOwner.set(monday, sumCounts([perOwner.get(monday) ?? emptyCounts(), toCounts(r)]));
    out.set(r.owner_id, perOwner);
  }
  return out;
}
