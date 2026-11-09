import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, body, errorResponse, HttpError, ok, str } from "@/lib/api";
import { createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = await db();
    const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM admins`;
    return ok({ needsSetup: count === 0, setupKeyRequired: !!process.env.SETUP_KEY });
  } catch (e) {
    return errorResponse(e);
  }
}

/** 최초 관리자 계정 생성 (관리자가 0명일 때만 가능) */
export async function POST(req: Request) {
  try {
    const b = await body<{ setupKey?: string; username?: string; password?: string; name?: string }>(req);
    if (process.env.SETUP_KEY && b.setupKey !== process.env.SETUP_KEY) throw new HttpError(403, "설치 키가 올바르지 않습니다.");
    const username = str(b.username, 40);
    const name = str(b.name, 40);
    const password = String(b.password ?? "");
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new HttpError(400, "아이디는 영문/숫자 3자 이상입니다.");
    if (password.length < 8) throw new HttpError(400, "비밀번호는 8자 이상이어야 합니다.");
    const sql = await db();
    const hash = await bcrypt.hash(password, 10);
    const user = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(872002)`;
      const [{ count }] = await tx<{ count: number }[]>`SELECT count(*)::int AS count FROM admins`;
      if (count > 0) throw new HttpError(409, "이미 초기 설정이 완료되었습니다.");
      const [u] = await tx<{ id: number; username: string; name: string; role: "admin" }[]>`
        INSERT INTO admins (username, password_hash, name, role)
        VALUES (${username}, ${hash}, ${name || username}, 'admin') RETURNING id, username, name, role`;
      return u;
    });
    await createSessionCookie(user);
    await audit(user, "초기설정", "최초 관리자 생성");
    return ok({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
