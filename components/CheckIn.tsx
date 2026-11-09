"use client";
import { useState } from "react";
import { api, fmtTime } from "@/lib/client";

export type ScanEmp = {
  id: number; emp_no: string; name: string; shift_type: string; department: string; work_group: string; position: string;
  active: boolean; is_target: boolean; qr_token?: string;
  attendance: null | { checked_at: string; round_no: number; method: string; checked_by_name: string | null };
};

export type CheckResult = { status: "ok" | "duplicate"; checked_at: string; round_no: number };

export function feedback(kind: "ok" | "dup" | "bad") {
  try {
    navigator.vibrate?.(kind === "ok" ? 120 : [80, 60, 80, 60, 80]);
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = kind === "ok" ? 880 : 300;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (kind === "ok" ? 0.15 : 0.35));
  } catch {}
}

export function EmployeeCheckCard({
  emp, trainingId, roundId, onDone, autoResult,
}: {
  emp: ScanEmp; trainingId: number; roundId: number; onDone?: (r: CheckResult | null, emp: ScanEmp) => void; autoResult?: CheckResult | null;
}) {
  const [result, setResult] = useState<CheckResult | null>(autoResult ?? null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const already = result?.status === "duplicate" || (!result && emp.attendance);
  const success = result?.status === "ok";
  const blocked = !emp.active || !emp.is_target;
  const kind = success ? "ok" : already ? "dup" : blocked || err ? "bad" : "";

  const check = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<CheckResult>("/api/attendance", {
        body: emp.qr_token ? { trainingId, roundId, token: emp.qr_token } : { trainingId, roundId, employeeId: emp.id },
      });
      setResult(r);
      feedback(r.status === "ok" ? "ok" : "dup");
      onDone?.(r, emp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리 실패");
      feedback("bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`emp-card ${kind}`}>
      {success && <div className="result-banner ok">✓ 참석 처리 완료 · {fmtTime(result!.checked_at, false)}</div>}
      {already && (
        <div className="result-banner dup">
          ⚠ 이미 참석 처리됨 · {result?.round_no ?? emp.attendance?.round_no}차 {fmtTime(result?.checked_at ?? emp.attendance?.checked_at, true)}
        </div>
      )}
      {!success && !already && !emp.active && <div className="result-banner bad">비활성(퇴사/휴직) 직원입니다</div>}
      {!success && !already && emp.active && !emp.is_target && <div className="result-banner bad">이 교육의 대상자가 아닙니다</div>}
      <div className="row" style={{ alignItems: "baseline" }}>
        <span className="emp-name">{emp.name}</span>
        <span className="muted mono">{emp.emp_no}</span>
      </div>
      <dl className="emp-meta">
        <dt>교대/주전</dt><dd>{emp.shift_type || "-"}</dd>
        <dt>부서</dt><dd>{emp.department || "-"}</dd>
        <dt>근무조</dt><dd>{emp.work_group || "-"}</dd>
        <dt>직책</dt><dd>{emp.position || "-"}</dd>
        {emp.attendance?.checked_by_name && already && (<><dt>처리자</dt><dd>{emp.attendance.checked_by_name}</dd></>)}
      </dl>
      {err && <div className="alert err" style={{ marginTop: 12 }}>{err}</div>}
      {!success && !already && !blocked && (
        <button className="btn primary xl" style={{ marginTop: 16 }} disabled={busy || !roundId} onClick={check}>
          {busy ? "처리 중..." : roundId ? "참석 처리" : "접수 중인 차수를 선택하세요"}
        </button>
      )}
    </div>
  );
}
