"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LoginForm({ next }: { next: string }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((d) => setNeedsSetup(!!d.needsSetup)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "로그인 실패");
      location.href = next || (d.role === "admin" ? "/dashboard" : "/qr");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인 실패");
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={submit}>
        <div>
          <Logo dark />
          <h1 style={{ marginTop: 12 }}>안전교육 출석관리</h1>
          <p className="muted small" style={{ margin: 0 }}>관리자·출석 담당자 전용 시스템입니다.</p>
        </div>
        {needsSetup && (
          <div className="alert info">
            초기 설정이 필요합니다. <Link href="/setup"><b>최초 관리자 계정 만들기 →</b></Link>
          </div>
        )}
        <label className="field">아이디
          <input value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="off" required />
        </label>
        <label className="field">비밀번호
          <input type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <div className="alert err">{err}</div>}
        <button className="btn primary xl" disabled={busy} style={{ minHeight: 48, fontSize: 16 }}>{busy ? "확인 중..." : "로그인"}</button>
        <div className="privacy-note">
          본 시스템은 안전교육 이수 관리 목적으로 사번·성명·소속 정보를 처리합니다. 모든 접근·조회·다운로드 기록은 저장되며,
          목적 외 이용 및 무단 유출 시 관련 법령에 따라 책임을 질 수 있습니다. 로그인 5회 실패 시 계정이 10분간 잠깁니다.
        </div>
      </form>
    </div>
  );
}
