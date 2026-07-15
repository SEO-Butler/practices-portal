import { NextResponse, type NextRequest } from "next/server";

// Runs in front of every matched request (Next 16 proxy, formerly
// middleware): cross-origin write protection for the API plus baseline
// security headers on all responses.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  // CSRF hardening: state-changing API requests must come from our own
  // origin. SameSite=Lax already blocks cross-site cookie sends for POST;
  // this adds explicit Origin/Host agreement as defense in depth.
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !SAFE_METHODS.has(request.method)
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost !== host) {
        return NextResponse.json(
          { error: "Cross-origin request rejected" },
          { status: 403 },
        );
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return response;
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|sw.js).*)"],
};
