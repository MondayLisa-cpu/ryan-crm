import { requireUser, displayName } from "@/lib/auth";
import PasswordForm from "./PasswordForm";

export default async function AccountPage() {
  const { profile } = await requireUser();
  return (
    <div className="narrow">
      <h1>我的帳戶</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div>{displayName(profile)}</div>
        <div className="muted small">{profile.email} · {profile.role === "admin" ? "主管" : "員工"}</div>
      </div>
      <PasswordForm />
    </div>
  );
}
