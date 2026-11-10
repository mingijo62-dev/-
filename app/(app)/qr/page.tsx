"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/client";
import { toast } from "@/components/ui";
import Logo from "@/components/Logo";
import { useUser } from "@/components/Shell";

type W = {
  token: string; start: string; end: string; version: string;
  rounds: { id: number; round_no: number; start_time: string; end_time: string; location: string; title: string; attended: number }[];
};

const fmtDay = (d: string) => {
  const dt = new Date(d + "T00:00:00Z"); // 날짜 문자열 그대로 해석 (브라우저 시간대 무관)
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${"일월화수목금토"[dt.getUTCDay()]})`;
};

/** 오늘의 공용 출석 QR — 매일 0시 자동 교체. 모니터 게시 또는 당일 시험지·유인물에 인쇄 */
export default function WeeklyQrPage() {
  const [w, setW] = useState<W | null>(null);
  const [src, setSrc] = useState("");
  const role = useUser()?.role;
  const url = w ? `${location.origin}/a/${w.token}` : "";

  const load = useCallback(() => api<W>("/api/weekly").then(setW), []);
  useEffect(() => {
    load();
    const h = setInterval(load, 60_000); // 주 변경·차수 상태 변경 자동 반영
    return () => clearInterval(h);
  }, [load]);
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 900, margin: 2, errorCorrectionLevel: "M" }).then(setSrc);
  }, [url]);

  const rotate = async () => {
    if (!confirm("QR코드를 지금 즉시 교체할까요?\n이미 게시·출력한 오늘 QR코드는 더 이상 사용할 수 없습니다. (QR 유출이 의심될 때 사용)")) return;
    await api("/api/weekly", { method: "POST" });
    toast("새 QR코드로 교체되었습니다.");
    load();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast("출석 링크가 복사되었습니다.");
  };

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>오늘의 출석 QR</h1>
          <div className="muted small">매일 0시에 자동으로 새 QR코드로 바뀝니다 (오늘 하루만 사용 가능). 교육 당일에 출력해 시험지·유인물에 넣거나 화면에 띄우세요. [QR 이미지 저장]으로 받아 시험지 파일에 바로 넣을 수 있습니다.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={copy} disabled={!w}>링크 복사</button>
          {src && w && <a className="btn" href={src} download={`출석QR_${w.start}.png`}>QR 이미지 저장</a>}
          {role === "admin" && <button className="btn danger" onClick={rotate}>지금 즉시 교체</button>}
          <button className="btn primary" onClick={() => window.print()} disabled={!src}>🖨 게시용 출력</button>
        </div>
      </div>

      {w && (
        <div className="card qr-poster">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><Logo dark /></div>
          <h1 style={{ fontSize: 28 }}>안전교육 출석 체크</h1>
          <div className="period">{fmtDay(w.start)} 하루만 유효</div>
          {src && <img src={src} alt="출석 QR코드" style={{ margin: "12px auto", display: "block" }} />}
          <div style={{ fontSize: 18, fontWeight: 700 }}>휴대폰 카메라로 QR을 찍고 <span style={{ color: "var(--brand)" }}>사번·이름</span>을 입력하세요</div>
          <div className="muted small" style={{ marginTop: 4 }}>본인 휴대폰으로만 출석할 수 있으며, 대리 출석은 자동으로 차단됩니다.</div>
          <div style={{ marginTop: 18, textAlign: "left", maxWidth: 520, marginInline: "auto" }}>
            <h3>오늘 출석 접수 중인 교육</h3>
            {!w.rounds.length && (
              <div className="alert warn small">
                오늘 접수 중인 교육이 없습니다. QR을 찍어도 출석할 수 없습니다.<br />
                [교육·차수]에서 <b>오늘 날짜</b> 차수의 상태를 <b>접수중</b>으로 바꾸세요.
              </div>
            )}
            {w.rounds.map((r) => (
              <div key={r.id} className="row" style={{ padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                <span className="badge ok">접수중</span>
                <b>{r.title}</b><span>{r.round_no}차</span>
                <span className="muted small">{r.start_time}{r.end_time && `~${r.end_time}`} {r.location}</span>
                <span className="spacer" /><span className="small mono no-print">{r.attended}명 출석</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
