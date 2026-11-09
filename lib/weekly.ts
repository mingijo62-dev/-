import { createHmac, timingSafeEqual } from "crypto";
import type { Sql } from "./db";

/** KST 기준 이번 주(월~일) 정보 */
export function weekInfo(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - dow));
  const end = new Date(start.getTime() + 6 * 86400e3);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { key: f(start), start: f(start), end: f(end) };
}

export async function getSetting(sql: Sql, key: string) {
  const [r] = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return r?.value ?? null;
}

export async function setSetting(sql: Sql, key: string, value: string) {
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

function sign(weekKey: string, version: string) {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(`weekly-qr:${weekKey}:v${version}`).digest("base64url").slice(0, 22);
}

/** 이번 주 공용 QR 토큰 (매주 월요일 0시 KST 자동 교체, 관리자 수동 교체 시 version 증가) */
export async function currentWeeklyToken(sql: Sql) {
  const w = weekInfo();
  const version = (await getSetting(sql, "qr_version")) ?? "1";
  return { token: sign(w.key, version), ...w, version };
}

export async function verifyWeeklyToken(sql: Sql, token: string) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return false;
  const { token: cur } = await currentWeeklyToken(sql);
  return timingSafeEqual(Buffer.from(cur), Buffer.from(token));
}
