import { requireUser, displayName } from "@/lib/auth";
import { signOut } from "../login/actions";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const isAdmin = profile.role === "admin";
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">跟客系統</span>
          <NavLinks isAdmin={isAdmin} />
          <div className="who">
            <span>
              {displayName(profile)}
              {isAdmin && "（主管）"}
            </span>
            <form action={signOut}>
              <button className="btn btn-sm">登出</button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
