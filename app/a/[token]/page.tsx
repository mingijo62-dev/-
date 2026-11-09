"use client";
import { use, useEffect, useState } from "react";
import Logo from "@/components/Logo";

type Round = { id: number; round_no: number; start_time: string; end_time: string; location: string; title: string; training_id: number; fileCount: number };
type Emp = { name: string; emp_no: string; shift_type: string; department: string; work_group: string; position: string; is_supervisor?: boolean };
type Result = {
  status: "ok" | "duplicate"; title: string; round_no: number; checked_at: string;
  employee: Emp;
  files: { id: number; filename: string; size: number }[];
};

const fmt = (v: string) => new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);
const KEY = "sea.self.empno";

/** 본인 정보 표 (구분·부서·근무조·직책으로 동명이인 확인) */
function EmpInfo({ e }: { e: Emp }) {
  return (
    <dl className="emp-meta">
      <dt>사번</dt><dd>{e.emp_no}</dd>
      <dt>성명</dt><dd>{e.name}</dd>
      <dt>구분</dt><dd>{e.shift_type || "-"}</dd>
      <dt>부서</dt><dd>{e.department || "-"}</dd>
      <dt>근무조</dt><dd>{e.work_group || "-"}</dd>
      <dt>직책</dt><dd>{e.position || "-"}{e.is_supervisor && <> <span className="badge brand">관리감독자</span></>}</dd>
    </dl>
  );
}

