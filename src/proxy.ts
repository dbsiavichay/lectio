import { NextResponse, type NextRequest } from "next/server";

// Kept in sync with SESSION_COOKIE: the proxy can't import server modules.
const SESSION_COOKIES = ["__Host-lectio_session", "lectio_session"];
const PUBLIC = ["/entrar"];

/**
 * An optimistic check: without a session cookie, go sign in. Whether the
 * session is valid is decided by the Data Access Layer on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return;
  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip Next internals, the health check, and files (icons, manifest, fonts).
    "/((?!_next/|healthz|.*\\..*).*)",
  ],
};
