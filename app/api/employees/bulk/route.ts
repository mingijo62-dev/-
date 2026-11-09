import { db } from "@/lib/db";
import { audit, body, HttpError, ok, route } from "@/lib/api";

export const POST = route(["admin"], async ({ req, user }) => {
  const b = await body<{ action?: string; ids?: unknown[] }>(req);
  const ids = (b.ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) throw new HttpError(400, "선택된 직원이 없습니다.");
  const sql = await db();
  let n = 0;
  if (b.action === "delete") n = (await sql`DELETE FROM employees WHERE id IN ${sql(ids)}`).count;
  else if (b.action === "deactivate") n = (await sql`UPDATE employees SET active = false, updated_at = now() WHERE id IN ${sql(ids)}`).count;
  else if (b.action === "activate") n = (await sql`UPDATE employees SET active = true, updated_at = now() WHERE id IN ${sql(ids)}`).count;
  else throw new HttpError(400, "알 수 없는 작업입니다.");
  await audit(user, "직원일괄처리", `${b.action} ${n}명`);
  return ok({ count: n });
});
