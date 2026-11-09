"use client";

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: "no-store",
  });
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new Error("로그인이 필요합니다.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data as T;
}

export function fmtTime(v?: string | null, withDate = true) {
  if (!v) return "";
  const d = new Date(v);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(withDate ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 1000) / 10 : 0;
}

export const DIMS = [
  { key: "shift_type", label: "교대/주전" },
  { key: "department", label: "부서" },
  { key: "work_group", label: "근무조" },
  { key: "position", label: "직책" },
] as const;

export async function download(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "다운로드 실패");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : "download.xlsx";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
