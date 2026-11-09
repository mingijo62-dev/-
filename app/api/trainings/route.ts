import { db } from "@/lib/db";
import { audit, body, HttpError, ok, route, str } from "@/lib/api";
import { normalizeTarget, targetCond } from "@/lib/common";
import { parseRound } from "@/lib/trainings";

export const GET = route("any", async ({ user }) => {
  const sql = await db();
  const staff = user.role === "staff";
  const trainings = await sql`SELECT * FROM trainings ${staff ? sql`WHERE status = 'active'` : sql``}
                              ORDER BY created_at DESC LIMIT 200`;
  const ids = trainings.map((t) => t.id as number);
  const rounds = ids.length
    ? await sql`SELECT r.*, to_char(r.edu_date, 'YYYY-MM-DD') AS edu_date,
                  (SELECT count(*)::int FROM attendance a WHERE a.round_id = r.id) AS attended
                FROM rounds r WHERE r.training_id IN ${sql(ids)} ORDER BY r.round_no`
    : [];
  const files = ids.length
    ? await sql`SELECT id, training_id, filename, size, created_at FROM training_files WHERE training_id IN ${sql(ids)} ORDER BY id`
    : [];
  const result = [];
  for (const t of trainings) {
    const target = normalizeTarget(t.target);
    const item: Record<string, unknown> = { ...t, target, rounds: rounds.filter((r) => r.training_id === t.id),
      files: files.filter((f) => f.training_id === t.id) };
    if (!staff) {
      const [c] = await sql`SELECT count(*)::int AS target_count,
                              count(a.id)::int AS attended_count
                            FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.training_id = ${t.id}
                            WHERE ${targetCond(sql, target)}`;
      Object.assign(item, c);
    }
    result.push(item);
  }
  return ok(result);
});

export const POST = route(["admin"], async ({ req, user }) => {
  const b = await body<{ title?: string; description?: string; target?: unknown; rounds?: Record<string, unknown>[] }>(req);
  const title = str(b.title, 100);
  if (!title) throw new HttpError(400, "교육명을 입력하세요.");
  const rounds = (b.rounds ?? []).map(parseRound);
  const sql = await db();
  const id = await sql.begin(async (tx) => {
    const [t] = await tx`INSERT INTO trainings (title, description, target)
                         VALUES (${title}, ${str(b.description, 1000)}, ${tx.json(normalizeTarget(b.target))}) RETURNING id`;
    for (let i = 0; i < rounds.length; i++) {
      await tx`INSERT INTO rounds ${tx({ ...rounds[i], training_id: t.id, round_no: i + 1 })}`;
    }
    return t.id as number;
  });
  await audit(user, "교육생성", `${title} (${rounds.length}개 차수)`);
  return ok({ id });
});
