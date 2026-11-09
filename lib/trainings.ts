import type { Sql } from "./db";
import { HttpError, str } from "./api";
import { normalizeTarget, targetCond, type Target } from "./common";

export interface Training {
  id: number;
  title: string;
  description: string;
  target: Target;
  status: "active" | "closed";
  created_at: string;
}

export async function getTraining(sql: Sql, id: number): Promise<Training> {
  const [t] = await sql<Training[]>`SELECT * FROM trainings WHERE id = ${id}`;
  if (!t) throw new HttpError(404, "교육을 찾을 수 없습니다.");
  t.target = normalizeTarget(t.target);
  return t;
}

export async function targetCount(sql: Sql, t: Training) {
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM employees e WHERE ${targetCond(sql, t.target)}`;
  return n;
}

export function parseRound(b: Record<string, unknown>) {
  const edu_date = str(b.edu_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edu_date)) throw new HttpError(400, "교육일자를 입력하세요.");
  const status = ["ready", "open", "closed"].includes(String(b.status)) ? String(b.status) : "open";
  return {
    edu_date,
    start_time: str(b.start_time, 5),
    end_time: str(b.end_time, 5),
    location: str(b.location, 100),
    instructor: str(b.instructor, 50),
    status,
  };
}
