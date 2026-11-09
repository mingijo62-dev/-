import { randomBytes } from "crypto";
import type { Sql } from "./db";

export const DIMENSIONS = [
  { key: "shift_type", label: "교대/주전" },
  { key: "department", label: "부서" },
  { key: "work_group", label: "근무조" },
  { key: "position", label: "직책" },
] as const;
export type DimKey = (typeof DIMENSIONS)[number]["key"];

export type Target = Partial<Record<DimKey, string[]>>;

export function newQrToken() {
  return randomBytes(16).toString("base64url"); // 128bit 난수, 개인정보 미포함
}

export function normalizeTarget(t: unknown): Target {
  const out: Target = {};
  if (!t || typeof t !== "object") return out;
  for (const d of DIMENSIONS) {
    const v = (t as Record<string, unknown>)[d.key];
    if (Array.isArray(v)) {
      const arr = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 200);
      if (arr.length) out[d.key] = arr;
    }
  }
  return out;
}

/** 교육 대상자 조건 (employees 테이블 alias = e) */
export function targetCond(sql: Sql, t: Target) {
  let f = sql`e.active = true`;
  if (t.shift_type?.length) f = sql`${f} AND e.shift_type IN ${sql(t.shift_type)}`;
  if (t.department?.length) f = sql`${f} AND e.department IN ${sql(t.department)}`;
  if (t.work_group?.length) f = sql`${f} AND e.work_group IN ${sql(t.work_group)}`;
  if (t.position?.length) f = sql`${f} AND e.position IN ${sql(t.position)}`;
  return f;
}

export function isTarget(emp: Record<string, unknown>, t: Target) {
  if (!emp.active) return false;
  for (const d of DIMENSIONS) {
    const arr = t[d.key];
    if (arr?.length && !arr.includes(String(emp[d.key] ?? ""))) return false;
  }
  return true;
}

/** 이름 마스킹: 홍길동 → 홍*동 */
export function maskName(n: string) {
  if (n.length <= 1) return n;
  if (n.length === 2) return n[0] + "*";
  return n[0] + "*".repeat(n.length - 2) + n[n.length - 1];
}
