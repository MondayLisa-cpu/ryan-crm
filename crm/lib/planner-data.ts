import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptColumn } from "./secure";
import type { Task } from "./planner";

export async function loadTasks(db: SupabaseClient, from: string, to: string, owner?: string): Promise<Task[]> {
  let q = db.from("daily_tasks").select("*").gte("day", from).lte("day", to).order("day").order("created_at");
  if (owner) q = q.eq("owner_id", owner);
  const { data, error } = await q;
  if (error) throw new Error("每日待辦讀取失敗，請確認資料庫已更新。");
  return (data ?? []).map(row => ({ ...row, ...decryptColumn(row.id, "info", row.info) }) as Task);
}
