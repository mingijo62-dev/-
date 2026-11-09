import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUser, type Role, type SessionUser } from "./auth";
import { db } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok(data: unknown = { ok: true }, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
}

/** 변경 요청에 대한 CSRF 방어: Origin 이 있으면 Host 와 일치해야 함 */
async function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return;
  const host = h.get("x-forwarded-host") || h.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "허용되지 않은 요청 출처입니다.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "허용되지 않은 요청 출처입니다.");
  }
}

type Handler<C> = (ctx: { req: Request; user: SessionUser; params: C }) => Promise<Response>;

/** 인증/권한/에러 처리 래퍼 */
export function route<C = Record<string, string>>(roles: Role[] | "any", fn: Handler<C>) {
  return async (req: Request, ctx: { params: Promise<C> }) => {
    try {
      await checkOrigin(req);
      const user = await getUser();
      if (!user) throw new HttpError(401, "로그인이 필요합니다.");
      if (roles !== "any" && !roles.includes(user.role)) throw new HttpError(403, "권한이 없습니다.");
      const params = ctx?.params ? await ctx.params : ({} as C);
      return await fn({ req, user, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  if (/unique|duplicate/i.test(msg)) return NextResponse.json({ error: "중복된 데이터가 있습니다." }, { status: 409 });
  return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
}

export async function audit(user: Pick<SessionUser, "id" | "username"> | null, action: string, detail = "") {
  try {
    const sql = await db();
    const ip = await clientIp();
    await sql`INSERT INTO audit_logs (admin_id, username, action, detail, ip)
              VALUES (${user?.id ?? null}, ${user?.username ?? ""}, ${action}, ${detail.slice(0, 1000)}, ${ip})`;
  } catch (e) {
    console.error("audit failed", e);
  }
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
  }
}

export function str(v: unknown, max = 100): string {
  return String(v ?? "").trim().slice(0, max);
}

export function int(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "잘못된 ID 입니다.");
  return n;
}
