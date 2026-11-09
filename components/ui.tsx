"use client";
import { useEffect, useState, type ReactNode } from "react";

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 820 } : undefined} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

let pushToast: ((m: string) => void) | null = null;
export function toast(msg: string) {
  pushToast?.(msg);
}
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

export function Bar({ value, lg }: { value: number; lg?: boolean }) {
  return (
    <div className={`bar${lg ? " lg" : ""}`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>이전</button>
      <span className="small muted">{page} / {pages}</span>
      <button className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>다음</button>
    </div>
  );
}

export function RoundBadge({ status }: { status: string }) {
  if (status === "open") return <span className="badge ok">접수중</span>;
  if (status === "closed") return <span className="badge">마감</span>;
  return <span className="badge warn">준비</span>;
}
