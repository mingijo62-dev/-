import type { Sql } from "./db";
import { HttpError, str } from "./api";

export interface EmpInput {
  emp_no: string;
  name: string;
  shift_type: string;
  department: string;
  work_group: string;
  position: string;
}

export function normalizeShift(v: unknown) {
  const s = str(v, 20).replace(/\s/g, "");
  if (/^(교대|교대근무|shift)$/i.test(s)) return "교대";
  if (/^(주전|주간|상주|일근|day)$/i.test(s)) return "주전";
  return s;
}

export function parseEmp(b: Record<string, unknown>): EmpInput {
  const e = {
    emp_no: str(b.emp_no, 30),
    name: str(b.name, 40),
    shift_type: normalizeShift(b.shift_type),
    department: str(b.department, 60),
    work_group: str(b.work_group, 30),
    position: str(b.position, 30),
  };
  if (!e.emp_no) throw new HttpError(400, "사번은 필수입니다.");
  if (!e.name) throw new HttpError(400, "이름은 필수입니다.");
  return e;
}

export function filterCond(sql: Sql, u: URLSearchParams) {
  let f = sql`TRUE`;
  const q = (u.get("q") || "").trim();
  if (q) f = sql`${f} AND (e.emp_no ILIKE ${"%" + q + "%"} OR e.name ILIKE ${"%" + q + "%"})`;
  for (const [param, col] of [
    ["shift_type", "shift_type"],
    ["department", "department"],
    ["work_group", "work_group"],
    ["position", "position"],
  ] as const) {
    const v = u.get(param);
    if (v) f = sql`${f} AND ${sql("e." + col)} = ${v}`;
  }
  const active = u.get("active");
  if (active === "1") f = sql`${f} AND e.active = true`;
  if (active === "0") f = sql`${f} AND e.active = false`;
  return f;
}
