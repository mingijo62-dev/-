import { db } from "@/lib/db";
import { audit, body, int, ok, route } from "@/lib/api";
import { getTraining, parseRound } from "@/lib/trainings";

export const POST = route<{ id: string }>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const r = parseRound(await body(req));
  const sql = await db();
  const t = await getTraining(sql, id);
  const [{ next }] = await sql`SELECT COALESCE(max(round_no), 0) + 1 AS next FROM rounds WHERE training_id = ${id}`;
  await sql`INSERT INTO rounds ${sql({ ...r, training_id: id, round_no: next })}`;
  await audit(user, "차수추가", `${t.title} ${next}차`);
  return ok();
});
