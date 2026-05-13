import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = [
  "/profile", "/chat","/dm","/music", "/upload", "/history",
  "/games/chess/online",
  "/games/checkers/online",
  "/games/billiards/online",
  "/games/battleship/online",
  "/games/minesweeper/online",
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token");

    if (!token) {
      const url = new URL("/auth/required", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};