/** 직원 자가 출석 화면 (주간 공용 QR 스캔 후 진입, 로그인 불필요) */
export default function SelfCheckIn({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [fatal, setFatal] = useState("");
  const [roundId, setRoundId] = useState(0);
  const [empNo, setEmpNo] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmEmp, setConfirmEmp] = useState<Emp | null>(null);
  const [choose, setChoose] = useState<number[] | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v) { setEmpNo(v); setAgree(true); } } catch {}
    fetch(`/api/self?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRounds(d.rounds);
        if (d.rounds.length === 1) setRoundId(d.rounds[0].id);
      })
      .catch((e) => setFatal(e.message || "접속 오류"));
  }, [token]);

  const post = async (step: "find" | "check") => {
    const r = await fetch("/api/self", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, step, roundId, emp_no: empNo.trim(), name: name.trim() }),
    });
    return { r, d: await r.json() };
  };

  // 1단계: 사번·이름 확인 → 본인 정보 표시
  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return setErr("개인정보 수집·이용에 동의해야 출석할 수 있습니다.");
    setBusy(true);
    setErr("");
    try {
      const { r, d } = await post("find");
      if (!r.ok) throw new Error(d.error);
      setConfirmEmp(d.employee);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "확인 실패");
    } finally {
      setBusy(false);
    }
  };

  // 2단계: 본인 확인 후 출석
  const check = async () => {
    setBusy(true);
    setErr("");
    try {
      const { r, d } = await post("check");
      if (r.status === 409 && d.status === "choose") {
        setChoose(d.roundIds);
        setRoundId(d.roundIds[0]);
        setConfirmEmp(null);
        throw new Error(d.message);
      }
      if (!r.ok) throw new Error(d.error);
      setRes(d);
      try { localStorage.setItem(KEY, empNo.trim()); } catch {}
      try { navigator.vibrate?.(d.status === "ok" ? 150 : [80, 60, 80]); } catch {}
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "출석 처리 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="self-wrap">
      <header className="self-head"><div className="inner"><Logo /><span style={{ fontWeight: 700 }}>안전교육 출석</span></div></header>
      <main className="self-body stack">
        {fatal && <div className="emp-card bad"><div className="result-banner bad">QR코드 오류</div><p>{fatal}</p></div>}
        {!fatal && !rounds && <p className="muted center">확인 중...</p>}

        {res && (
          <div className={`emp-card ${res.status === "ok" ? "ok" : "dup"}`}>
            <div className={`result-banner ${res.status === "ok" ? "ok" : "dup"}`}>
              {res.status === "ok" ? "✓ 출석이 완료되었습니다" : "이미 출석 처리되어 있습니다"}
            </div>
            <div className="emp-name">{res.employee.name} 님</div>
            <dl className="emp-meta">
              <dt>교육</dt><dd>{res.title} · {res.round_no}차</dd>
              <dt>출석시간</dt><dd>{fmt(res.checked_at)}</dd>
            </dl>
            <EmpInfo e={res.employee} />
            {res.files.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3>📎 교육 자료</h3>
                {res.files.map((f) => (
                  <div className="file-row" key={f.id}>
                    <a href={`/api/files/${f.id}?t=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer" style={{ flex: 1, wordBreak: "break-all" }}>{f.filename}</a>
                    <span className="muted small">{size(f.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {rounds && !res && !rounds.length && (
          <div className="alert warn">현재 출석 접수 중인 교육이 없습니다.<br />교육 시작 시간에 다시 스캔하거나 교육 담당자에게 문의하세요.</div>
        )}

        {/* 2단계: 본인 확인 */}
        {rounds && !res && confirmEmp && (
          <div className="emp-card">
            <h2 style={{ marginTop: 0 }}>본인 정보가 맞습니까?</h2>
            <p className="small muted" style={{ marginTop: 0 }}>구분·부서·근무조·직책이 본인과 같은지 확인하세요. 다르면 사번을 다시 확인하세요.</p>
            <EmpInfo e={confirmEmp} />
            {err && <div className="alert err" style={{ marginTop: 12 }}>{err}</div>}
            <button className="btn primary xl" style={{ marginTop: 16 }} disabled={busy} onClick={check}>{busy ? "처리 중..." : "네, 본인이 맞습니다 · 출석하기"}</button>
            <button className="btn" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => { setConfirmEmp(null); setErr(""); }}>아니요, 다시 입력</button>
          </div>
        )}

        {/* 1단계: 사번·이름 입력 */}
        {rounds && !res && !confirmEmp && rounds.length > 0 && (
          <form className="card stack" onSubmit={find}>
            <h2 style={{ margin: 0 }}>안전교육 출석</h2>
            <div className="stack" style={{ gap: 8 }}>
              {rounds.length > 1 && !choose && (
                <label className={`round-opt${roundId === 0 ? " on" : ""}`}>
                  <input type="radio" name="round" checked={roundId === 0} onChange={() => setRoundId(0)} style={{ marginTop: 4 }} />
                  <span><b>자동 선택</b> <span className="badge ok">권장</span><br /><span className="small muted">사번으로 본인이 대상인 교육을 찾아 출석합니다</span></span>
                </label>
              )}
              {rounds.filter((r) => !choose || choose.includes(r.id)).map((r) => (
                <label key={r.id} className={`round-opt${roundId === r.id ? " on" : ""}`}>
                  <input type="radio" name="round" checked={roundId === r.id} onChange={() => setRoundId(r.id)} style={{ marginTop: 4 }} />
                  <span>
                    <b>{r.title}</b> <span className="badge brand">{r.round_no}차</span><br />
                    <span className="small muted">{r.start_time}{r.end_time && ` ~ ${r.end_time}`} {r.location}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="field">사번<input value={empNo} onChange={(e) => setEmpNo(e.target.value)} autoCapitalize="characters" autoComplete="off" required /></label>
            <label className="field">성명<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            <label className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
              <span>안전교육 이수 확인을 위해 사번·성명·소속·출석시각·접속기기 정보를 수집·이용하는 데 동의합니다. (보유기간: 법정 교육기록 보존기간)</span>
            </label>
            {err && <div className={`alert ${choose ? "warn" : "err"}`}>{err}</div>}
            <button className="btn primary xl" disabled={busy}>{busy ? "확인 중..." : "다음 (본인 확인)"}</button>
            <p className="small muted" style={{ margin: 0 }}>※ 본인 휴대폰으로만 출석하세요. 한 휴대폰으로 여러 명이 출석할 수 없습니다.</p>
          </form>
        )}
      </main>
    </div>
  );
}
