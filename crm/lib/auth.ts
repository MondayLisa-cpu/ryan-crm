import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "agent";
  active: boolean;
};

/** 目前登入員工；未登入或已停用就踢返去登入頁 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return { supabase, user, profile };
});

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/board");
  return ctx;
}

export const displayName = (p: Pick<Profile, "full_name" | "email">) => p.full_name || p.email;
