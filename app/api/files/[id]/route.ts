import { db } from "@/lib/db";
import { audit, errorResponse, HttpError, int, ok, route } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { verifyWeeklyToken } from "@/lib/weekly";

/** 교육 자료 다운로드: 로그인 사용자, 또는 오늘 출석 QR 토큰(?t=) 보유자 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = int((await ctx.params).id);
    const sql = await db();
    const t = new URL(req.url).searchParams.get("t") || "";
    if (!(await getUser()) && !(await verifyWeeklyToken(sql, t))) throw new HttpError(401, "접근 권한이 없습니다.");
    const [f] = await sql`SELECT filename, mime, data FROM training_files WHERE id = ${id}`;
    if (!f) throw new HttpError(404, "파일을 찾을 수 없습니다.");
    const inline = /^(application\/pdf|image\/)/.test(f.mime);
    return new Response(new Uint8Array(f.data as Buffer), {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export const DELETE = route<{ id: string }>(["admin"], async ({ user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const [f] = await sql`DELETE FROM training_files WHERE id = ${id} RETURNING filename`;
  if (!f) throw new HttpError(404, "파일을 찾을 수 없습니다.");
  await audit(user, "자료삭제", f.filename);
  return ok();
});
