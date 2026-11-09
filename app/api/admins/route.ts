import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, body, HttpError, ok, route, str } from "@/lib/api";

export const GET = route(["admin"], async () => {
  const sql = await db();
  const rows = await sql`SELECT id, username, name, role, last_login_at, created_at,
                         (locked_until > now()) AS locked FROM admins ORDER BY id`;
  return ok(rows);
});

export const POST = route(["admin"], async ({ req, user }) => {
  const b = await body<{ username?: string; name?: string; password?: string; role?: string }>(req);
  const username = str(b.username, 40);
  const name = str(b.name, 40);
  const password = String(b.password ?? "");
  const role = b.role === "admin" ? "admin" : "staff";
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new HttpError(400, "아이디는 영문/숫자 3자 이상입니다.");
  if (password.length < 8) throw new HttpError(400, "비밀번호는 8자 이상이어야 합니다.");
  const sql = await db();
  const [dup] = await sql`SELECT 1 FROM admins WHERE username = ${username}`;
  if (dup) throw new HttpError(409, "이미 존재하는 아이디입니다.");
  await sql`INSERT INTO admins (username, name, password_hash, role)
            VALUES (${username}, ${name || username}, ${await bcrypt.hash(password, 10)}, ${role})`;
  await audit(user, "계정생성", `${username} (${role})`);
  return ok();
});
