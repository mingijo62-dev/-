import { db } from "@/lib/db";
import { audit, body, HttpError, int, ok, route } from "@/lib/api";
import { parseEmp } from "@/lib/employees";

type P = { id: string };

export const PATCH = route<P>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const b = await body(req);
  const e = parseEmp(b);
  const active = b.active === undefined ? true : !!b.active;
  const sql = await db();
  const [dup] = await sql`SELECT 1 FROM employees WHERE emp_no = ${e.emp_no} AND id <> ${id}`;
  if (dup) throw new HttpError(409, `사번 ${e.emp_no} 은(는) 이미 등록되어 있습니다.`);
  const [row] = await sql`UPDATE employees SET ${sql({ ...e, active })}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) throw new HttpError(404, "직원을 찾을 수 없습니다.");
  await audit(user, "직원수정", e.emp_no);
  return ok(row);
});

export const DELETE = route<P>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const [row] = await sql`DELETE FROM employees WHERE id = ${id} RETURNING emp_no`;
  if (!row) throw new HttpError(404, "직원을 찾을 수 없습니다.");
  await audit(user, "직원삭제", row.emp_no);
  return ok();
});
