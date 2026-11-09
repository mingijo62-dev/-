import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, body, HttpError, int, ok, route, str } from "@/lib/api";

type P = { id: string };

export const PATCH = route<P>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const b = await body<{ name?: string; role?: string; password?: string; unlock?: boolean }>(req);
  const sql = await db();
  const [t] = await sql`SELECT * FROM admins WHERE id = ${id}`;
  if (!t) throw new HttpError(404, "계정을 찾을 수 없습니다.");
  if (b.role && id === user.id && b.role !== "admin") throw new HttpError(400, "본인의 관리자 권한은 해제할 수 없습니다.");
  const role = b.role === "admin" || b.role === "staff" ? b.role : t.role;
  const name = b.name !== undefined ? str(b.name, 40) || t.name : t.name;
  let hash = t.password_hash;
  if (b.password) {
    if (String(b.password).length < 8) throw new HttpError(400, "비밀번호는 8자 이상이어야 합니다.");
    hash = await bcrypt.hash(String(b.password), 10);
  }
  await sql`UPDATE admins SET name = ${name}, role = ${role}, password_hash = ${hash},
            failed_count = CASE WHEN ${!!b.unlock} THEN 0 ELSE failed_count END,
            locked_until = CASE WHEN ${!!b.unlock} THEN NULL ELSE locked_until END
            WHERE id = ${id}`;
  await audit(user, "계정수정", `${t.username}${b.password ? " (비밀번호 초기화)" : ""}${b.unlock ? " (잠금해제)" : ""}`);
  return ok();
});

export const DELETE = route<P>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  if (id === user.id) throw new HttpError(400, "본인 계정은 삭제할 수 없습니다.");
  const sql = await db();
  const [t] = await sql`DELETE FROM admins WHERE id = ${id} RETURNING username`;
  if (!t) throw new HttpError(404, "계정을 찾을 수 없습니다.");
  await audit(user, "계정삭제", t.username);
  return ok();
});
