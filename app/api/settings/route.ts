import { db } from "@/lib/db";
import { audit, body, errorResponse, ok, route, str } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/** 공개: 회사명/로고 여부 (로그인·출석 화면에서 사용) */
export async function GET() {
  try {
    const sql = await db();
    const [org, logoVer] = await Promise.all([getSetting(sql, "org_name"), getSetting(sql, "logo_ver")]);
    return ok({ orgName: org ?? "한솔제지", logoVer: logoVer ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}

export const PATCH = route(["admin"], async ({ req, user }) => {
  const b = await body<{ orgName?: string }>(req);
  const sql = await db();
  if (b.orgName !== undefined) await setSetting(sql, "org_name", str(b.orgName, 40) || "한솔제지");
  await audit(user, "설정변경", `회사명: ${b.orgName ?? ""}`);
  return ok();
});
