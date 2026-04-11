import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/profile", "/feed", "/chat", "/upload", "/post/new"];

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isProtected) return NextResponse.next();

  // Check for any next-auth session cookie (works for both http and https)
  const sessionCookie =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token");

  if (!sessionCookie) {
    const signInUrl = new URL("/auth/signin", request.nextUrl);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
