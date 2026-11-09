"use client";
import { useEffect, useState } from "react";

export default function SetupPage() {
  const [state, setState] = useState<{ needsSetup: boolean; setupKeyRequired: boolean } | null>(null);
  const [f, setF] = useState({ setupKey: "", username: "", name: "", password: "", password2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/setup").then(async (r) => {
      const d = await r.json();
      if (!r.ok) setErr(d.error || "DB 연결을 확인하세요.");
      else setState(d);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) return setErr("비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    setErr("");
    const res = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error);
      setBusy(false);
    } else location.href = "/trainings";
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={submit}>
        <h1><span className="brand-mark">✓</span> 초기 설정</h1>
        {!state && !err && <p className="muted">확인 중...</p>}
        {state && !state.needsSetup && (
          <div className="alert info">이미 설정이 완료되었습니다. <a href="/login"><b>로그인 →</b></a></div>
        )}
        {state?.needsSetup && (
          <>
            <p className="muted small" style={{ margin: 0 }}>최초 관리자 계정을 생성합니다. 이후에는 이 화면을 사용할 수 없습니다.</p>
            {state.setupKeyRequired && (
              <label className="field">설치 키 (SETUP_KEY 환경변수 값)
                <input type="password" value={f.setupKey} onChange={set("setupKey")} required />
              </label>
            )}
            <label className="field">관리자 아이디<input value={f.username} onChange={set("username")} autoCapitalize="off" required /></label>
            <label className="field">이름<input value={f.name} onChange={set("name")} required /></label>
            <label className="field">비밀번호 (8자 이상)<input type="password" value={f.password} onChange={set("password")} minLength={8} required /></label>
            <label className="field">비밀번호 확인<input type="password" value={f.password2} onChange={set("password2")} minLength={8} required /></label>
            <button className="btn primary" disabled={busy}>관리자 계정 생성</button>
          </>
        )}
        {err && <div className="alert err">{err}</div>}
      </form>
    </div>
  );
}
