import { db } from "@/lib/db";
import { audit, body, HttpError, int, ok, route } from "@/lib/api";
import { parseRound } from "@/lib/trainings";

type P = { id: string };

export const PATCH = route<P>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const b = await body(req);
  const sql = await db();
  const [cur] = await sql`SELECT *, to_char(edu_date, 'YYYY-MM-DD') AS edu_date FROM rounds WHERE id = ${id}`;
  if (!cur) throw new HttpError(404, "차수를 찾을 수 없습니다.");
  const r = parseRound({ ...cur, ...b });
  await sql`UPDATE rounds SET ${sql(r)} WHERE id = ${id}`;
  await audit(user, "차수수정", `round#${id} ${r.status}`);
  return ok();
});

export const DELETE = route<P>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM attendance WHERE round_id = ${id}`;
  if (n > 0) throw new HttpError(400, `이미 ${n}명의 참석 기록이 있어 삭제할 수 없습니다. 차수를 '마감' 처리하세요.`);
  const [r] = await sql`DELETE FROM rounds WHERE id = ${id} RETURNING round_no`;
  if (!r) throw new HttpError(404, "차수를 찾을 수 없습니다.");
  await audit(user, "차수삭제", `round#${id}`);
  return ok();
});
