import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./auth";

/** 主管可以用 ?agent= 睇員工（唯讀）；員工一律只可以睇自己 */
export async function resolveViewedOwner(
  supabase: SupabaseClient,
  me: Profile,
  agent: string | undefined,
): Promise<{ owner: Pick<Profile, "id" | "email" | "full_name">; readOnly: boolean }> {
  if (agent && agent !== me.id && me.role === "admin") {
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("id", agent).maybeSingle<Profile>();
    if (data) return { owner: data, readOnly: true };
  }
  return { owner: me, readOnly: false };
}
