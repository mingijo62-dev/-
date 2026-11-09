import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/setup", "/a/"];

/** 미로그인 사용자를 로그인 화면으로 (원래 주소는 next 로 보존). 세부 검증은 서버 레이아웃/API에서 수행 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("sea_sess")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|icon.svg|robots.txt).*)"],
};
