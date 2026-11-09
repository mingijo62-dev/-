import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { audit, body, clientIp, errorResponse, HttpError, ok, str } from "@/lib/api";
import { isTarget, maskName, normalizeTarget } from "@/lib/common";
import { verifyWeeklyToken } from "@/lib/weekly";

export const dynamic = "force-dynamic";
const DEV = "sea_dev";
const MAX_FAIL = 10; // IP당 10분 내 실패 허용 횟수

async function deviceId(create: boolean) {
  const jar = await cookies();
  let id = jar.get(DEV)?.value;
  if (!id && create) {
    id = randomBytes(16).toString("base64url");
    jar.set(DEV, id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return id;
}

async function openRounds(sql: Awaited<ReturnType<typeof db>>) {
  return sql`
    SELECT r.id, r.round_no, r.start_time, r.end_time, r.location, t.id AS training_id, t.title,
           COALESCE((SELECT json_agg(json_build_object('id', f.id, 'filename', f.filename, 'size', f.size) ORDER BY f.id)
                     FROM training_files f WHERE f.training_id = t.id), '[]') AS files
    FROM rounds r JOIN trainings t ON t.id = r.training_id
    WHERE t.status = 'active' AND r.status = 'open' AND r.edu_date = (now() AT TIME ZONE 'Asia/Seoul')::date
    ORDER BY r.start_time, t.id`;
}

/** 공용 QR 접속: 토큰 확인 + 오늘 접수중인 교육 목록 */
export async function GET(req: Request) {
  try {
    const t = new URL(req.url).searchParams.get("t") || "";
    const sql = await db();
    if (!(await verifyWeeklyToken(sql, t))) throw new HttpError(410, "만료되었거나 올바르지 않은 QR코드입니다. 교육장에 게시된 이번 주 QR코드를 다시 스캔하세요.");
    await deviceId(true);
    const rounds = await openRounds(sql);
    return ok({ rounds: rounds.map(({ files, ...r }) => ({ ...r, fileCount: (files as unknown[]).length })) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * 직원 자가 출석 (2단계)
 *  step=find  : 사번 + 이름 일치 확인 → 구분/부서/근무조/직책 반환 (본인 확인 화면)
 *  step=check : 본인 확인 후 출석 처리 (사번·이름 재검증)
 */
export async function POST(req: Request) {
  try {
    const b = await body<{ t?: string; step?: string; roundId?: unknown; emp_no?: string; name?: string }>(req);
    const sql = await db();
    if (!(await verifyWeeklyToken(sql, String(b.t ?? "")))) throw new HttpError(410, "만료된 QR코드입니다. 이번 주 QR코드를 다시 스캔하세요.");
    const dev = await deviceId(false);
    if (!dev) throw new HttpError(400, "QR코드를 다시 스캔한 뒤 시도하세요. (쿠키 차단 시 출석 불가)");
    const ip = await clientIp();

    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_logs
      WHERE ip = ${ip} AND action = '자가출석실패' AND created_at > now() - interval '10 minutes'`;
    if (n >= MAX_FAIL) throw new HttpError(429, "입력 오류가 많아 잠시 제한되었습니다. 10분 후 다시 시도하거나 교육 담당자에게 문의하세요.");

    const empNo = str(b.emp_no, 30).replace(/\s/g, "");
    const name = str(b.name, 40).replace(/\s/g, "");
    if (!empNo || !name) throw new HttpError(400, "사번과 이름을 입력하세요.");
    const fail = async (msg: string) => {
      await audit(null, "자가출석실패", `${empNo} / ${msg}`);
      return new HttpError(400, msg);
    };

    // 사번 대소문자 무시, 이름 공백 무시
    const [emp] = await sql`SELECT * FROM employees WHERE upper(emp_no) = upper(${empNo}) AND replace(name, ' ', '') = ${name}`;
    if (!emp) throw await fail("사번과 이름이 일치하는 직원이 없습니다. 다시 확인하세요.");
    if (!emp.active) throw await fail("재직(활성) 상태가 아닌 직원입니다. 교육 담당자에게 문의하세요.");

    if (b.step === "find") {
      return ok({
        status: "confirm",
        employee: { name: emp.name, emp_no: emp.emp_no, shift_type: emp.shift_type, department: emp.department, work_group: emp.work_group, position: emp.position, is_supervisor: emp.is_supervisor },
      });
    }
    const roundId = Number(b.roundId);

    // 오늘 접수중인 차수 중 본인이 대상인 것
    const open = await sql`
      SELECT r.*, t.title, t.target,
             EXISTS (SELECT 1 FROM attendance a WHERE a.training_id = t.id AND a.employee_id = ${emp.id}) AS done
      FROM rounds r JOIN trainings t ON t.id = r.training_id
      WHERE t.status = 'active' AND r.status = 'open' AND r.edu_date = (now() AT TIME ZONE 'Asia/Seoul')::date
      ORDER BY r.start_time, t.id`;
    // 관리감독자는 대상 조건과 무관하게 항상 출석 가능
    const mine = open.filter((r) => emp.is_supervisor || isTarget(emp, normalizeTarget(r.target)));
    let round;
    if (Number.isInteger(roundId) && roundId > 0) {
      round = open.find((r) => r.id === roundId);
      if (!round) throw new HttpError(400, "현재 출석 접수 중인 교육이 아닙니다. 화면을 새로고침하세요.");
      if (!mine.includes(round)) throw await fail(`'${round.title}' 교육 대상자가 아닙니다.${mine.length ? " 다른 교육을 선택하거나 '자동 선택'으로 출석하세요." : ""}`);
    } else {
      // 자동 선택: 아직 출석하지 않은 대상 교육 우선
      const pending = mine.filter((r) => !r.done);
      const trainingsPending = new Set(pending.map((r) => r.training_id));
      if (!mine.length) throw await fail("오늘 출석 접수 중인 교육 중 본인이 대상인 교육이 없습니다. 교육 담당자에게 문의하세요.");
      if (trainingsPending.size > 1) {
        return ok({ status: "choose", message: "오늘 참석 가능한 교육이 여러 개입니다. 지금 참석한 교육을 선택하세요.", roundIds: pending.map((r) => r.id) }, { status: 409 });
      }
      round = pending[0] ?? mine[0];
    }

    // 대리 출석 방지: 같은 휴대폰으로 다른 직원 출석 차단
    const [other] = await sql`SELECT e.name FROM attendance a JOIN employees e ON e.id = a.employee_id
      WHERE a.training_id = ${round.training_id} AND a.device_id = ${dev} AND a.employee_id <> ${emp.id} LIMIT 1`;
    if (other) throw await fail(`이 휴대폰으로 이미 다른 직원(${maskName(other.name)})이 출석했습니다. 본인 휴대폰으로 출석하세요.`);

    const [ins] = await sql`
      INSERT INTO attendance (training_id, round_id, employee_id, method, device_id, ip)
      VALUES (${round.training_id}, ${round.id}, ${emp.id}, 'self', ${dev}, ${ip})
      ON CONFLICT (training_id, employee_id) DO NOTHING RETURNING checked_at`;
    const files = await sql`SELECT id, filename, size FROM training_files WHERE training_id = ${round.training_id} ORDER BY id`;
    const employee = { name: emp.name, emp_no: emp.emp_no, shift_type: emp.shift_type, department: emp.department, work_group: emp.work_group, position: emp.position, is_supervisor: emp.is_supervisor };
    if (!ins) {
      const [prev] = await sql`SELECT a.checked_at, r.round_no FROM attendance a JOIN rounds r ON r.id = a.round_id
                               WHERE a.training_id = ${round.training_id} AND a.employee_id = ${emp.id}`;
      return ok({ status: "duplicate", employee, title: round.title, checked_at: prev?.checked_at, round_no: prev?.round_no, files });
    }
    return ok({ status: "ok", employee, title: round.title, checked_at: ins.checked_at, round_no: round.round_no, files });
  } catch (e) {
    return errorResponse(e);
  }
}
