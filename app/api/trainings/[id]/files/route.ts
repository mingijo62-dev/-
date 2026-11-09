import { db } from "@/lib/db";
import { audit, HttpError, int, ok, route } from "@/lib/api";
import { extOf, FILE_EXT, FILE_MAX, mimeOf } from "@/lib/files";
import { getTraining } from "@/lib/trainings";

export const maxDuration = 60;

/** 교육 자료 업로드 (여러 파일) */
export const POST = route<{ id: string }>(["admin"], async ({ req, user, params }) => {
  const id = int(params.id);
  const sql = await db();
  const t = await getTraining(sql, id);
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError(400, "파일을 선택하세요.");
  for (const f of files) {
    if (!FILE_EXT.includes(extOf(f.name))) throw new HttpError(400, `${f.name}: 허용되지 않는 형식입니다. (${FILE_EXT.join(", ")})`);
    if (f.size > FILE_MAX) throw new HttpError(400, `${f.name}: 파일은 4MB 이하만 업로드할 수 있습니다.`);
  }
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer());
    await sql`INSERT INTO training_files (training_id, filename, mime, size, data, uploaded_by)
              VALUES (${id}, ${f.name.slice(0, 200)}, ${mimeOf(f.name)}, ${f.size}, ${data}, ${user.id})`;
  }
  await audit(user, "자료업로드", `${t.title}: ${files.map((f) => f.name).join(", ")}`);
  return ok({ count: files.length });
});
