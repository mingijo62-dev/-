"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, DIMS, download, fmtTime, pct } from "@/lib/client";
import { Bar, Pager, RoundBadge, toast } from "@/components/ui";
import type { TrainingItem } from "@/components/TrainingPicker";

type Item = { key: string; total: number; attended: number };
type Stats = {
  training: { id: number; title: string; status: string; target: Record<string, string[]> };
  total: number; attended: number; absent: number; rate: number;
  breakdown: Record<string, Item[]>;
  rounds: { id: number; round_no: number; edu_date: string; start_time: string; end_time: string; location: string; status: string; attended: number }[];
  recent: { emp_no: string; name: string; department: string; checked_at: string; method: string; round_no: number }[];
  at: string;
};
type Row = { id: number; emp_no: string; name: string; shift_type: string; department: string; work_group: string; position: string; checked_at: string | null; method: string | null; round_no: number | null; checked_by_name: string | null };

export default function Dashboard() {
  const [trainings, setTrainings] = useState<TrainingItem[] | null>(null);
  const [tid, setTid] = useState(0);
  const [s, setS] = useState<Stats | null>(null);
  const [live, setLive] = useState(true);
  const [err, setErr] = useState("");

  // list state
  const [status, setStatus] = useState<"" | "attended" | "absent">("");
  const [filter, setFilter] = useState<{ dim: string; val: string; label: string } | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ rows: Row[]; total: number; size: number } | null>(null);

  useEffect(() => {
    api<TrainingItem[]>("/api/trainings").then((l) => {
      setTrainings(l);
      const saved = Number(sessionStorage.getItem("sea.dash.t")) || 0;
      setTid(l.find((t) => t.id === saved)?.id ?? l.find((t) => t.status === "active")?.id ?? l[0]?.id ?? 0);
    }).catch((e) => setErr(e.message));
  }, []);

  const loadStats = useCallback(async () => {
    if (!tid) return;
    try {
      setS(await api<Stats>(`/api/dashboard?trainingId=${tid}`));
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    }
  }, [tid]);

  const loadList = useCallback(async () => {
    if (!tid) return;
    const p = new URLSearchParams({ trainingId: String(tid), page: String(page), size: "30" });
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    if (filter) { p.set("dim", filter.dim); p.set("val", filter.val); }
    try { setList(await api(`/api/dashboard/list?${p}`)); } catch {}
  }, [tid, page, status, q, filter]);

  useEffect(() => { if (tid) sessionStorage.setItem("sea.dash.t", String(tid)); loadStats(); }, [tid, loadStats]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (!live || !tid) return;
    const h = setInterval(() => {
      if (document.visibilityState === "visible") { loadStats(); loadList(); }
    }, 5000);
    return () => clearInterval(h);
  }, [live, tid, loadStats, loadList]);

  const cancel = async (r: Row) => {
    if (!confirm(`${r.name}(${r.emp_no}) 님의 참석 기록을 취소할까요?`)) return;
    try {
      await api("/api/attendance", { method: "DELETE", body: { trainingId: tid, employeeId: r.id } });
      toast("참석이 취소되었습니다.");
      loadStats(); loadList();
    } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };
  const manual = async (r: Row) => {
    const open = s?.rounds.filter((x) => x.status === "open") ?? [];
    if (!open.length) return alert("접수 중(open)인 차수가 없습니다. [교육·차수]에서 차수 상태를 '접수중'으로 변경하세요.");
    let round = open[0];
    if (open.length > 1) {
      const n = prompt(`수기 처리할 차수 번호를 입력하세요 (${open.map((x) => x.round_no).join(", ")})`, String(open[0].round_no));
      const f = open.find((x) => String(x.round_no) === n?.trim());
      if (!f) return;
      round = f;
    } else if (!confirm(`${r.name}(${r.emp_no}) 님을 ${round.round_no}차 참석으로 수기 처리할까요?`)) return;
    try {
      await api("/api/attendance", { body: { trainingId: tid, roundId: round.id, employeeId: r.id } });
      toast("수기 참석 처리되었습니다.");
      loadStats(); loadList();
    } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };

  const exportXlsx = async () => {
    try { await download(`/api/export?trainingId=${tid}`); } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };

  if (trainings && !trainings.length) {
    return (
      <div className="card empty">
        <h2>등록된 교육이 없습니다</h2>
        <p>먼저 직원을 등록하고 교육과 차수를 만들어 주세요.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/employees">직원 등록</Link>
          <Link className="btn primary" href="/trainings">교육 만들기</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>참석 현황판</h1>
          <div className="small muted">
            {live ? <><span className="live-dot" />실시간 (5초 자동갱신)</> : "자동갱신 꺼짐"}
            {s && <> · 기준 {fmtTime(s.at, false)}</>}
          </div>
        </div>
        <div className="row">
          <select value={tid} onChange={(e) => { setTid(Number(e.target.value)); setPage(1); setFilter(null); }} style={{ width: "auto", maxWidth: 320 }}>
            {trainings?.map((t) => <option key={t.id} value={t.id}>{t.status === "closed" ? "[종료] " : ""}{t.title}</option>)}
          </select>
          <button className="btn" onClick={() => setLive(!live)}>{live ? "⏸ 갱신중지" : "▶ 자동갱신"}</button>
          <button className="btn primary" onClick={exportXlsx} disabled={!tid}>⬇ 엑셀 다운로드</button>
        </div>
      </div>
      {err && <div className="alert err" style={{ marginBottom: 12 }}>{err}</div>}

      {s && (
        <>
          <div className="grid grid-4">
            <div className="card kpi kpi-brand"><div className="label">교육 대상자</div><div className="value">{s.total.toLocaleString()}<small>명</small></div></div>
            <div className="card kpi ok"><div className="label">참석</div><div className="value">{s.attended.toLocaleString()}<small>명</small></div></div>
            <div className="card kpi bad"><div className="label">미참석</div><div className="value">{s.absent.toLocaleString()}<small>명</small></div></div>
            <div className="card kpi"><div className="label">참석률</div><div className="value">{s.rate}<small>%</small></div><Bar value={s.rate} lg /></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            {DIMS.map((d) => (
              <div className="card" key={d.key}>
                <h2>{d.label}별 현황</h2>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {(s.breakdown[d.key] ?? []).map((it) => {
                    const r = pct(it.attended, it.total);
                    return (
                      <div className="bd-row" key={it.key} title="클릭하면 아래 명단이 필터링됩니다"
                        onClick={() => { setFilter({ dim: d.key, val: it.key, label: `${d.label}: ${it.key}` }); setPage(1); document.getElementById("list")?.scrollIntoView({ behavior: "smooth" }); }}>
                        <span className="k">{it.key}</span>
                        <Bar value={r} />
                        <span className="v"><b>{it.attended}</b>/{it.total}명 · <b>{r}%</b></span>
                      </div>
                    );
                  })}
                  {!s.breakdown[d.key]?.length && <div className="muted small">데이터 없음</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2>차수별 참석</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>차수</th><th>일시</th><th>장소</th><th>상태</th><th className="num">참석</th></tr></thead>
                  <tbody>
                    {s.rounds.map((r) => (
                      <tr key={r.id}>
                        <td><b>{r.round_no}차</b></td>
                        <td className="nowrap">{r.edu_date} {r.start_time}{r.end_time && `~${r.end_time}`}</td>
                        <td>{r.location}</td>
                        <td><RoundBadge status={r.status} /></td>
                        <td className="num"><b>{r.attended}</b>명</td>
                      </tr>
                    ))}
                    {!s.rounds.length && <tr><td colSpan={5} className="muted">차수가 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h2>최근 참석 처리</h2>
              {!s.recent.length && <div className="muted small">아직 참석자가 없습니다.</div>}
              {s.recent.map((r, i) => (
                <div key={i} className="row small" style={{ padding: "5px 0", borderBottom: "1px dashed var(--line)" }}>
                  <span className="badge brand">{r.round_no}차</span><b>{r.name}</b><span className="muted mono">{r.emp_no}</span>
                  <span className="muted">{r.department}</span><span className="spacer" />
                  <span className="muted mono">{fmtTime(r.checked_at, false)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="card" id="list" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>대상자 명단</h2>
          <form className="row" onSubmit={(e) => { e.preventDefault(); setPage(1); loadList(); }}>
            <input placeholder="사번/이름 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
            <button className="btn sm">검색</button>
          </form>
        </div>
        <div className="tabs" style={{ marginTop: 8 }}>
          {([["", "전체"], ["attended", "참석"], ["absent", "미참석"]] as const).map(([k, l]) => (
            <button key={k} className={status === k ? "active" : ""} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        {filter && (
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="badge brand">{filter.label}</span>
            <button className="btn sm ghost" onClick={() => setFilter(null)}>필터 해제 ✕</button>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>사번</th><th>이름</th><th>교대/주전</th><th>부서</th><th>근무조</th><th>직책</th><th>상태</th><th>참석시간</th><th></th></tr></thead>
            <tbody>
              {list?.rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.emp_no}</td>
                  <td className="nowrap"><b>{r.name}</b></td>
                  <td>{r.shift_type}</td><td>{r.department}</td><td>{r.work_group}</td><td>{r.position}</td>
                  <td>{r.checked_at ? <span className="badge ok">{r.round_no}차 참석</span> : <span className="badge bad">미참석</span>}</td>
                  <td className="small nowrap mono">{r.checked_at ? <>{fmtTime(r.checked_at)} <span className="muted">{r.method === "manual" ? "수기" : r.method === "self" ? "QR자가" : "QR"}{r.checked_by_name ? `·${r.checked_by_name}` : ""}</span></> : ""}</td>
                  <td className="right">
                    {r.checked_at ? <button className="btn sm danger" onClick={() => cancel(r)}>취소</button>
                      : <button className="btn sm" onClick={() => manual(r)}>수기처리</button>}
                  </td>
                </tr>
              ))}
              {list && !list.rows.length && <tr><td colSpan={9} className="empty">해당하는 인원이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        {list && <Pager page={page} total={list.total} size={list.size} onPage={setPage} />}
        {list && <div className="small muted center">총 {list.total.toLocaleString()}명</div>}
      </div>
    </>
  );
}

