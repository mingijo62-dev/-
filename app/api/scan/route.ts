import { db } from "@/lib/db";
import { HttpError, ok, route } from "@/lib/api";
import { isTarget } from "@/lib/common";
import { getTraining } from "@/lib/trainings";

/** 수기 출석용 검색: q(사번·이름) + trainingId */
export const GET = route("any", async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const trainingId = Number(u.get("trainingId"));
  const q = (u.get("q") || "").trim();
  const sql = await db();
  const training = trainingId ? await getTraining(sql, trainingId) : null;

  let emps;
  if (q.length >= 2) {
    emps = await sql`SELECT * FROM employees WHERE emp_no = ${q} OR name = ${q} OR emp_no ILIKE ${q + "%"}
                     ORDER BY (emp_no = ${q}) DESC, name LIMIT 20`;
  } else {
    throw new HttpError(400, "사번 또는 이름을 2자 이상 입력하세요.");
  }

  const ids = emps.map((e) => e.id as number);
  const att = training && ids.length
    ? await sql`SELECT a.employee_id, a.checked_at, a.method, r.round_no, ad.name AS checked_by_name
                FROM attendance a JOIN rounds r ON r.id = a.round_id LEFT JOIN admins ad ON ad.id = a.checked_by
                WHERE a.training_id = ${training.id} AND a.employee_id IN ${sql(ids)}`
    : [];
  const rows = emps.map((e) => ({
    id: e.id,
    emp_no: e.emp_no,
    name: e.name,
    shift_type: e.shift_type,
    department: e.department,
    work_group: e.work_group,
    position: e.position,
    active: e.active,
    is_target: training ? isTarget(e, training.target) : true,
    attendance: att.find((a) => a.employee_id === e.id) ?? null,
  }));
  return ok(rows);
});
