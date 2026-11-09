"use client";
import { useCallback, useEffect, useState } from "react";
import { api, DIMS, download } from "@/lib/client";
import { Modal, Pager, toast } from "@/components/ui";

type Emp = { id: number; emp_no: string; name: string; shift_type: string; department: string; work_group: string; position: string; active: boolean; is_supervisor: boolean };
type Meta = Record<string, string[]>;
const EMPTY = { emp_no: "", name: "", shift_type: "주전", department: "", work_group: "", position: "", active: true, is_supervisor: false };

export default function EmployeesPage() {
  const [meta, setMeta] = useState<Meta>({});
  const [f, setF] = useState<Record<string, string>>({ q: "", shift_type: "", department: "", work_group: "", position: "", active: "1", supervisor: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: Emp[]; total: number; size: number } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<Partial<Emp> | null>(null);
  const [importing, setImporting] = useState(false);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [f]);

  const load = useCallback(async () => {
    const p = params();
    p.set("page", String(page));
    p.set("size", "50");
    setData(await api(`/api/employees?${p}`));
  }, [params, page]);
  const loadMeta = () => api<Meta>("/api/meta").then(setMeta);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMeta(); }, []);

  const bulk = async (action: string, label: string) => {
    if (!sel.size) return alert("직원을 선택하세요.");
    if (!confirm(`선택한 ${sel.size}명을 ${label}할까요?${action === "delete" ? "\n(참석 기록도 함께 삭제됩니다)" : ""}`)) return;
    const r = await api<{ count: number }>("/api/employees/bulk", { body: { action, ids: [...sel] } });
    toast(`${r.count}명 ${label} 완료`);
    setSel(new Set());
    load(); loadMeta();
  };
  const del = async (e: Emp) => {
    if (!confirm(`${e.name}(${e.emp_no}) 을(를) 삭제할까요? 참석 기록도 함께 삭제됩니다.\n퇴사자는 '비활성' 처리를 권장합니다.`)) return;
    await api(`/api/employees/${e.id}`, { method: "DELETE" });
    toast("삭제되었습니다.");
    load();
  };
  const allChecked = !!data?.rows.length && data.rows.every((r) => sel.has(r.id));

  return (
    <>
      <div className="page-head">
        <div><h1>직원 관리</h1><div className="muted small">출석 시 직원이 입력한 사번·이름을 이 명단과 대조합니다. 교육 대상자 집계 기준이 되므로 최신 명단을 유지하세요.</div></div>
        <div className="row">
          <button className="btn" onClick={() => download("/api/employees/template").catch((e) => alert(e.message))}>양식 다운로드</button>
          <button className="btn" onClick={() => setImporting(true)}>⬆ 엑셀 업로드</button>
          <button className="btn primary" onClick={() => setEdit({ ...EMPTY })}>+ 직원 등록</button>
        </div>
      </div>

      <div className="card">
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
          <label className="field">검색<input placeholder="사번/이름" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
          {DIMS.map((d) => (
            <label className="field" key={d.key}>{d.label}
              <select value={f[d.key]} onChange={(e) => { setF({ ...f, [d.key]: e.target.value }); setPage(1); }}>
                <option value="">전체</option>
                {(meta[d.key] ?? []).map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          ))}
          <label className="field">상태
            <select value={f.active} onChange={(e) => { setF({ ...f, active: e.target.value }); setPage(1); }}>
              <option value="">전체</option><option value="1">재직(활성)</option><option value="0">비활성</option>
            </select>
          </label>
          <label className="field">관리감독자
            <select value={f.supervisor} onChange={(e) => { setF({ ...f, supervisor: e.target.value }); setPage(1); }}>
              <option value="">전체</option><option value="1">관리감독자만</option>
            </select>
          </label>
        </form>

        <div className="row" style={{ margin: "14px 0 8px" }}>
          <b>총 {data?.total.toLocaleString() ?? "-"}명</b>
          <span className="spacer" />
          {sel.size > 0 && <span className="small muted">{sel.size}명 선택</span>}
          <button className="btn sm" onClick={() => bulk("deactivate", "비활성")}>비활성</button>
          <button className="btn sm" onClick={() => bulk("activate", "활성")}>활성</button>
          <button className="btn sm danger" onClick={() => bulk("delete", "삭제")}>삭제</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} onChange={() => {
                  const n = new Set(sel);
                  data?.rows.forEach((r) => (allChecked ? n.delete(r.id) : n.add(r.id)));
                  setSel(n);
                }} /></th>
                <th>사번</th><th>이름</th><th>구분</th><th>부서</th><th>근무조</th><th>직책</th><th>관리감독자</th><th>상태</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((e) => (
                <tr key={e.id} style={e.active ? undefined : { opacity: 0.55 }}>
                  <td><input type="checkbox" checked={sel.has(e.id)} onChange={() => { const n = new Set(sel); n.has(e.id) ? n.delete(e.id) : n.add(e.id); setSel(n); }} /></td>
                  <td className="mono">{e.emp_no}</td><td className="nowrap"><b>{e.name}</b></td>
                  <td>{e.shift_type}</td><td>{e.department}</td><td>{e.work_group}</td><td>{e.position}</td>
                  <td>{e.is_supervisor && <span className="badge brand">관리감독자</span>}</td>
                  <td>{e.active ? <span className="badge ok">재직</span> : <span className="badge">비활성</span>}</td>
                  <td className="right nowrap">
                    <button className="btn sm" onClick={() => setEdit(e)}>수정</button>{" "}
                    <button className="btn sm danger" onClick={() => del(e)}>삭제</button>
                  </td>
                </tr>
              ))}
              {data && !data.rows.length && <tr><td colSpan={10} className="empty">직원이 없습니다. [직원 등록] 또는 [엑셀 업로드]로 추가하세요.</td></tr>}
            </tbody>
          </table>
        </div>
        {data && <Pager page={page} total={data.total} size={data.size} onPage={setPage} />}
      </div>

      {edit && <EmpModal init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); loadMeta(); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { load(); loadMeta(); }} />}
    </>
  );
}

