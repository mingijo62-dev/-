"use client";
import { useState } from "react";
import Link from "next/link";
import { EmployeeCheckCard, type CheckResult, type ScanEmp } from "@/components/CheckIn";
import { TrainingPicker, useScanSelection } from "@/components/TrainingPicker";
import { api, fmtTime } from "@/lib/client";

type Log = { key: number; name: string; emp_no: string; dept: string; status: "ok" | "duplicate"; at: string };

/** 휴대폰이 없거나 QR 출석이 어려운 직원을 담당자가 대신 처리 */
export default function ManualCheckPage() {
  const sel = useScanSelection();
  const [q, setQ] = useState("");
  const [list, setList] = useState<ScanEmp[] | null>(null);
  const [emp, setEmp] = useState<ScanEmp | null>(null);
  const [err, setErr] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);

  const search = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr("");
    setEmp(null);
    try {
      const r = await api<ScanEmp[]>(`/api/scan?q=${encodeURIComponent(q.trim())}&trainingId=${sel.trainingId}`);
      setList(r);
      if (r.length === 1) setEmp(r[0]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "조회 실패");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>수기 출석</h1>
          <div className="muted small">휴대폰 미소지 등으로 QR 출석이 어려운 직원을 사번/이름으로 찾아 담당자가 처리합니다. 일반 출석은 <Link href="/qr"><b>오늘의 출석QR</b></Link>을 이용하세요.</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}><TrainingPicker sel={sel} /></div>
      <div className="scan-layout">
        <div className="stack">
          <form className="card row" onSubmit={search}>
            <input placeholder="사번 또는 이름 (2자 이상)" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} autoFocus />
            <button className="btn primary">검색</button>
          </form>
          {err && <div className="alert err">{err}</div>}
          {list && !emp && (
            <div className="card">
              <h3>검색 결과 {list.length}건</h3>
              {!list.length && <div className="muted">일치하는 직원이 없습니다.</div>}
              <div className="stack" style={{ gap: 6 }}>
                {list.map((c) => (
                  <button key={c.id} className="btn" style={{ justifyContent: "space-between" }} onClick={() => setEmp(c)}>
                    <span>{c.name} <span className="muted mono">{c.emp_no}</span></span>
                    <span className="muted small">{[c.shift_type, c.department, c.work_group, c.position].filter(Boolean).join(" · ")} {c.attendance ? "· 참석완료" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {emp && (
            <>
              <EmployeeCheckCard key={`${emp.id}-${sel.trainingId}`} emp={emp} trainingId={sel.trainingId} roundId={sel.roundId}
                onDone={(r: CheckResult | null, e) => r && setLogs((l) => [{ key: Date.now(), name: e.name, emp_no: e.emp_no, dept: e.department, status: r.status, at: r.checked_at }, ...l].slice(0, 30))} />
              <button className="btn" onClick={() => { setEmp(null); setList(null); setQ(""); }}>다음 직원</button>
            </>
          )}
        </div>
        <div className="card">
          <h3>이 기기 처리 내역 <span className="muted small">({logs.length})</span></h3>
          {!logs.length && <div className="muted small">아직 처리 내역이 없습니다.</div>}
          {logs.map((l) => (
            <div key={l.key} className="row small" style={{ padding: "5px 0", borderBottom: "1px dashed var(--line)" }}>
              <span className={`badge ${l.status === "ok" ? "ok" : "warn"}`}>{l.status === "ok" ? "참석" : "중복"}</span>
              <b>{l.name}</b><span className="muted mono">{l.emp_no}</span><span className="muted">{l.dept}</span>
              <span className="spacer" /><span className="muted mono">{fmtTime(l.at, false)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
