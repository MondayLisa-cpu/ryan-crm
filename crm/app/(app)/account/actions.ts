"use server";

import { requireUser } from "@/lib/auth";

export async function changePasswordAction(_prev: { ok: boolean; message: string } | null, formData: FormData) {
  const { supabase } = await requireUser();
  const pw = String(formData.get("password") ?? "");
  const again = String(formData.get("again") ?? "");
  if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { ok: false, message: "新密碼最少 10 位，要有字母同數字" };
  if (pw !== again) return { ok: false, message: "兩次輸入唔一樣" };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { ok: false, message: "改密碼失敗：" + error.message };
  return { ok: true, message: "已更新密碼" };
}
