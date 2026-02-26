import { NextRequest, NextResponse } from "next/server";
import { getConfiguredPin, isSessionAuthenticated } from "@/lib/auth-session";

export function middleware(request: NextRequest) {
  const configured = getConfiguredPin();
  if (!configured) {
    return NextResponse.next();
  }

  const authenticated = isSessionAuthenticated(request);
  if (authenticated) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized. PIN required." }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/pin";
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/documents/:path*", "/api/documents/:path*"],
};
