import { requireAdmin, type Profile } from "@/lib/auth";
import { CreateStaffForm, StaffTable } from "./StaffClient";

export default async function StaffPage() {
  const { supabase, profile } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("id, email, full_name, role, active, whatsapp").order("created_at");
  return (
    <>
      <h1>員工帳戶</h1>
      <StaffTable staff={(data as (Profile & { whatsapp: string | null })[] | null) ?? []} meId={profile.id} />
      <div style={{ marginTop: 20 }}>
        <CreateStaffForm />
      </div>
    </>
  );
}
