"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    ...(isAdmin ? [{ href: "/admin", label: "主管總覽" }] : []),
    { href: "/board", label: "我的看板" },
    { href: "/seasons", label: "四季人脈" },
    { href: "/activity", label: "活動分" },
    { href: "/pdca", label: "PDCA" },
    { href: "/business", label: "生意表" },
    { href: "/whatsapp", label: "WhatsApp" },
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
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
