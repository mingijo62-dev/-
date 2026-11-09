"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { api, qrUrl } from "@/lib/client";

type E = { id: number; emp_no: string; name: string; shift_type: string; department: string; work_group: string; position: string; qr_token: string };

function PrintInner() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<(E & { src: string })[] | null>(null);
  const [title, setTitle] = useState("안전교육 출석 QR");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await api<E[]>(`/api/employees/qr?${sp.toString()}`);
        const out = [];
        for (const e of list) out.push({ ...e, src: await QRCode.toDataURL(qrUrl(e.qr_token), { width: 300, margin: 1 }) });
        setRows(out);
      } catch (e) { setErr(e instanceof Error ? e.message : "실패"); }
    })();
  }, [sp]);

  return (
    <>
      <div className="no-print card" style={{ marginBottom: 16 }}>
        <div className="row">
          <h1 style={{ margin: 0 }}>QR 출력</h1>
          <span className="muted">{rows ? `${rows.length}명` : "생성 중..."}</span>
          <span className="spacer" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 220 }} placeholder="카드 상단 문구" />
          <button className="btn primary" onClick={() => window.print()} disabled={!rows}>🖨 인쇄 / PDF 저장</button>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>A4 한 장에 약 16~20명 출력됩니다. 절취선을 따라 잘라 배포하거나 사원증 뒷면에 부착하세요.</div>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="qr-grid">
        {rows?.map((e) => (
          <div className="qr-card" key={e.id}>
            <div className="title">{title}</div>
            <img src={e.src} alt="" />
            <div className="nm">{e.name}</div>
            <div className="meta">{e.emp_no} · {e.department}</div>
            <div className="meta">{[e.shift_type, e.work_group, e.position].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<p>불러오는 중...</p>}><PrintInner /></Suspense>;
}
