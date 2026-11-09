"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, DIMS, pct } from "@/lib/client";
import { Bar, Modal, RoundBadge, toast } from "@/components/ui";
import type { Round } from "@/components/TrainingPicker";

type F = { id: number; filename: string; size: number; created_at: string };
type T = { id: number; title: string; description: string; status: string; target: Record<string, string[]>; rounds: Round[]; files: F[]; target_count: number; attended_count: number; created_at: string };
const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.hwp,.hwpx,.txt,.png,.jpg,.jpeg,.gif,.zip";
const mb = (n: number) => (n / 1024 / 1024 < 0.1 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);

async function uploadFiles(tid: number, files: File[]) {
  if (!files.length) return;
  const big = files.find((f) => f.size > 4 * 1024 * 1024);
  if (big) throw new Error(`${big.name}: 파일은 4MB 이하만 업로드할 수 있습니다.`);
  // 요청 크기 제한 때문에 파일별로 나눠 전송
  for (const f of files) {
    const fd = new FormData();
    fd.append("files", f);
    await api(`/api/trainings/${tid}/files`, { form: fd });
  }
}

function FilesBox({ t, onChange }: { t: T; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const up = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try { await uploadFiles(t.id, files); toast(`${files.length}개 파일 업로드 완료`); onChange(); }
    catch (ex) { alert(ex instanceof Error ? ex.message : "업로드 실패"); }
    finally { setBusy(false); }
  };
  const del = async (f: F) => {
    if (!confirm(`'${f.filename}' 파일을 삭제할까요?`)) return;
    await api(`/api/files/${f.id}`, { method: "DELETE" });
    onChange();
  };
  return (
    <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 10 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <b className="small">📎 교육 자료 ({t.files.length})</b>
        <span className="muted small">출석 완료한 직원 화면에 다운로드 링크로 표시됩니다</span>
        <span className="spacer" />
        <label className="btn sm" style={{ cursor: "pointer" }}>
          {busy ? "업로드 중..." : "+ 파일 첨부"}
          <input type="file" multiple accept={ACCEPT} onChange={up} disabled={busy} style={{ display: "none" }} />
        </label>
      </div>
      {!t.files.length && <div className="muted small">첨부된 자료가 없습니다. (PDF·PPT·한글·워드·엑셀·이미지, 파일당 4MB 이하)</div>}
      {t.files.map((f) => (
        <div className="file-row" key={f.id}>
          <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" style={{ flex: 1, wordBreak: "break-all" }}>{f.filename}</a>
          <span className="muted small">{mb(f.size)}</span>
          <button className="btn sm danger" onClick={() => del(f)}>삭제</button>
        </div>
      ))}
    </div>
  );
}
type Meta = Record<string, string[]>;
type RoundForm = { id?: number; edu_date: string; start_time: string; end_time: string; location: string; instructor: string; status: string };

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const emptyRound = (): RoundForm => ({ edu_date: today(), start_time: "09:00", end_time: "10:00", location: "", instructor: "", status: "open" });

