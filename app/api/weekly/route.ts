import { db } from "@/lib/db";
import { audit, ok, route } from "@/lib/api";
import { currentWeeklyToken, getSetting, setSetting } from "@/lib/weekly";

/** 이번 주 공용 출석 QR 정보 + 오늘 접수중인 차수 */
export const GET = route("any", async () => {
  const sql = await db();
  const w = await currentWeeklyToken(sql);
  const rounds = await sql`
    SELECT r.id, r.round_no, r.start_time, r.end_time, r.location, t.title, t.id AS training_id,
           (SELECT count(*)::int FROM attendance a WHERE a.round_id = r.id) AS attended
    FROM rounds r JOIN trainings t ON t.id = r.training_id
    WHERE t.status = 'active' AND r.status = 'open' AND r.edu_date = (now() AT TIME ZONE 'Asia/Seoul')::date
    ORDER BY r.start_time, t.id`;
  return ok({ ...w, rounds });
});

/** 관리자 수동 교체 (QR 유출 의심 시) */
export const POST = route(["admin"], async ({ user }) => {
  const sql = await db();
  const v = Number((await getSetting(sql, "qr_version")) ?? "1") + 1;
  await setSetting(sql, "qr_version", String(v));
  await audit(user, "주간QR교체", `v${v}`);
  return ok(await currentWeeklyToken(sql));
});
