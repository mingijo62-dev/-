import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, body, HttpError, ok, route } from "@/lib/api";

export const POST = route("any", async ({ req, user }) => {
  const b = await body<{ current?: string; next?: string }>(req);
  const next = String(b.next ?? "");
  if (next.length < 8) throw new HttpError(400, "새 비밀번호는 8자 이상이어야 합니다.");
  const sql = await db();
  const [u] = await sql`SELECT password_hash FROM admins WHERE id = ${user.id}`;
  if (!(await bcrypt.compare(String(b.current ?? ""), u.password_hash))) throw new HttpError(400, "현재 비밀번호가 올바르지 않습니다.");
  await sql`UPDATE admins SET password_hash = ${await bcrypt.hash(next, 10)} WHERE id = ${user.id}`;
  await audit(user, "비밀번호변경");
  return ok();
});
