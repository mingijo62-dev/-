"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { toast } from "@/components/ui";

export default function AccountPage() {
  const [f, setF] = useState({ current: "", next: "", next2: "" });
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (f.next !== f.next2) return setErr("새 비밀번호 확인이 일치하지 않습니다.");
    try {
      await api("/api/auth/password", { body: f });
      toast("비밀번호가 변경되었습니다.");
      setF({ current: "", next: "", next2: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "실패");
    }
  };
  return (
    <div style={{ maxWidth: 440 }}>
      <h1>내 계정</h1>
      <form className="card stack" onSubmit={submit} style={{ marginTop: 12 }}>
        <h2>비밀번호 변경</h2>
        <label className="field">현재 비밀번호<input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></label>
        <label className="field">새 비밀번호 (8자 이상)<input type="password" minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required /></label>
        <label className="field">새 비밀번호 확인<input type="password" minLength={8} value={f.next2} onChange={(e) => setF({ ...f, next2: e.target.value })} required /></label>
        {err && <div className="alert err">{err}</div>}
        <button className="btn primary">변경</button>
      </form>
    </div>
  );
}
