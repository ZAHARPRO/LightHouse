import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/profile", "/feed", "/chat"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token");

    if (!token) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};