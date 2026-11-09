import { db } from "@/lib/db";
import { audit, HttpError, int, ok, route } from "@/lib/api";
import { newQrToken } from "@/lib/common";

/** QR 분실 시 재발급: 기존 QR 즉시 무효화 */
export const POST = route<{ id: string }>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const [row] = await sql`UPDATE employees SET qr_token = ${newQrToken()}, updated_at = now() WHERE id = ${id} RETURNING *`;
  if (!row) throw new HttpError(404, "직원을 찾을 수 없습니다.");
  await audit(user, "QR재발급", row.emp_no);
  return ok(row);
});
