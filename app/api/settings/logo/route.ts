import { db } from "@/lib/db";
import { audit, errorResponse, HttpError, ok, route } from "@/lib/api";
import { extOf, mimeOf } from "@/lib/files";
import { getSetting, setSetting } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/** 공개: 로고 이미지 */
export async function GET() {
  try {
    const sql = await db();
    const v = await getSetting(sql, "logo");
    if (!v) return new Response("not found", { status: 404 });
    const { mime, b64 } = JSON.parse(v);
    return new Response(Buffer.from(b64, "base64"), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export const POST = route(["admin"], async ({ req, user }) => {
  const form = await req.formData();
  const f = form.get("file");
  if (!(f instanceof File)) throw new HttpError(400, "이미지 파일을 선택하세요.");
  if (!["png", "jpg", "jpeg", "svg", "webp", "gif"].includes(extOf(f.name))) throw new HttpError(400, "PNG, JPG, SVG, WEBP 이미지만 가능합니다.");
  if (f.size > 1024 * 1024) throw new HttpError(400, "로고 이미지는 1MB 이하로 올려주세요.");
  const sql = await db();
  const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
  await setSetting(sql, "logo", JSON.stringify({ mime: mimeOf(f.name), b64 }));
  await setSetting(sql, "logo_ver", String(Date.now()));
  await audit(user, "로고변경", f.name);
  return ok();
});

export const DELETE = route(["admin"], async ({ user }) => {
  const sql = await db();
  await sql`DELETE FROM settings WHERE key IN ('logo', 'logo_ver')`;
  await audit(user, "로고삭제");
  return ok();
});
