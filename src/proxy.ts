import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

// Cookie name used by @neondatabase/auth to cache the session client-side.
const SESSION_DATA_COOKIE = "__Secure-neon-auth.local.session_data";

// Admin route prefix — matches the (admin) route group once it exists.
const ADMIN_PATTERN = /^\/(admin)(\/|$)/;

async function getSessionEmail(request: NextRequest): Promise<string | null> {
  const cookie = request.cookies.get(SESSION_DATA_COOKIE)?.value;
  if (!cookie) return null;

  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(
      cookie,
      new TextEncoder().encode(secret),
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

  if (ADMIN_PATTERN.test(pathname)) {
    const adminId = process.env.ADMIN_GITHUB_ID;
    const email = await getSessionEmail(request);

    // Return 404 (not 401) to mask the existence of admin routes.
    if (!adminId || !email || email !== adminId) {
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
