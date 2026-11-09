import { db } from "@/lib/db";
import { audit, body, HttpError, int, ok, route } from "@/lib/api";
import { isTarget } from "@/lib/common";
import { getTraining } from "@/lib/trainings";

/** 참석 처리 — (training_id, employee_id) UNIQUE 로 중복 방지 */
export const POST = route("any", async ({ req, user }) => {
  const b = await body<{ trainingId?: unknown; roundId?: unknown; token?: string; employeeId?: unknown }>(req);
  const trainingId = int(b.trainingId);
  const roundId = int(b.roundId);
  const sql = await db();
  const training = await getTraining(sql, trainingId);
  if (training.status !== "active") throw new HttpError(400, "종료된 교육입니다.");
  const [round] = await sql`SELECT * FROM rounds WHERE id = ${roundId} AND training_id = ${trainingId}`;
  if (!round) throw new HttpError(404, "차수를 찾을 수 없습니다.");
  if (round.status !== "open") throw new HttpError(400, `${round.round_no}차는 현재 출석 접수 중이 아닙니다.`);

  const [emp] = b.token
    ? await sql`SELECT * FROM employees WHERE qr_token = ${String(b.token)}`
    : await sql`SELECT * FROM employees WHERE id = ${int(b.employeeId)}`;
  if (!emp) throw new HttpError(404, "직원 정보를 찾을 수 없습니다.");
  if (!emp.active) throw new HttpError(400, `${emp.name}(${emp.emp_no}) 님은 비활성(퇴사/휴직) 상태입니다.`);
  if (!isTarget(emp, training.target)) throw new HttpError(400, `${emp.name}(${emp.emp_no}) 님은 이 교육의 대상자가 아닙니다.`);

  const method = b.token ? "qr" : "manual";
  const [ins] = await sql`
    INSERT INTO attendance (training_id, round_id, employee_id, checked_by, method)
    VALUES (${trainingId}, ${roundId}, ${emp.id}, ${user.id}, ${method})
    ON CONFLICT (training_id, employee_id) DO NOTHING
    RETURNING checked_at`;
  const employee = { id: emp.id, emp_no: emp.emp_no, name: emp.name, department: emp.department };
  if (!ins) {
    const [prev] = await sql`SELECT a.checked_at, r.round_no FROM attendance a JOIN rounds r ON r.id = a.round_id
                             WHERE a.training_id = ${trainingId} AND a.employee_id = ${emp.id}`;
    return ok({ status: "duplicate", employee, checked_at: prev?.checked_at, round_no: prev?.round_no }, { status: 200 });
  }
  return ok({ status: "ok", employee, checked_at: ins.checked_at, round_no: round.round_no });
});

/** 참석 취소 (관리자) */
export const DELETE = route(["admin"], async ({ req, user }) => {
  const b = await body<{ trainingId?: unknown; employeeId?: unknown }>(req);
  const trainingId = int(b.trainingId);
  const employeeId = int(b.employeeId);
  const sql = await db();
  const [r] = await sql`DELETE FROM attendance WHERE training_id = ${trainingId} AND employee_id = ${employeeId}
                        RETURNING (SELECT emp_no FROM employees WHERE id = ${employeeId}) AS emp_no`;
  if (!r) throw new HttpError(404, "참석 기록이 없습니다.");
  await audit(user, "참석취소", `training#${trainingId} ${r.emp_no}`);
  return ok();
});
