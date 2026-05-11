import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// Cookie Neon Auth mints after a successful session exchange.
// It's a signed JWT containing the user's session data (including email).
const SESSION_DATA_COOKIE = "__Secure-neon-auth.local.session_data";

// Admin route prefix — matches the (admin) route group once it exists.
const ADMIN_PATTERN = /^\/(admin)(\/|$)/;

async function getSessionEmail(request: NextRequest): Promise<string | null> {
  const cookie = request.cookies.get(SESSION_DATA_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const { payload } = await jwtVerify(
      cookie,
      new TextEncoder().encode(env.NEON_AUTH_COOKIE_SECRET),
      { algorithms: ["HS256"] },
    );
    const user = (payload as Record<string, unknown>).user as
      | { email?: string }
      | null
      | undefined;
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes: 404 (not 401) to mask their existence.
  if (ADMIN_PATTERN.test(pathname)) {
    const email = await getSessionEmail(request);
    if (!email || email !== env.ADMIN_GITHUB_ID) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
