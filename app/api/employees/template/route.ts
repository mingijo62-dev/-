import { route } from "@/lib/api";
import { templateWorkbook, xlsxResponse } from "@/lib/excel";

export const GET = route(["admin"], async () => xlsxResponse(await templateWorkbook(), "직원등록_양식.xlsx"));
