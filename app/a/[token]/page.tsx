"use client";
import { use, useEffect, useState } from "react";
import Logo from "@/components/Logo";

type Round = { id: number; round_no: number; start_time: string; end_time: string; location: string; title: string; training_id: number; fileCount: number };
type Result = {
  status: "ok" | "duplicate"; title: string; round_no: number; checked_at: string;
  employee: { name: string; emp_no: string; department: string };
  files: { id: number; filename: string; size: number }[];
};

const fmt = (v: string) => new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const KEY = "sea.self.empno";

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
  const [res, setRes] = useState<Result | null>(null);
  const [choose, setChoose] = useState<number[] | null>(null);

  useEffect(() => {
    try { setEmpNo(localStorage.getItem(KEY) || ""); setAgree(!!localStorage.getItem(KEY)); } catch {}
    fetch(`/api/self?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRounds(d.rounds);
        if (d.rounds.length === 1) setRoundId(d.rounds[0].id);
      })
      .catch((e) => setFatal(e.message || "접속 오류"));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return setErr("개인정보 수집·이용에 동의해야 출석할 수 있습니다.");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, roundId, emp_no: empNo.trim(), name: name.trim() }),
      });
      const d = await r.json();
      if (r.status === 409 && d.status === "choose") {
        setChoose(d.roundIds);
        setRoundId(d.roundIds[0]);
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
              <dt>사번/부서</dt><dd>{res.employee.emp_no} · {res.employee.department}</dd>
            </dl>
            {res.files.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3>📎 교육 자료</h3>
                {res.files.map((f) => (
                  <div className="file-row" key={f.id}>
                    <a href={`/api/files/${f.id}?t=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer" style={{ flex: 1, wordBreak: "break-all" }}>{f.filename}</a>
                    <span className="muted small">{f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))}KB` : `${(f.size / 1024 / 1024).toFixed(1)}MB`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {rounds && !res && !rounds.length && (
          <div className="alert warn">현재 출석 접수 중인 교육이 없습니다.<br />교육 시작 시간에 다시 스캔하거나 교육 담당자에게 문의하세요.</div>
        )}

        {rounds && !res && rounds.length > 0 && (
          <form className="card stack" onSubmit={submit}>
            <h2 style={{ margin: 0 }}>안전교육 출석</h2>
            <div className="stack" style={{ gap: 8 }}>
              {rounds.length > 1 && (
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
            <label className="field">사번<input value={empNo} onChange={(e) => setEmpNo(e.target.value)} inputMode="text" autoCapitalize="characters" autoComplete="off" required /></label>
            <label className="field">이름<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
            <label className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
              <span>안전교육 이수 확인을 위해 사번·성명·출석시각·접속기기 정보를 수집·이용하는 데 동의합니다. (보유기간: 법정 교육기록 보존기간)</span>
            </label>
            {err && <div className="alert err">{err}</div>}
            <button className="btn primary xl" disabled={busy}>{busy ? "처리 중..." : "출석하기"}</button>
            <p className="small muted" style={{ margin: 0 }}>※ 본인 휴대폰으로만 출석하세요. 한 휴대폰으로 여러 명이 출석할 수 없습니다.</p>
          </form>
        )}
      </main>
    </div>
  );
}
