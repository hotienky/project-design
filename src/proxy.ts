import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic auth for the UI and REST routes (APP_BASIC_AUTH="user:pass").
 * /api/mcp authenticates with bearer tokens and /api/health must stay open for
 * the container healthcheck, so the matcher skips both.
 */
export function proxy(request: NextRequest) {
  const expected = process.env.APP_BASIC_AUTH;
  if (!expected) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded && safeEqual(decodeBase64(encoded), expected)) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Project Design", charset="UTF-8"' },
  });
}

function decodeBase64(value: string): string {
  try {
    return atob(value);
  } catch {
    return "";
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!api/mcp|api/health|_next/static|_next/image|favicon.ico).*)"],
};
