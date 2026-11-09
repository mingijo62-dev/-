import { db } from "@/lib/db";
import { int, ok, route } from "@/lib/api";
import { trainingStats } from "@/lib/stats";
import { getTraining } from "@/lib/trainings";

export const GET = route(["admin"], async ({ req }) => {
  const id = int(new URL(req.url).searchParams.get("trainingId"));
  const sql = await db();
  const t = await getTraining(sql, id);
  return ok({ training: t, ...(await trainingStats(sql, t)), at: new Date().toISOString() });
});
