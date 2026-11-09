import { db } from "@/lib/db";
import { HttpError, ok, route } from "@/lib/api";
import { isTarget } from "@/lib/common";
import { getTraining } from "@/lib/trainings";

/** 스캔/검색 조회: token | q(사번·이름) + trainingId */
export const GET = route("any", async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const trainingId = Number(u.get("trainingId"));
  const token = (u.get("token") || "").trim();
  const q = (u.get("q") || "").trim();
  const sql = await db();
  const training = trainingId ? await getTraining(sql, trainingId) : null;

  let emps;
  if (token) {
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) throw new HttpError(400, "유효하지 않은 QR코드입니다.");
    emps = await sql`SELECT * FROM employees WHERE qr_token = ${token}`;
    if (!emps.length) throw new HttpError(404, "등록되지 않았거나 재발급으로 폐기된 QR코드입니다.");
  } else if (q.length >= 2) {
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
    qr_token: token ? e.qr_token : undefined,
    is_target: training ? isTarget(e, training.target) : true,
    attendance: att.find((a) => a.employee_id === e.id) ?? null,
  }));
  return ok(rows);
});
