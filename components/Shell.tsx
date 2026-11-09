"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "./ui";

type U = { name: string; role: "admin" | "staff"; username: string };

const LINKS = [
  { href: "/dashboard", label: "현황판", admin: true },
  { href: "/scan", label: "QR 출석체크", admin: false },
  { href: "/trainings", label: "교육·차수", admin: true },
  { href: "/employees", label: "직원·QR", admin: true },
  { href: "/admins", label: "계정관리", admin: true },
  { href: "/logs", label: "접근기록", admin: true },
];

export default function Shell({ user, children }: { user: U; children: React.ReactNode }) {
  const path = usePathname();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  };
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href={user.role === "admin" ? "/dashboard" : "/scan"} className="brand">
            <span className="brand-mark">✓</span> 안전교육 출석관리
          </Link>
          <nav className="nav">
            {LINKS.filter((l) => user.role === "admin" || !l.admin).map((l) => (
              <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "active" : ""}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="userbox">
            <Link href="/account" style={{ color: "#fff" }} title="내 계정">
              <span className="uname">{user.name} </span>
              <span className="badge" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>{user.role === "admin" ? "관리자" : "담당자"}</span>
            </Link>
            <button onClick={logout}>로그아웃</button>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
      <Toaster />
    </>
  );
}
