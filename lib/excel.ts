import ExcelJS from "exceljs";

export const EMP_HEADERS = ["사번", "구분", "성명", "부서", "근무조", "직책"] as const;

const ALIASES: Record<string, string[]> = {
  emp_no: ["사번", "사원번호", "직원번호", "empno", "emp_no"],
  name: ["이름", "성명", "name"],
  shift_type: ["교대/주전", "교대주전", "교대/주전구분", "근무형태", "근무구분", "구분", "shift_type"],
  department: ["부서", "부서명", "소속", "department"],
  work_group: ["근무조", "조", "work_group"],
  position: ["직책", "직위", "직급", "position"],
};

const norm = (s: string) => s.replace(/\s/g, "").toLowerCase();

export async function readEmployeeSheet(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  // 헤더 행 탐색 (상위 10행 내 '사번' 포함 행)
  let headerRow = 0;
  const colMap: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const found: Record<string, number> = {};
    row.eachCell((cell, col) => {
      const t = norm(cell.text || "");
      for (const [key, list] of Object.entries(ALIASES)) {
        if (!(key in found) && list.map(norm).includes(t)) found[key] = col;
      }
    });
    if ("emp_no" in found && "name" in found) {
      headerRow = r;
      Object.assign(colMap, found);
      break;
    }
  }
  if (!headerRow) throw new Error("헤더 행에서 '사번', '이름' 열을 찾을 수 없습니다. 양식을 확인하세요.");

  const rows: { line: number; data: Record<string, string> }[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const data: Record<string, string> = {};
    let empty = true;
    for (const [key, col] of Object.entries(colMap)) {
      const v = (row.getCell(col).text || "").trim();
      if (v) empty = false;
      data[key] = v;
    }
    if (!empty) rows.push({ line: r, data });
  }
  return rows;
}

export async function templateWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("직원명단");
  ws.addRow([...EMP_HEADERS]);
  ws.addRow(["A10001", "교대", "홍길동", "생산2팀-PM23", "D반", "수습사원"]);
  ws.addRow(["A10002", "주전", "김안전", "안전환경팀", "", "팀장"]);
  styleHeader(ws, EMP_HEADERS.length);
  ws.columns.forEach((c) => (c.width = 16));
  const help = wb.addWorksheet("작성안내");
  [
    ["작성 안내"],
    ["1. '직원명단' 시트 1행의 헤더명을 변경하지 마세요. (사번, 성명 필수 — 직원이 출석할 때 사번·성명을 입력합니다)"],
    ["2. 구분 열에는 '교대' 또는 '주전'을 입력하세요."],
    ["3. 사번이 이미 등록된 경우 정보가 갱신되며 기존 QR코드는 그대로 유지됩니다."],
    ["4. 예시 행(2~3행)은 삭제 후 업로드하세요."],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 80;
  return wb;
}

export function styleHeader(ws: ExcelJS.Worksheet, cols: number, rowNo = 1) {
  const row = ws.getRow(rowNo);
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5F5C" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF999999" } } };
  }
}

export async function xlsxResponse(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="download.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
