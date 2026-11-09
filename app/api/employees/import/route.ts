import { db } from "@/lib/db";
import { audit, HttpError, ok, route } from "@/lib/api";
import { newQrToken } from "@/lib/common";
import { readEmployeeSheet } from "@/lib/excel";
import { parseEmp, type EmpInput } from "@/lib/employees";

export const maxDuration = 60;

export const POST = route(["admin"], async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get("file");
  const deactivateMissing = form.get("deactivateMissing") === "1";
  if (!(file instanceof File)) throw new HttpError(400, "파일을 선택하세요.");
  if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "파일은 10MB 이하만 가능합니다.");
  if (!/\.xlsx$/i.test(file.name)) throw new HttpError(400, ".xlsx 형식의 엑셀 파일만 업로드할 수 있습니다.");

  let raw;
  try {
    raw = await readEmployeeSheet(await file.arrayBuffer());
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "엑셀 파일을 읽을 수 없습니다.");
  }

  const errors: string[] = [];
  const map = new Map<string, EmpInput>();
  for (const { line, data } of raw) {
    try {
      const e = parseEmp(data);
      if (map.has(e.emp_no)) errors.push(`${line}행: 사번 ${e.emp_no} 중복 (마지막 행으로 반영)`);
      map.set(e.emp_no, e);
    } catch (err) {
      errors.push(`${line}행: ${err instanceof Error ? err.message : "오류"}`);
    }
  }
  const list = [...map.values()];
  if (!list.length) throw new HttpError(400, "등록할 데이터가 없습니다. " + errors.slice(0, 5).join(" / "));

  const sql = await db();
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;
  await sql.begin(async (tx) => {
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500).map((e) => ({ ...e, qr_token: newQrToken(), active: true }));
      const res = await tx<{ inserted: boolean }[]>`
        INSERT INTO employees ${tx(chunk, "emp_no", "name", "shift_type", "department", "work_group", "position", "qr_token", "active")}
        ON CONFLICT (emp_no) DO UPDATE SET
          name = EXCLUDED.name, shift_type = EXCLUDED.shift_type, department = EXCLUDED.department,
          work_group = EXCLUDED.work_group, position = EXCLUDED.position, active = true, updated_at = now()
        RETURNING (xmax = 0) AS inserted`;
      for (const r of res) r.inserted ? inserted++ : updated++;
    }
    if (deactivateMissing) {
      const nos = list.map((e) => e.emp_no);
      deactivated = (await tx`UPDATE employees SET active = false, updated_at = now()
                              WHERE active AND emp_no NOT IN ${tx(nos)}`).count;
    }
  });
  await audit(user, "엑셀업로드", `${file.name}: 신규 ${inserted}, 갱신 ${updated}, 비활성 ${deactivated}, 오류 ${errors.length}`);
  return ok({ inserted, updated, deactivated, errors: errors.slice(0, 100), errorCount: errors.length });
});
