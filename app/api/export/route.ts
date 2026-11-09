import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { audit, int, route } from "@/lib/api";
import { DIMENSIONS, targetCond } from "@/lib/common";
import { styleHeader, xlsxResponse } from "@/lib/excel";
import { trainingStats } from "@/lib/stats";
import { getTraining } from "@/lib/trainings";

export const maxDuration = 60;

export const GET = route(["admin"], async ({ req, user }) => {
  const id = int(new URL(req.url).searchParams.get("trainingId"));
  const sql = await db();
  const t = await getTraining(sql, id);
  const s = await trainingStats(sql, t);
  const rows = await sql`
    SELECT e.emp_no, e.name, e.shift_type, e.department, e.work_group, e.position,
           (a.id IS NOT NULL) AS attended, r.round_no,
           to_char(a.checked_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS checked_at,
           a.method, ad.name AS checked_by
    FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.training_id = ${t.id}
    LEFT JOIN rounds r ON r.id = a.round_id LEFT JOIN admins ad ON ad.id = a.checked_by
    WHERE ${targetCond(sql, t.target)}
    ORDER BY e.department, e.work_group, e.emp_no`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "안전교육 출석관리";
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  // 1) 요약
  const ws = wb.addWorksheet("요약");
  ws.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];
  ws.addRow([t.title]).font = { bold: true, size: 14 };
  ws.addRow([`출력일시: ${now}  /  출력자: ${user.name}`]);
  ws.addRow([]);
  const hdr = ["구분", "대상자", "참석", "미참석", "참석률(%)"];
  const addTable = (title: string, items: { key: string; total: number; attended: number }[]) => {
    ws.addRow([title]).font = { bold: true, size: 12 };
    const h = ws.addRow(hdr);
    styleHeader(ws, hdr.length, h.number);
    for (const it of items) {
      ws.addRow([it.key, it.total, it.attended, it.total - it.attended, it.total ? Math.round((it.attended / it.total) * 1000) / 10 : 0]);
    }
    ws.addRow([]);
  };
  addTable("전체 현황", [{ key: "전체", total: s.total, attended: s.attended }]);
  for (const d of DIMENSIONS) addTable(`${d.label}별 현황`, s.breakdown[d.key]);
  ws.addRow(["차수별 참석 인원"]).font = { bold: true, size: 12 };
  const rh = ws.addRow(["차수", "교육일자", "시간", "장소", "참석"]);
  styleHeader(ws, 5, rh.number);
  for (const r of s.rounds) ws.addRow([`${r.round_no}차`, r.edu_date, `${r.start_time}~${r.end_time}`, r.location, r.attended]);

  // 2) 전체 명단 / 3) 미참석자
  const cols = [
    { header: "사번", key: "emp_no", width: 12 },
    { header: "이름", key: "name", width: 10 },
    { header: "교대/주전", key: "shift_type", width: 10 },
    { header: "부서", key: "department", width: 18 },
    { header: "근무조", key: "work_group", width: 9 },
    { header: "직책", key: "position", width: 10 },
    { header: "참석여부", key: "status", width: 9 },
    { header: "차수", key: "round", width: 7 },
    { header: "참석시간", key: "checked_at", width: 20 },
    { header: "처리방식", key: "method", width: 9 },
    { header: "처리자", key: "checked_by", width: 10 },
  ];
  const mk = (name: string, list: (typeof rows)[number][]) => {
    const w = wb.addWorksheet(name);
    w.columns = cols;
    styleHeader(w, cols.length);
    w.views = [{ state: "frozen", ySplit: 1 }];
    w.autoFilter = { from: "A1", to: "K1" };
    for (const r of list) {
      const row = w.addRow({
        ...r,
        status: r.attended ? "참석" : "미참석",
        round: r.round_no ? `${r.round_no}차` : "",
        method: r.method === "self" ? "QR자가" : r.method === "qr" ? "QR" : r.method === "manual" ? "수기" : "",
      });
      if (!r.attended) row.getCell(7).font = { color: { argb: "FFC0392B" }, bold: true };
    }
  };
  mk("전체명단", rows);
  mk("미참석자", rows.filter((r) => !r.attended));

  await audit(user, "엑셀다운로드", `${t.title} (${rows.length}명)`);
  const date = new Date().toISOString().slice(0, 10);
  return xlsxResponse(wb, `${t.title}_참석현황_${date}.xlsx`.replace(/[\\/:*?"<>|]/g, "_"));
});
