import { createNeonAuth } from "@neondatabase/auth/next/server";
import { env } from "@/lib/env";

export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sameSite: "lax",
  },
});

/**
 * Is the caller the author? The one server-side answer to that — every admin
 * route asks it before rendering, and every one of them answers a refusal with
 * `notFound()` rather than a 401, so the route never admits to existing.
 *
 * The client has its own answer (`useIsAdmin`), and it is only ever about what
 * to DRAW. This is the one that decides what may be seen or done.
 */
export async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}
