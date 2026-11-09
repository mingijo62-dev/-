import { db } from "@/lib/db";
import { audit, body, HttpError, ok, route } from "@/lib/api";
import { newQrToken } from "@/lib/common";
import { filterCond, parseEmp } from "@/lib/employees";

export const GET = route(["admin"], async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const size = Math.min(Math.max(Number(u.get("size")) || 50, 1), 500);
  const page = Math.max(Number(u.get("page")) || 1, 1);
  const sql = await db();
  const cond = filterCond(sql, u);
  const [{ total }] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM employees e WHERE ${cond}`;
  const rows = await sql`SELECT e.* FROM employees e WHERE ${cond}
                         ORDER BY e.department, e.emp_no LIMIT ${size} OFFSET ${(page - 1) * size}`;
  return ok({ rows, total, page, size });
});

export const POST = route(["admin"], async ({ req, user }) => {
  const e = parseEmp(await body(req));
  const sql = await db();
  const [dup] = await sql`SELECT 1 FROM employees WHERE emp_no = ${e.emp_no}`;
  if (dup) throw new HttpError(409, `사번 ${e.emp_no} 은(는) 이미 등록되어 있습니다.`);
  const [row] = await sql`INSERT INTO employees ${sql({ ...e, is_supervisor: !!e.is_supervisor, qr_token: newQrToken() })} RETURNING *`;
  await audit(user, "직원등록", `${e.emp_no}`);
  return ok(row);
});
