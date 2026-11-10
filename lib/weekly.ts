import { createHmac, timingSafeEqual } from "crypto";
import type { Sql } from "./db";

/** KST 기준 오늘(하루) 정보 — 출석 QR은 매일 0시(KST)에 자동 교체 */
export function dayInfo(now = new Date()) {
  const day = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  return { key: day, start: day, end: day };
}
const GRACE_MIN = 30; // 자정 직전 스캔 후 자정을 넘겨 제출하는 경우 허용(분)

export async function getSetting(sql: Sql, key: string) {
  const [r] = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return r?.value ?? null;
}

export async function setSetting(sql: Sql, key: string, value: string) {
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

function sign(dayKey: string, version: string) {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(`daily-qr:${dayKey}:v${version}`).digest("base64url").slice(0, 22);
}

/** 오늘의 공용 출석 QR 토큰 (매일 0시 KST 자동 교체, 관리자 수동 교체 시 version 증가) */
export async function currentWeeklyToken(sql: Sql) {
  const d = dayInfo();
  const version = (await getSetting(sql, "qr_version")) ?? "1";
  return { token: sign(d.key, version), ...d, version };
}

export async function verifyWeeklyToken(sql: Sql, token: string) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return false;
  const version = (await getSetting(sql, "qr_version")) ?? "1";
  const now = new Date();
  const keys = [dayInfo(now).key];
  // 자정 직후 30분 동안은 전날 QR도 허용
  const prev = dayInfo(new Date(now.getTime() - GRACE_MIN * 60e3)).key;
  if (prev !== keys[0]) keys.push(prev);
  const t = Buffer.from(token);
  return keys.some((k) => timingSafeEqual(Buffer.from(sign(k, version)), t));
}
