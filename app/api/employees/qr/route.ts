import { db } from "@/lib/db";
import { audit, ok, route } from "@/lib/api";
import { filterCond } from "@/lib/employees";

/** QR 일괄 출력용 목록 */
export const GET = route(["admin"], async ({ req, user }) => {
  const u = new URL(req.url).searchParams;
  if (!u.get("active")) u.set("active", "1");
  const sql = await db();
  const ids = (u.get("ids") || "").split(",").map(Number).filter((n) => n > 0);
  const cond = ids.length ? sql`e.id IN ${sql(ids)}` : filterCond(sql, u);
  const rows = await sql`SELECT e.id, e.emp_no, e.name, e.shift_type, e.department, e.work_group, e.position, e.qr_token
                         FROM employees e WHERE ${cond} ORDER BY e.department, e.work_group, e.emp_no LIMIT 3000`;
  await audit(user, "QR출력", `${rows.length}명`);
  return ok(rows);
});
