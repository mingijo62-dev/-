"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtTime } from "@/lib/client";
import { Modal, toast } from "@/components/ui";

type A = { id: number; username: string; name: string; role: string; last_login_at: string | null; locked: boolean };

export default function AdminsPage() {
  const [list, setList] = useState<A[]>([]);
  const [form, setForm] = useState<{ username: string; name: string; password: string; role: string } | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<A[]>("/api/admins").then(setList), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try { await api("/api/admins", { body: form }); setForm(null); toast("계정이 생성되었습니다."); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "실패"); }
  };
  const patch = async (a: A, body: Record<string, unknown>, msg: string) => {
    try { await api(`/api/admins/${a.id}`, { method: "PATCH", body }); toast(msg); load(); }
    catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };
  const resetPw = (a: A) => {
    const pw = prompt(`${a.username} 계정의 새 비밀번호 (8자 이상)`);
    if (pw) patch(a, { password: pw, unlock: true }, "비밀번호가 초기화되었습니다.");
  };
  const del = async (a: A) => {
    if (!confirm(`${a.username} 계정을 삭제할까요?`)) return;
    try { await api(`/api/admins/${a.id}`, { method: "DELETE" }); load(); } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>계정 관리</h1>
          <div className="muted small"><b>관리자</b>: 전체 기능 / <b>담당자</b>: QR 출석체크만 가능 (현황·명단·다운로드 불가)</div>
        </div>
        <button className="btn primary" onClick={() => { setErr(""); setForm({ username: "", name: "", password: "", role: "staff" }); }}>+ 계정 추가</button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>아이디</th><th>이름</th><th>권한</th><th>최근 로그인</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.username}</td><td>{a.name}</td>
                <td>
                  <select value={a.role} onChange={(e) => patch(a, { role: e.target.value }, "권한이 변경되었습니다.")} style={{ width: "auto", minHeight: 32, padding: "3px 8px" }}>
                    <option value="admin">관리자</option><option value="staff">담당자</option>
                  </select>
                </td>
                <td className="small mono">{fmtTime(a.last_login_at) || "-"}</td>
                <td>{a.locked ? <button className="btn sm" onClick={() => patch(a, { unlock: true }, "잠금 해제")}>🔒 잠금해제</button> : <span className="badge ok">정상</span>}</td>
                <td className="right nowrap">
                  <button className="btn sm" onClick={() => resetPw(a)}>비밀번호 초기화</button>{" "}
                  <button className="btn sm danger" onClick={() => del(a)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title="계정 추가" onClose={() => setForm(null)}
          footer={<><button className="btn" onClick={() => setForm(null)}>취소</button><button className="btn primary" onClick={save}>생성</button></>}>
          <div className="form-grid">
            <label className="field">아이디<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoCapitalize="off" /></label>
            <label className="field">이름<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">초기 비밀번호<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label className="field">권한
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">담당자 (출석체크)</option><option value="admin">관리자</option></select>
            </label>
          </div>
          {err && <div className="alert err" style={{ marginTop: 10 }}>{err}</div>}
        </Modal>
      )}
    </>
  );
}
