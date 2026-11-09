import { db } from "@/lib/db";
import { audit, HttpError, ok, route } from "@/lib/api";
import { newQrToken } from "@/lib/common";
import { extractRows, FIELDS, inspect, loadWorkbook, type Mapping } from "@/lib/excel";
import { parseEmp, type EmpInput } from "@/lib/employees";

export const maxDuration = 60;

/**
 * 회사 보유 엑셀 그대로 업로드
 *  mode=preview : 시트/헤더행/열 자동 매칭 결과와 샘플 반환
 *  mode=import  : 지정한 시트·헤더행·열 매핑으로 등록
 */
export const POST = route(["admin"], async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "파일을 선택하세요.");
  if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "파일은 10MB 이하만 가능합니다.");

  let wb;
  try {
    wb = await loadWorkbook(file);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "파일을 읽을 수 없습니다.");
  }
  const sheet = String(form.get("sheet") || "") || undefined;
  const headerRow = Number(form.get("headerRow")) || undefined;

  if (form.get("mode") !== "import") {
    try {
      return ok(inspect(wb, sheet, headerRow));
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "파일 분석 실패");
    }
  }

  let mapping: Mapping;
  try {
    const m = JSON.parse(String(form.get("mapping") || "{}"));
    mapping = {};
    for (const f of FIELDS) if (Number(m[f.key]) > 0) mapping[f.key] = Number(m[f.key]);
  } catch {
    throw new HttpError(400, "열 지정 정보가 올바르지 않습니다.");
  }
  const deactivateMissing = form.get("deactivateMissing") === "1";
  let raw;
  try {
    raw = extractRows(wb, sheet || wb.worksheets[0].name, headerRow || 1, mapping);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "엑셀 파일을 읽을 수 없습니다.");
  }

  const errors: string[] = [];
  const map = new Map<string, EmpInput>();
  for (const { line, data } of raw) {
    if (!data.emp_no && !data.name) continue; // 소계·구분선 등 사번/성명 없는 행은 건너뜀
    try {
      const e = parseEmp(data);
      if (map.has(e.emp_no)) errors.push(`${line}행: 사번 ${e.emp_no} 중복 (마지막 행으로 반영)`);
      map.set(e.emp_no, e);
    } catch (err) {
      errors.push(`${line}행: ${err instanceof Error ? err.message : "오류"}`);
    }
  }
  const list = [...map.values()];
  const hasSup = !!mapping.is_supervisor;
  if (!list.length) throw new HttpError(400, "등록할 데이터가 없습니다. " + errors.slice(0, 5).join(" / "));

  const sql = await db();
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;
  await sql.begin(async (tx) => {
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500).map((e) => ({ ...e, is_supervisor: !!e.is_supervisor, qr_token: newQrToken(), active: true }));
      const res = await tx<{ inserted: boolean }[]>`
        INSERT INTO employees ${tx(chunk, "emp_no", "name", "shift_type", "department", "work_group", "position", "is_supervisor", "qr_token", "active")}
        ON CONFLICT (emp_no) DO UPDATE SET
          name = EXCLUDED.name, active = true, updated_at = now()
          ${mapping.shift_type ? tx`, shift_type = EXCLUDED.shift_type` : tx``}
          ${mapping.department ? tx`, department = EXCLUDED.department` : tx``}
          ${mapping.work_group ? tx`, work_group = EXCLUDED.work_group` : tx``}
          ${mapping.position ? tx`, position = EXCLUDED.position` : tx``}
          ${hasSup ? tx`, is_supervisor = EXCLUDED.is_supervisor` : tx``}
        RETURNING (xmax = 0) AS inserted`;
      for (const r of res) r.inserted ? inserted++ : updated++;
    }
    if (deactivateMissing) {
      const nos = list.map((e) => e.emp_no);
      deactivated = (await tx`UPDATE employees SET active = false, updated_at = now()
                              WHERE active AND emp_no NOT IN ${tx(nos)}`).count;
    }
  });
  const supervisors = list.filter((e) => e.is_supervisor).length;
  await audit(user, "엑셀업로드", `${file.name}[${sheet ?? ""}]: 신규 ${inserted}, 갱신 ${updated}, 비활성 ${deactivated}, 관리감독자 ${hasSup ? supervisors : "열없음"}, 오류 ${errors.length}`);
  return ok({ inserted, updated, deactivated, supervisors: hasSup ? supervisors : null, errors: errors.slice(0, 100), errorCount: errors.length });
});
