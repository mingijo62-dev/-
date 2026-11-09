import { db } from "@/lib/db";
import { ok, route } from "@/lib/api";

/** 필터용 값 목록 (부서/근무조/직책 등) */
export const GET = route(["admin"], async () => {
  const sql = await db();
  const [r] = await sql`
    SELECT
      COALESCE(array_agg(DISTINCT shift_type) FILTER (WHERE shift_type <> ''), '{}') AS shift_type,
      COALESCE(array_agg(DISTINCT department) FILTER (WHERE department <> ''), '{}') AS department,
      COALESCE(array_agg(DISTINCT work_group) FILTER (WHERE work_group <> ''), '{}') AS work_group,
      COALESCE(array_agg(DISTINCT position)   FILTER (WHERE position <> ''), '{}')   AS position
    FROM employees WHERE active`;
  return ok(r);
});
