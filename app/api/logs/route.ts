import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";

export const GET = route(["admin"], async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const page = Math.max(Number(u.get("page")) || 1, 1);
  const q = (u.get("q") || "").trim();
  const sql = await db();
  const cond = q ? sql`WHERE username ILIKE ${"%" + q + "%"} OR action ILIKE ${"%" + q + "%"} OR detail ILIKE ${"%" + q + "%"}` : sql``;
  const rows = await sql`SELECT * FROM audit_logs ${cond} ORDER BY id DESC LIMIT 100 OFFSET ${(page - 1) * 100}`;
  return ok({ rows, page });
});
