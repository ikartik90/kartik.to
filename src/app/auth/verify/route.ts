import { NextResponse } from "next/server";
import { neonAuth } from "@/lib/auth/server";

// Neon Auth cookie names (from @neondatabase/auth internals).
// These must be cleared to fully sign out an unauthorized user.
const AUTH_COOKIES = [
  "__Secure-neon-auth.session_token",
  "__Secure-neon-auth.local.session_data",
  "__Secure-neon-auth.session_challange",
];

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const next = reqUrl.searchParams.get("next") ?? "/";

  const { data: session } = await neonAuth.getSession();
  const adminEmail = process.env.ADMIN_GITHUB_ID;

  if (session?.user && adminEmail && session.user.email === adminEmail) {
    return NextResponse.redirect(new URL(next, reqUrl.origin));
  }

  // Sign out by expiring all Neon Auth session cookies.
  const response = NextResponse.redirect(
    new URL("/?auth_error=unauthorized", reqUrl.origin),
  );
  for (const name of AUTH_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
