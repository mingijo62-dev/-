"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtTime } from "@/lib/client";

type L = { id: number; username: string; action: string; detail: string; ip: string; created_at: string };

export default function LogsPage() {
  const [rows, setRows] = useState<L[]>([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const load = useCallback(() => api<{ rows: L[] }>(`/api/logs?page=${page}&q=${encodeURIComponent(q)}`).then((d) => setRows(d.rows)), [page, q]);
  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="page-head">
        <div><h1>접근 기록</h1><div className="muted small">로그인, 개인정보 조회·변경, 엑셀 다운로드, QR 출력 등 주요 작업 이력 (개인정보 보호 감사용)</div></div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
          <input placeholder="계정/작업/내용 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <button className="btn">검색</button>
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>일시</th><th>계정</th><th>작업</th><th>내용</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small mono nowrap">{fmtTime(r.created_at)}</td><td className="mono">{r.username}</td>
                <td><span className="badge brand">{r.action}</span></td><td className="small">{r.detail}</td><td className="small mono">{r.ip}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="empty">기록이 없습니다.</td></tr>}
          </tbody>
        </table>
        <div className="pager">
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
          <span className="small muted">{page}</span>
          <button className="btn sm" disabled={rows.length < 100} onClick={() => setPage(page + 1)}>다음</button>
        </div>
      </div>
    </>
  );
}
