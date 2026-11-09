import { db } from "@/lib/db";
import { int, ok, route } from "@/lib/api";
import { attendeeQuery } from "@/lib/stats";
import { getTraining } from "@/lib/trainings";

export const GET = route(["admin"], async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const sql = await db();
  const t = await getTraining(sql, int(u.get("trainingId")));
  const size = Math.min(Math.max(Number(u.get("size")) || 50, 1), 200);
  const page = Math.max(Number(u.get("page")) || 1, 1);
  const cond = attendeeQuery(sql, t, {
    status: u.get("status") || undefined,
    q: (u.get("q") || "").trim() || undefined,
    dim: u.get("dim") || undefined,
    val: u.get("val") ?? undefined,
    roundId: Number(u.get("roundId")) || undefined,
  });
  const base = sql`FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.training_id = ${t.id}
                   LEFT JOIN rounds r ON r.id = a.round_id LEFT JOIN admins ad ON ad.id = a.checked_by WHERE ${cond}`;
  const [{ total }] = await sql`SELECT count(*)::int AS total ${base}`;
  const rows = await sql`SELECT e.id, e.emp_no, e.name, e.shift_type, e.department, e.work_group, e.position, e.is_supervisor,
                           a.checked_at, a.method, r.round_no, ad.name AS checked_by_name
                         ${base} ORDER BY a.checked_at DESC NULLS LAST, e.department, e.emp_no
                         LIMIT ${size} OFFSET ${(page - 1) * size}`;
  return ok({ rows, total, page, size });
});
