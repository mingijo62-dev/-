import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

export const COOKIE = "sea_sess";
const MAX_AGE = 60 * 60 * 10; // 10시간

export type Role = "admin" | "staff";
export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET 환경변수(16자 이상)가 필요합니다.");
  return new TextEncoder().encode(s);
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({ uid: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** 쿠키 검증 + DB에서 계정 존재 여부 재확인(삭제/권한변경 즉시 반영) */
export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = Number(payload.uid);
    if (!uid) return null;
    const sql = await db();
    const rows = await sql<SessionUser[]>`SELECT id, username, name, role FROM admins WHERE id = ${uid}`;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
