import { db } from "@/lib/db";
import { audit, body, HttpError, int, ok, route, str } from "@/lib/api";
import { normalizeTarget } from "@/lib/common";
import { getTraining } from "@/lib/trainings";

type P = { id: string };

export const PATCH = route<P>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const b = await body<{ title?: string; description?: string; target?: unknown; status?: string }>(req);
  const sql = await db();
  const t = await getTraining(sql, id);
  const title = b.title !== undefined ? str(b.title, 100) : t.title;
  if (!title) throw new HttpError(400, "교육명을 입력하세요.");
  const status = b.status === "closed" || b.status === "active" ? b.status : t.status;
  const target = b.target !== undefined ? normalizeTarget(b.target) : t.target;
  await sql`UPDATE trainings SET title = ${title},
            description = ${b.description !== undefined ? str(b.description, 1000) : t.description},
            target = ${sql.json(target)}, status = ${status} WHERE id = ${id}`;
  await audit(user, "교육수정", `${title}${status !== t.status ? ` → ${status}` : ""}`);
  return ok();
});

export const DELETE = route<P>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const [t] = await sql`DELETE FROM trainings WHERE id = ${id} RETURNING title`;
  if (!t) throw new HttpError(404, "교육을 찾을 수 없습니다.");
  await audit(user, "교육삭제", t.title);
  return ok();
});