function EmpModal({ init, onClose, onSaved }: { init: Partial<Emp>; onClose: () => void; onSaved: () => void }) {
  const [e, setE] = useState<Partial<Emp>>(init);
  const [err, setErr] = useState("");
  const set = (k: keyof Emp) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setE({ ...e, [k]: ev.target.value });
  const save = async () => {
    try {
      if (e.id) await api(`/api/employees/${e.id}`, { method: "PATCH", body: e });
      else await api("/api/employees", { body: e });
      toast("저장되었습니다.");
      onSaved();
    } catch (ex) { setErr(ex instanceof Error ? ex.message : "실패"); }
  };
  return (
    <Modal title={e.id ? "직원 정보 수정" : "직원 등록"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn primary" onClick={save}>저장</button></>}>
      <div className="form-grid">
        <label className="field">사번 *<input value={e.emp_no} onChange={set("emp_no")} /></label>
        <label className="field">이름 *<input value={e.name} onChange={set("name")} /></label>
        <label className="field">구분 (교대/주전)
          <select value={e.shift_type} onChange={set("shift_type")}><option>주전</option><option>교대</option><option value="">미지정</option></select>
        </label>
        <label className="field">부서<input value={e.department} onChange={set("department")} /></label>
        <label className="field">근무조<input value={e.work_group} onChange={set("work_group")} placeholder="예) A조" /></label>
        <label className="field">직책<input value={e.position} onChange={set("position")} /></label>
        <label className="field">관리감독자
          <select value={e.is_supervisor ? "1" : "0"} onChange={(ev) => setE({ ...e, is_supervisor: ev.target.value === "1" })}>
            <option value="0">아니오 (일반 직원)</option><option value="1">예 — 모든 교육 출석 인정</option>
          </select>
        </label>
        {e.id && (
          <label className="field">상태
            <select value={e.active ? "1" : "0"} onChange={(ev) => setE({ ...e, active: ev.target.value === "1" })}><option value="1">재직(활성)</option><option value="0">비활성(퇴사/휴직)</option></select>
          </label>
        )}
      </div>
      {err && <div className="alert err" style={{ marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

const IMPORT_FIELDS = [
  { key: "emp_no", label: "사번", required: true },
  { key: "name", label: "성명", required: true },
  { key: "shift_type", label: "구분(교대/주전)" },
  { key: "department", label: "부서" },
  { key: "work_group", label: "근무조" },
  { key: "position", label: "직책" },
  { key: "is_supervisor", label: "관리감독자" },
] as const;
type Preview = { sheets: string[]; sheet: string; headerRow: number; headers: { col: number; text: string }[]; mapping: Record<string, number>; sample: string[][]; dataRows: number };
const colName = (c: number) => { let s = ""; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

/** 회사 보유 엑셀을 그대로 올려 등록: 미리보기 → 열 자동 매칭 확인 → 등록 */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [deact, setDeact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ inserted: number; updated: number; deactivated: number; supervisors: number | null; errors: string[]; errorCount: number } | null>(null);
  const [err, setErr] = useState("");

  const preview = async (f: File, sheet?: string, headerRow?: number) => {
    setBusy(true); setErr(""); setRes(null);
    const fd = new FormData();
    fd.set("file", f);
    fd.set("mode", "preview");
    if (sheet) fd.set("sheet", sheet);
    if (headerRow) fd.set("headerRow", String(headerRow));
    try {
      const d = await api<Preview>("/api/employees/import", { form: fd });
      setPv(d);
      setMapping(d.mapping);
    } catch (e) { setPv(null); setErr(e instanceof Error ? e.message : "파일 분석 실패"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!file || !pv) return;
    if (!mapping.emp_no || !mapping.name) return setErr("'사번'과 '성명' 열을 지정하세요.");
    if (deact && !confirm("업로드 파일에 없는 기존 직원은 모두 '비활성' 처리됩니다. 계속할까요?")) return;
    setBusy(true); setErr(""); setRes(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", "import");
    fd.set("sheet", pv.sheet);
    fd.set("headerRow", String(pv.headerRow));
    fd.set("mapping", JSON.stringify(mapping));
    if (deact) fd.set("deactivateMissing", "1");
    try { setRes(await api("/api/employees/import", { form: fd })); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "실패"); }
    finally { setBusy(false); }
  };

  const ready = !!pv && !!mapping.emp_no && !!mapping.name;
  return (
    <Modal title="엑셀로 직원 일괄 등록" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>닫기</button>
        <button className="btn primary" disabled={!ready || busy || !!res} onClick={submit}>{busy ? "처리 중..." : pv ? `${pv.dataRows.toLocaleString()}행 등록하기` : "등록하기"}</button></>}>
      <div className="stack">
        <div className="alert info small">
          <b>회사에서 관리하는 엑셀 파일을 그대로 올리세요.</b> 시트·제목 줄·열 순서가 달라도 자동으로 찾아 맞춥니다.<br />
          필수: <b>사번, 성명</b> (직원이 출석할 때 입력) · 선택: 구분, 부서, 근무조, 직책, 관리감독자(Y 표시)<br />
          파일 형식: .xlsx, .csv (예전 .xls는 엑셀에서 .xlsx로 다시 저장해 주세요)
        </div>
        <input type="file" accept=".xlsx,.xlsm,.csv,.xls" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPv(null); if (f) preview(f); }} />
        {busy && !pv && <div className="muted small">파일 분석 중...</div>}

        {pv && (
          <>
            <div className="form-grid">
              <label className="field">시트
                <select value={pv.sheet} onChange={(e) => file && preview(file, e.target.value)}>
                  {pv.sheets.map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              <label className="field">제목(헤더) 행 번호
                <input type="number" min={1} value={pv.headerRow} onChange={(e) => file && Number(e.target.value) > 0 && preview(file, pv.sheet, Number(e.target.value))} />
              </label>
            </div>

            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>열 지정 <span className="muted">(자동으로 찾은 결과 · 틀리면 바꿔주세요)</span></div>
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {IMPORT_FIELDS.map((f) => (
                  <label key={f.key} className="field">
                    <span>{f.label}{"required" in f && f.required && <span style={{ color: "var(--bad)" }}> *</span>}</span>
                    <select value={mapping[f.key] ?? 0} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                      style={"required" in f && f.required && !mapping[f.key] ? { borderColor: "var(--bad)" } : undefined}>
                      <option value={0}>{"required" in f && f.required ? "— 선택하세요 —" : "(없음 · 기존값 유지)"}</option>
                      {pv.headers.map((h) => <option key={h.col} value={h.col}>{colName(h.col)}열{h.text ? ` · ${h.text}` : ""}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>미리보기 <span className="muted">(위 지정대로 읽은 첫 5명 · 전체 {pv.dataRows.toLocaleString()}행)</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr>{IMPORT_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>
                    {pv.sample.map((row, i) => (
                      <tr key={i}>{IMPORT_FIELDS.map((f) => <td key={f.key} className="small">{mapping[f.key] ? row[mapping[f.key] - 1] : <span className="muted">-</span>}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ready && <div className="alert warn small" style={{ marginTop: 8 }}>사번과 성명 열을 지정해야 등록할 수 있습니다. 파일에 사번 열이 없다면 사번을 추가한 뒤 다시 올려주세요.</div>}
            </div>

            <label className="row small"><input type="checkbox" checked={deact} onChange={(e) => setDeact(e.target.checked)} /> 파일에 없는 기존 직원은 비활성(퇴사) 처리 — 전체 명단을 새로 올릴 때 사용</label>
          </>
        )}
        {err && <div className="alert err">{err}</div>}
        {res && (
          <div className="alert ok">
            ✓ 등록 완료 — 신규 <b>{res.inserted}</b>명 · 갱신 <b>{res.updated}</b>명{res.deactivated ? <> · 비활성 <b>{res.deactivated}</b>명</> : null}
            {res.supervisors !== null && <> · 관리감독자 <b>{res.supervisors}</b>명</>}
            {res.errorCount > 0 && <div className="small" style={{ color: "var(--bad)", marginTop: 6 }}>건너뛴 행 {res.errorCount}건<br />{res.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
