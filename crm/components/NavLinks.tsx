"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const primary = [
    { href: "/today", label: "每日待辦" },
    ...(isAdmin ? [{ href: "/review", label: "團隊 Review" }] : []),
    { href: "/board", label: "客戶進度" },
    { href: "/whatsapp", label: "WhatsApp" },
  ];
  const links = [
    ...(isAdmin ? [{ href: "/admin", label: "主管總覽" }] : []),
    { href: "/seasons", label: "四季人脈" },
    { href: "/activity", label: "活動分" },
    { href: "/pdca", label: "PDCA" },
    { href: "/business", label: "生意表" },
    { href: "/clients/new", label: "＋ 新增客戶" },
    ...(isAdmin
      ? [
          { href: "/admin/staff", label: "員工帳戶" },
          { href: "/admin/audit", label: "審計記錄" },
        ]
      : []),
    { href: "/account", label: "我的帳戶" },
  ];
  const isActive = (href: string) =>
    href === "/admin" ? path === "/admin" || path.startsWith("/admin/agents") : path.startsWith(href);
  return (
    <nav className="nav">
      {primary.map(l => <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : undefined}>{l.label}</Link>)}
      <details className="nav-more"><summary>更多</summary><div>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : undefined}>
          {l.label}
        </Link>
      ))}
      </div></details>
    </nav>
  );
}