export default function TrainingsPage() {
  const [list, setList] = useState<T[] | null>(null);
  const [meta, setMeta] = useState<Meta>({});
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const [roundEdit, setRoundEdit] = useState<{ tid: number; r: RoundForm } | null>(null);

  const load = useCallback(() => api<T[]>("/api/trainings").then(setList), []);
  useEffect(() => { load(); api<Meta>("/api/meta").then(setMeta); }, [load]);

  const setRoundStatus = async (r: Round, status: string) => {
    try { await api(`/api/rounds/${r.id}`, { method: "PATCH", body: { status } }); load(); toast(`${r.round_no}차 상태 변경`); }
    catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };
  const delRound = async (r: Round) => {
    if (!confirm(`${r.round_no}차를 삭제할까요?`)) return;
    try { await api(`/api/rounds/${r.id}`, { method: "DELETE" }); load(); } catch (e) { alert(e instanceof Error ? e.message : "실패"); }
  };
  const toggleTraining = async (t: T) => {
    const next = t.status === "active" ? "closed" : "active";
    if (!confirm(next === "closed" ? "교육을 종료하면 더 이상 출석 처리가 불가합니다. 종료할까요?" : "교육을 다시 진행 상태로 변경할까요?")) return;
    await api(`/api/trainings/${t.id}`, { method: "PATCH", body: { status: next } });
    load();
  };
  const delTraining = async (t: T) => {
    const v = prompt(`'${t.title}' 교육과 모든 참석 기록이 영구 삭제됩니다.\n삭제하려면 '삭제'를 입력하세요.`);
    if (v !== "삭제") return;
    await api(`/api/trainings/${t.id}`, { method: "DELETE" });
    toast("삭제되었습니다.");
    load();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>교육·차수 관리</h1><div className="muted small">교육(예: 2026 하반기 정기안전교육)을 만들고 차수(일자/시간/장소)별로 출석을 접수합니다. 직원은 <b>교육 당일 · 접수중</b>인 차수에만 이번 주 QR로 출석할 수 있으며, 한 교육에 1회만 참석 처리됩니다.</div></div>
        <button className="btn primary" onClick={() => setEdit({ title: "", description: "", target: {}, rounds: [] })}>+ 새 교육</button>
      </div>

      {list && !list.length && <div className="card empty">등록된 교육이 없습니다. [+ 새 교육]을 눌러 시작하세요.</div>}
      {list?.map((t) => {
        const rate = pct(t.attended_count, t.target_count);
        const targetText = DIMS.filter((d) => t.target[d.key]?.length).map((d) => `${d.label}: ${t.target[d.key].join(", ")}`).join(" / ");
        return (
          <div className="card" key={t.id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row">
                  <h2 style={{ margin: 0 }}>{t.title}</h2>
                  {t.status === "active" ? <span className="badge ok">진행중</span> : <span className="badge">종료</span>}
                </div>
                {t.description && <div className="muted small">{t.description}</div>}
                <div className="small" style={{ marginTop: 4 }}>대상: <b>{targetText || "전 직원(재직자)"}</b> · {t.target_count.toLocaleString()}명</div>
              </div>
              <div className="row">
                <Link className="btn sm" href="/dashboard" onClick={() => sessionStorage.setItem("sea.dash.t", String(t.id))}>현황</Link>
                <button className="btn sm" onClick={() => setEdit(t)}>수정</button>
                <button className="btn sm" onClick={() => toggleTraining(t)}>{t.status === "active" ? "종료" : "재개"}</button>
                <button className="btn sm danger" onClick={() => delTraining(t)}>삭제</button>
              </div>
            </div>
            <div className="row" style={{ margin: "12px 0" }}>
              <div style={{ flex: 1, minWidth: 140 }}><Bar value={rate} /></div>
              <span className="small mono"><b>{t.attended_count}</b> / {t.target_count}명 · <b>{rate}%</b></span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>차수</th><th>교육일자</th><th>시간</th><th>장소</th><th>강사</th><th>출석접수</th><th className="num">참석</th><th></th></tr></thead>
                <tbody>
                  {t.rounds.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.round_no}차</b></td>
                      <td className="nowrap">{r.edu_date}</td>
                      <td className="nowrap">{r.start_time}{r.end_time && ` ~ ${r.end_time}`}</td>
                      <td>{r.location}</td>
                      <td>{(r as Round & { instructor?: string }).instructor}</td>
                      <td>
                        <select value={r.status} onChange={(e) => setRoundStatus(r, e.target.value)} style={{ minHeight: 32, padding: "3px 8px", width: "auto" }}>
                          <option value="ready">준비</option><option value="open">접수중</option><option value="closed">마감</option>
                        </select>{" "}
                        <RoundBadge status={r.status} />
                      </td>
                      <td className="num">{r.attended}명</td>
                      <td className="right nowrap">
                        <button className="btn sm" onClick={() => setRoundEdit({ tid: t.id, r: { ...(r as unknown as RoundForm), id: r.id } })}>수정</button>{" "}
                        <button className="btn sm danger" onClick={() => delRound(r)}>삭제</button>
                      </td>
                    </tr>
                  ))}
                  {!t.rounds.length && <tr><td colSpan={8} className="muted">차수가 없습니다. 차수를 추가해야 출석 접수가 가능합니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setRoundEdit({ tid: t.id, r: emptyRound() })}>+ 차수 추가</button>
            <FilesBox t={t} onChange={load} />
          </div>
        );
      })}

      {edit && <TrainingModal meta={meta} init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {roundEdit && <RoundModal tid={roundEdit.tid} init={roundEdit.r} onClose={() => setRoundEdit(null)} onSaved={() => { setRoundEdit(null); load(); }} />}
    </>
  );
}

