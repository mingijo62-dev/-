import type { Sql } from "./db";
import { DIMENSIONS, targetCond } from "./common";
import type { Training } from "./trainings";

export async function trainingStats(sql: Sql, t: Training) {
  const cond = targetCond(sql, t.target);
  const [sum] = await sql<{ total: number; attended: number; exempt: number }[]>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE a.id IS NOT NULL OR e.is_supervisor)::int AS attended,
           count(*) FILTER (WHERE a.id IS NULL AND e.is_supervisor)::int AS exempt
    FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.training_id = ${t.id}
    WHERE ${cond}`;

  const breakdown: Record<string, { key: string; total: number; attended: number }[]> = {};
  for (const d of DIMENSIONS) {
    breakdown[d.key] = await sql<{ key: string; total: number; attended: number }[]>`
      SELECT COALESCE(NULLIF(${sql("e." + d.key)}, ''), '(미지정)') AS key,
             count(*)::int AS total, count(*) FILTER (WHERE a.id IS NOT NULL OR e.is_supervisor)::int AS attended
      FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.training_id = ${t.id}
      WHERE ${cond} GROUP BY 1 ORDER BY 1`;
  }

  const rounds = await sql`
    SELECT r.id, r.round_no, to_char(r.edu_date, 'YYYY-MM-DD') AS edu_date, r.start_time, r.end_time,
           r.location, r.status, count(a.id)::int AS attended
    FROM rounds r LEFT JOIN attendance a ON a.round_id = r.id
    WHERE r.training_id = ${t.id} GROUP BY r.id ORDER BY r.round_no`;

  const recent = await sql`
    SELECT e.emp_no, e.name, e.department, a.checked_at, a.method, r.round_no
    FROM attendance a JOIN employees e ON e.id = a.employee_id JOIN rounds r ON r.id = a.round_id
    WHERE a.training_id = ${t.id} ORDER BY a.checked_at DESC LIMIT 15`;

  return {
    total: sum.total,
    attended: sum.attended,
    exempt: sum.exempt,
    absent: sum.total - sum.attended,
    rate: sum.total ? Math.round((sum.attended / sum.total) * 1000) / 10 : 0,
    breakdown,
    rounds,
    recent,
  };
}

export function attendeeQuery(sql: Sql, t: Training, opts: { status?: string; q?: string; dim?: string; val?: string; roundId?: number }) {
  let f = targetCond(sql, t.target);
  if (opts.status === "attended") f = sql`${f} AND (a.id IS NOT NULL OR e.is_supervisor)`;
  if (opts.status === "absent") f = sql`${f} AND a.id IS NULL AND NOT e.is_supervisor`;
  if (opts.status === "supervisor") f = sql`${f} AND e.is_supervisor`;
  if (opts.roundId) f = sql`${f} AND a.round_id = ${opts.roundId}`;
  if (opts.q) f = sql`${f} AND (e.emp_no ILIKE ${"%" + opts.q + "%"} OR e.name ILIKE ${"%" + opts.q + "%"})`;
  const dim = DIMENSIONS.find((d) => d.key === opts.dim);
  if (dim && opts.val !== undefined) {
    f = opts.val === "(미지정)" ? sql`${f} AND ${sql("e." + dim.key)} = ''` : sql`${f} AND ${sql("e." + dim.key)} = ${opts.val}`;
  }
  return f;
}
