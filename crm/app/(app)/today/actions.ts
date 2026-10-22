"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { encryptColumn } from "@/lib/secure";
import { taskInputSchema, taskUpdateSchema } from "@/lib/planner";

export async function createTask(input: unknown) {
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { error: "請填日期、對象同計劃。" };
  const { supabase, profile } = await requireUser();
  const { name, plan, ...rest } = parsed.data;
  const id = randomUUID();
  const { error } = await supabase.from("daily_tasks").insert({ id, owner_id: profile.id, ...rest, info: encryptColumn(id, "info", {}, { name, plan, result: "" }) });
  if (error) return { error: "儲存失敗，請稍後再試。" };
  revalidatePath("/today"); revalidatePath("/review");
  return { error: "" };
}
export async function updateTask(input: unknown) {
  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "更新資料無效。" };
  const { supabase, profile } = await requireUser();
  const p = parsed.data;
  const { data: row, error: readError } = await supabase.from("daily_tasks").select("info").eq("id", p.id).eq("owner_id", profile.id).single();
  if (readError || !row) return { error: "搵唔到你嘅待辦。" };
  const { data, error } = await supabase.from("daily_tasks").update({ status: p.status, info: encryptColumn(p.id, "info", row.info, { result: p.result }) })
    .eq("id", p.id).eq("owner_id", profile.id).eq("updated_at", p.updated_at).select("id");
  if (error || !data?.length) return { error: "未能儲存，記錄可能已更新；請重新載入再試。" };
  revalidatePath("/today"); revalidatePath("/review");
  return { error: "" };
}