function TrainingModal({ init, meta, onClose, onSaved }: { init: Partial<T>; meta: Meta; onClose: () => void; onSaved: () => void }) {
  const isNew = !init.id;
  const [title, setTitle] = useState(init.title ?? "");
  const [description, setDesc] = useState(init.description ?? "");
  const [target, setTarget] = useState<Record<string, string[]>>(init.target ?? {});
  const [rounds, setRounds] = useState<RoundForm[]>(isNew ? [emptyRound()] : []);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (dim: string, v: string) => {
    const cur = new Set(target[dim] ?? []);
    cur.has(v) ? cur.delete(v) : cur.add(v);
    setTarget({ ...target, [dim]: [...cur] });
  };
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      if (isNew) {
        const r = await api<{ id: number }>("/api/trainings", { body: { title, description, target, rounds } });
        try { await uploadFiles(r.id, files); }
        catch (ex) { alert(`교육은 저장되었지만 자료 업로드 중 오류가 발생했습니다.\n${ex instanceof Error ? ex.message : ""}`); }
      } else await api(`/api/trainings/${init.id}`, { method: "PATCH", body: { title, description, target } });
      toast("저장되었습니다.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "실패");
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? "새 교육 만들기" : "교육 수정"} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn primary" disabled={busy} onClick={save}>저장</button></>}>
      <div className="stack">
        <label className="field">교육명 *<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 2026년 하반기 전사 정기안전교육" /></label>
        <label className="field">설명<textarea rows={2} value={description} onChange={(e) => setDesc(e.target.value)} /></label>
        <div>
          <div className="small" style={{ fontWeight: 700 }}>교육 대상 (선택 안 하면 전 직원)</div>
          <div className="muted small">항목을 선택하면 해당 조건에 맞는 재직 직원만 대상자로 집계됩니다.</div>
          {DIMS.map((d) => (
            (meta[d.key]?.length ?? 0) > 0 && (
              <div key={d.key} style={{ marginTop: 8 }}>
                <div className="small muted">{d.label}</div>
                <div className="row" style={{ gap: 4 }}>
                  {meta[d.key].map((v) => {
                    const on = target[d.key]?.includes(v);
                    return <button type="button" key={v} className={`btn sm ${on ? "primary" : ""}`} onClick={() => toggle(d.key, v)}>{v}</button>;
                  })}
                </div>
              </div>
            )
          ))}
        </div>
        {isNew && (
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>차수</div>
            {rounds.map((r, i) => (
              <div key={i} className="form-grid" style={{ gridTemplateColumns: "50px repeat(auto-fit, minmax(110px, 1fr)) 40px", alignItems: "end", marginBottom: 6 }}>
                <b style={{ paddingBottom: 10 }}>{i + 1}차</b>
                <input type="date" value={r.edu_date} onChange={(e) => setRounds(rounds.map((x, j) => (j === i ? { ...x, edu_date: e.target.value } : x)))} />
                <input type="time" value={r.start_time} onChange={(e) => setRounds(rounds.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
                <input type="time" value={r.end_time} onChange={(e) => setRounds(rounds.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
                <input placeholder="장소" value={r.location} onChange={(e) => setRounds(rounds.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))} />
                <button type="button" className="btn sm ghost" onClick={() => setRounds(rounds.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setRounds([...rounds, { ...(rounds[rounds.length - 1] ?? emptyRound()) }])}>+ 차수 추가</button>
          </div>
        )}
        {isNew && (
          <label className="field">교육 자료 첨부 (선택 · 여러 개 가능 · 파일당 4MB 이하)
            <input type="file" multiple accept={ACCEPT} onChange={(e) => setFiles([...(e.target.files ?? [])])} />
            {files.length > 0 && <span className="small muted">{files.map((f) => `${f.name} (${mb(f.size)})`).join(", ")}</span>}
          </label>
        )}
        {err && <div className="alert err">{err}</div>}
      </div>
    </Modal>
  );
}

function RoundModal({ tid, init, onClose, onSaved }: { tid: number; init: RoundForm; onClose: () => void; onSaved: () => void }) {
  const [r, setR] = useState<RoundForm>(init);
  const [err, setErr] = useState("");
  const set = (k: keyof RoundForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setR({ ...r, [k]: e.target.value });
  const save = async () => {
    try {
      if (r.id) await api(`/api/rounds/${r.id}`, { method: "PATCH", body: r });
      else await api(`/api/trainings/${tid}/rounds`, { body: r });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "실패"); }
  };
  return (
    <Modal title={r.id ? "차수 수정" : "차수 추가"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={save}>저장</button></>}>
      <div className="form-grid">
        <label className="field">교육일자<input type="date" value={r.edu_date} onChange={set("edu_date")} /></label>
        <label className="field">시작<input type="time" value={r.start_time} onChange={set("start_time")} /></label>
        <label className="field">종료<input type="time" value={r.end_time} onChange={set("end_time")} /></label>
        <label className="field">장소<input value={r.location} onChange={set("location")} /></label>
        <label className="field">강사<input value={r.instructor} onChange={set("instructor")} /></label>
        <label className="field">출석접수
          <select value={r.status} onChange={set("status")}><option value="ready">준비</option><option value="open">접수중</option><option value="closed">마감</option></select>
        </label>
      </div>
      {err && <div className="alert err" style={{ marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}
