"use client";
import { useRef, useState } from "react";
import QrScanner from "@/components/QrScanner";
import { EmployeeCheckCard, feedback, type CheckResult, type ScanEmp } from "@/components/CheckIn";
import { TrainingPicker, useScanSelection } from "@/components/TrainingPicker";
import { api, extractToken, fmtTime } from "@/lib/client";

type Log = { key: number; name: string; emp_no: string; dept: string; status: "ok" | "duplicate"; at: string };

export default function ScanPage() {
  const sel = useScanSelection();
  const [emp, setEmp] = useState<ScanEmp | null>(null);
  const [autoRes, setAutoRes] = useState<CheckResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState("");
  const [auto, setAuto] = useState(false);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<ScanEmp[] | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const last = useRef<{ t: string; at: number }>({ t: "", at: 0 });
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = (e: ScanEmp, r: CheckResult) =>
    setLogs((l) => [{ key: Date.now(), name: e.name, emp_no: e.emp_no, dept: e.department, status: r.status, at: r.checked_at }, ...l].slice(0, 30));

  const reset = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setEmp(null);
    setAutoRes(null);
    setErr("");
    setPaused(false);
  };

  const onScan = async (text: string) => {
    const token = extractToken(text);
    const now = Date.now();
    if (token && last.current.t === token && now - last.current.at < 3000) return; // 동일 QR 연속 인식 무시
    last.current = { t: token || text, at: now };
    setPaused(true);
    setCandidates(null);
    setAutoRes(null);
    setEmp(null);
    setErr("");
    if (!token) {
      setErr("이 시스템에서 발급한 QR코드가 아닙니다.");
      feedback("bad");
      return;
    }
    try {
      const [e] = await api<ScanEmp[]>(`/api/scan?token=${encodeURIComponent(token)}&trainingId=${sel.trainingId}`);
      if (auto && sel.roundId && e.active && e.is_target && !e.attendance) {
        const r = await api<CheckResult>("/api/attendance", { body: { trainingId: sel.trainingId, roundId: sel.roundId, token } });
        feedback(r.status === "ok" ? "ok" : "dup");
        setAutoRes(r);
        addLog(e, r);
        setEmp(e);
        resumeTimer.current = setTimeout(reset, 1800);
      } else {
        if (e.attendance) feedback("dup");
        else if (!e.active || !e.is_target) feedback("bad");
        setEmp(e);
        if (auto && e.attendance) resumeTimer.current = setTimeout(reset, 2500);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "조회 실패");
      feedback("bad");
    }
  };

  const search = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr("");
    setEmp(null);
    setAutoRes(null);
    try {
      const list = await api<ScanEmp[]>(`/api/scan?q=${encodeURIComponent(q.trim())}&trainingId=${sel.trainingId}`);
      if (list.length === 1) {
        setEmp(list[0]);
        setCandidates(null);
      } else setCandidates(list);
      setPaused(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "조회 실패");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>QR 출석체크</h1>
          <div className="muted small">직원 QR을 스캔하거나 사번/이름으로 검색해 참석 처리합니다.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <TrainingPicker sel={sel} />
        <label className="small" style={{ marginTop: 12, cursor: "pointer", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span><b>연속 자동 처리 모드</b> — 스캔 즉시 참석 처리 후 다음 스캔 대기 (대규모 입장 시 권장)</span>
        </label>
      </div>

      <div className="scan-layout">
        <div className="card stack">
          <QrScanner onScan={onScan} paused={paused} />
          <form className="row" onSubmit={search}>
            <input placeholder="사번 또는 이름으로 검색 (QR 미지참 시)" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn">검색</button>
          </form>
        </div>

        <div className="stack">
          {err && (
            <div className="emp-card bad">
              <div className="result-banner bad">✕ {err}</div>
              <button className="btn" style={{ width: "100%" }} onClick={reset}>다음 스캔</button>
            </div>
          )}
          {candidates && !emp && (
            <div className="card">
              <h3>검색 결과 {candidates.length}건</h3>
              {!candidates.length && <div className="muted">일치하는 직원이 없습니다.</div>}
              <div className="stack" style={{ gap: 6 }}>
                {candidates.map((c) => (
                  <button key={c.id} className="btn" style={{ justifyContent: "space-between" }} onClick={() => setEmp(c)}>
                    <span>{c.name} <span className="muted mono">{c.emp_no}</span></span>
                    <span className="muted small">{c.department} {c.attendance ? "· 참석완료" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {emp && (
            <>
              <EmployeeCheckCard
                key={`${emp.id}-${autoRes?.checked_at ?? ""}`}
                emp={emp}
                trainingId={sel.trainingId}
                roundId={sel.roundId}
                autoResult={autoRes}
                onDone={(r, e) => {
                  if (r) addLog(e, r);
                  if (auto) resumeTimer.current = setTimeout(reset, 1500);
                }}
              />
              <button className="btn" onClick={reset}>다음 스캔</button>
            </>
          )}
          {!emp && !err && !candidates && (
            <div className="card empty">QR코드를 카메라에 비춰주세요.<br /><span className="small">휴대폰 기본 카메라로 QR을 찍어도 바로 이 시스템으로 연결됩니다.</span></div>
          )}

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
      </div>
    </>
  );
}
