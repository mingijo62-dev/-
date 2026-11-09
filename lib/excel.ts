import ExcelJS from "exceljs";

export const EMP_HEADERS = ["사번", "구분", "성명", "부서", "근무조", "직책", "관리감독자"] as const;

export const FIELDS = [
  { key: "emp_no", label: "사번", required: true },
  { key: "name", label: "성명", required: true },
  { key: "shift_type", label: "구분(교대/주전)", required: false },
  { key: "department", label: "부서", required: false },
  { key: "work_group", label: "근무조", required: false },
  { key: "position", label: "직책", required: false },
  { key: "is_supervisor", label: "관리감독자", required: false },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>; // 필드 → 열 번호(1부터)

const ALIASES: Record<FieldKey, string[]> = {
  emp_no: ["사번", "사원번호", "직원번호", "개인번호", "직번", "사원no", "사번no", "empno", "emp_no", "id"],
  name: ["성명", "이름", "성함", "사원명", "직원명", "name"],
  shift_type: ["구분", "교대/주전", "교대주전", "교대/주전구분", "근무형태", "근무구분", "교대구분", "근무형태구분", "shift_type"],
  department: ["부서", "부서명", "소속", "소속부서", "팀", "팀명", "department"],
  work_group: ["근무조", "조", "반", "근무반", "조/반", "work_group"],
  position: ["직책", "직위", "직급", "position"],
  is_supervisor: ["관리감독자", "관리감독자여부", "관리감독", "관리감독자지정", "supervisor"],
};

const norm = (s: string) => s.replace(/[\s\n\r]/g, "").toLowerCase();
const cellText = (ws: ExcelJS.Worksheet, r: number, c: number) => {
  try {
    return (ws.getRow(r).getCell(c).text || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
};

/** CSV 파싱 (따옴표 지원) */
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** .xlsx 또는 .csv(UTF-8/EUC-KR) 를 워크북으로 */
export async function loadWorkbook(file: File) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  if (name.endsWith(".csv")) {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { text = new TextDecoder("euc-kr").decode(buf); }
    const ws = wb.addWorksheet("CSV");
    parseCsv(text.replace(/^\uFEFF/, "")).forEach((r) => ws.addRow(r));
    return wb;
  }
  if (name.endsWith(".xls")) throw new Error("예전 엑셀 형식(.xls)은 읽을 수 없습니다. 엑셀에서 [다른 이름으로 저장 → Excel 통합 문서(*.xlsx)]로 저장한 뒤 올려주세요.");
  if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm")) throw new Error(".xlsx 또는 .csv 파일만 올릴 수 있습니다.");
  try {
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw new Error("엑셀 파일을 읽을 수 없습니다. 암호가 걸려 있다면 해제 후 다시 저장해서 올려주세요.");
  }
  return wb;
}

function guessHeader(ws: ExcelJS.Worksheet) {
  // 상위 30행 중 알려진 열 이름이 가장 많이 일치하는 행
  let best = { row: 1, score: 0, mapping: {} as Mapping };
  const maxCol = Math.min(ws.columnCount || 30, 60);
  for (let r = 1; r <= Math.min(30, ws.rowCount); r++) {
    const mapping: Mapping = {};
    for (let c = 1; c <= maxCol; c++) {
      const t = norm(cellText(ws, r, c));
      if (!t) continue;
      for (const f of FIELDS) {
        if (mapping[f.key] === undefined && ALIASES[f.key].map(norm).includes(t)) { mapping[f.key] = c; break; }
      }
    }
    const score = Object.keys(mapping).length + (mapping.name ? 2 : 0) + (mapping.emp_no ? 2 : 0);
    if (score > best.score) best = { row: r, score, mapping };
  }
  return best;
}

function autoMap(ws: ExcelJS.Worksheet, headerRow: number): Mapping {
  const mapping: Mapping = {};
  const maxCol = Math.min(ws.columnCount || 30, 60);
  for (let c = 1; c <= maxCol; c++) {
    const t = norm(cellText(ws, headerRow, c));
    for (const f of FIELDS) if (t && mapping[f.key] === undefined && ALIASES[f.key].map(norm).includes(t)) { mapping[f.key] = c; break; }
  }
  return mapping;
}

/** 업로드 미리보기: 시트 목록, 헤더 행 추정, 열 자동 매칭, 샘플 */
export function inspect(wb: ExcelJS.Workbook, sheetName?: string, headerRow?: number) {
  const sheets = wb.worksheets.filter((w) => w.rowCount > 0);
  if (!sheets.length) throw new Error("데이터가 있는 시트가 없습니다.");
  // 시트 미지정 시: 헤더 매칭 점수가 가장 높은 시트
  let ws = sheets.find((w) => w.name === sheetName);
  let guess = ws ? guessHeader(ws) : null;
  if (!ws) {
    for (const w of sheets) {
      const g = guessHeader(w);
      if (!guess || g.score > guess.score) { guess = g; ws = w; }
    }
  }
  ws = ws!;
  const hr = headerRow && headerRow > 0 ? headerRow : guess!.row;
  const mapping = headerRow ? autoMap(ws, hr) : guess!.mapping;
  const maxCol = Math.min(ws.columnCount || 1, 60);
  const headers = Array.from({ length: maxCol }, (_, i) => ({ col: i + 1, text: cellText(ws, hr, i + 1) }));
  // 사번·성명 열을 찾았으면 둘 중 하나라도 있는 행만 (합계·빈 줄 제외)
  const keyCols = [mapping.emp_no, mapping.name].filter((c): c is number => !!c);
  const isData = (r: number) => (keyCols.length ? keyCols : headers.map((h) => h.col)).some((c) => cellText(ws, r, c));
  const sample: string[][] = [];
  let dataRows = 0;
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    if (!isData(r)) continue;
    dataRows++;
    if (sample.length < 5) sample.push(headers.map((h) => cellText(ws, r, h.col)));
  }
  return { sheets: sheets.map((w) => w.name), sheet: ws.name, headerRow: hr, headers, mapping, sample, dataRows };
}

/** 매핑대로 직원 행 추출 */
export function extractRows(wb: ExcelJS.Workbook, sheetName: string, headerRow: number, mapping: Mapping) {
  const ws = wb.worksheets.find((w) => w.name === sheetName);
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");
  if (!mapping.emp_no || !mapping.name) throw new Error("'사번'과 '성명' 열을 지정하세요.");
  const rows: { line: number; data: Record<string, string> }[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const data: Record<string, string> = {};
    let empty = true;
    for (const [key, col] of Object.entries(mapping)) {
      if (!col) continue;
      const v = cellText(ws, r, col);
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
  ws.addRow(["A10001", "교대", "홍길동", "생산2팀-PM23", "D반", "수습사원", ""]);
  ws.addRow(["A10002", "주전", "김안전", "안전환경팀", "", "팀장", "Y"]);
  styleHeader(ws, EMP_HEADERS.length);
  ws.columns.forEach((c) => (c.width = 16));
  const help = wb.addWorksheet("작성안내");
  [
    ["작성 안내"],
    ["1. '직원명단' 시트 1행의 헤더명을 변경하지 마세요. (사번, 성명 필수 — 직원이 출석할 때 사번·성명을 입력합니다)"],
    ["2. 구분 열에는 '교대' 또는 '주전'을 입력하세요."],
    ["3. 사번이 이미 등록된 경우 정보가 갱신되며 기존 QR코드는 그대로 유지됩니다."],
    ["4. 관리감독자 열: 관리감독자이면 'Y' (빈칸이면 일반 직원). 관리감독자는 모든 교육에서 자동으로 '출석 인정' 처리됩니다."],
    ["   ※ 관리감독자 열을 아예 빼고 올리면 기존에 지정된 관리감독자 설정이 그대로 유지됩니다."],
    ["5. 예시 행(2~3행)은 삭제 후 업로드하세요."],
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
