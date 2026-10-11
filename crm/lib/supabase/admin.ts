import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service role：繞過 RLS，只限用喺「開／停員工帳戶」。
 * 呼叫前一定要先用 requireAdmin() 確認係管理員。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 未設定");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
