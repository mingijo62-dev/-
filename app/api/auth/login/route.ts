import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, body, errorResponse, HttpError, ok, str } from "@/lib/api";
import { createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_FAIL = 5;
const LOCK_MIN = 10;
let dummy: string | undefined;
const dummyHash = () => (dummy ??= bcrypt.hashSync("not-a-real-password", 10));

export async function POST(req: Request) {
  try {
    const b = await body<{ username?: string; password?: string }>(req);
    const username = str(b.username, 40);
    const password = String(b.password ?? "");
    const sql = await db();
    const [u] = await sql`SELECT * FROM admins WHERE username = ${username}`;
    const generic = new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
    if (!u) {
      await bcrypt.compare(password, dummyHash()); // 응답시간 균등화(계정 존재여부 노출 방지)
      throw generic;
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      throw new HttpError(423, `로그인 ${MAX_FAIL}회 실패로 계정이 잠겼습니다. ${LOCK_MIN}분 후 다시 시도하세요.`);
    }
    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      const fails = u.failed_count + 1;
      if (fails >= MAX_FAIL) {
        await sql`UPDATE admins SET failed_count = 0, locked_until = now() + make_interval(mins => ${LOCK_MIN}) WHERE id = ${u.id}`;
      } else {
        await sql`UPDATE admins SET failed_count = ${fails} WHERE id = ${u.id}`;
      }
      await audit({ id: u.id, username: u.username }, "로그인실패", `실패 ${fails}회`);
      throw generic;
    }
    await sql`UPDATE admins SET failed_count = 0, locked_until = NULL, last_login_at = now() WHERE id = ${u.id}`;
    await createSessionCookie({ id: u.id, username: u.username, name: u.name, role: u.role });
    await audit({ id: u.id, username: u.username }, "로그인");
    return ok({ ok: true, role: u.role });
  } catch (e) {
    return errorResponse(e);
  }
}
