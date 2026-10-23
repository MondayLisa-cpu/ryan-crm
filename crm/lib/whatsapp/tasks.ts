import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptColumn, encryptColumn } from "../secure";
import { taskInputSchema } from "../planner";
import { z } from "zod";

export const taskMessageSchema = taskInputSchema.extend({
  operation: z.enum(["create", "update"]),
  status: z.enum(["planned", "done", "blocked", "cancelled"]),
  result: z.string().trim().max(2000),
});
export type TaskMessage = z.infer<typeof taskMessageSchema>;
export type PreparedTask = { operation: "create" | "update"; id: string; day: string; category: string; stage: string; status: string; info: Record<string,string>; updated_at?: string };

/** Resolve before showing the draft; ambiguous matches never become new tasks. */
export async function prepareTasks(db: SupabaseClient, owner: string, input: TaskMessage[]): Promise<PreparedTask[]> {
  const output: PreparedTask[] = [];
  for (const raw of input) {
    const t = taskMessageSchema.parse(raw);
    if (t.operation === "create") {
      const id = randomUUID();
      output.push({ operation: "create", id, day:t.day, category:t.category, stage:t.stage, status:t.status,
        info: encryptColumn(id,"info",{}, { name:t.name,plan:t.plan,result:t.result }) });
      continue;
    }
    const { data, error } = await db.from("daily_tasks").select("*").eq("owner_id",owner).eq("day",t.day).eq("category",t.category);
    if (error) throw new Error("未能讀取待辦，請稍後再試。");
    const matches = (data ?? []).filter(r => {
      const v = decryptColumn(r.id,"info",r.info);
      return v.name.trim().toLowerCase() === t.name.trim().toLowerCase() && (!t.stage || r.stage === t.stage);
    });
    if (matches.length !== 1) throw new Error(`「${t.name}」待辦未能唯一配對，請講清楚原本計劃日期、工作欄及 stage，或者喺 app 更新。`);
    const row = matches[0];
    if (output.some(x => x.id === row.id)) throw new Error("同一待辦有多項更新，請合併成一個結果。");
    output.push({ operation:"update", id:row.id, day:row.day, category:row.category, stage:row.stage, status:t.status, updated_at:row.updated_at,
      info:encryptColumn(row.id,"info",row.info,{ result:t.result }) });
  }
  return output;
}
