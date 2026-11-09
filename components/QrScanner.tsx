"use client";
import { useEffect, useRef, useState } from "react";

/** 카메라 QR 스캐너 (html5-qrcode). paused=true 동안은 인식 결과를 무시 */
export default function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const ref = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const cb = useRef(onScan);
  const pausedRef = useRef(paused);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  cb.current = onScan;
  pausedRef.current = paused;

  const start = async () => {
    setErr("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!ref.current) ref.current = new Html5Qrcode("qr-reader", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      await ref.current.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        (text) => { if (!pausedRef.current) cb.current(text); },
        () => {}
      );
      setRunning(true);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      setErr(/permission|NotAllowed/i.test(msg) ? "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라를 허용하세요." : `카메라를 시작할 수 없습니다. (${msg})`);
    }
  };
  const stop = async () => {
    try { await ref.current?.stop(); } catch {}
    setRunning(false);
  };

  useEffect(() => () => { ref.current?.stop().catch(() => {}); }, []);

  return (
    <div className="stack">
      <div className="scanner-box">
        <div id="qr-reader" />
        {!running && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
            <div className="stack" style={{ alignItems: "center" }}>
              <div style={{ fontSize: 44 }}>📷</div>
              <button className="btn primary" onClick={start}>카메라 켜고 스캔 시작</button>
              {err && <div className="alert err small">{err}</div>}
            </div>
          </div>
        )}
      </div>
      {running && <button className="btn sm" onClick={stop}>카메라 끄기</button>}
    </div>
  );
}
