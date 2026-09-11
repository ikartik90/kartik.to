import { createNeonAuth } from "@neondatabase/auth/next/server";
import { env } from "@/lib/env";

export const auth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sameSite: "lax",
  },
});

// ---------------------------------------------------------------------------
// The authorization boundary.
//
// Next's own guidance is that the boundary belongs "as close as possible to
// your data source" rather than in a layout or the proxy — a layout cannot be
// it, because "Next.js applications have multiple entry points", and the proxy
// runs on prefetches and can only read the cookie. So these two functions are
// it: every admin page calls `isAdmin`, every server action calls
// `requireAdmin`, and nothing re-types the comparison.
//
// It was re-typed for a while, in four different spellings across eleven call
// sites. They happened to agree, but only because `env.ADMIN_GITHUB_ID` is
// `z.email()` and so can never be empty — half of them said so and half of them
// silently depended on it. One spelling, in one place, is the point.
// ---------------------------------------------------------------------------

/**
 * Is the caller the author? The one server-side answer to that — every admin
 * route asks it before rendering, and every one of them answers a refusal with
 * `notFound()` rather than a 401, so the route never admits to existing.
 *
 * Public routes ask it too, for a different reason: `/work/:slug` and
 * `/writing/:slug` use the answer to decide whether an unpublished draft is
 * visible. Same question, so the same helper — it is not only a gate.
 *
 * The client has its own answer (`useIsAdmin`), and it is only ever about what
 * to DRAW. This is the one that decides what may be seen or done.
 */
export async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

/**
 * The same question as a throw, for callers that have no way to render a
 * refusal — every server action begins with this.
 *
 * `Unauthorized` because that is the message all six action modules already
 * threw, character for character, from six private copies of this function.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
