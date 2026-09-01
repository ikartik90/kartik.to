import { startAdminLogin } from "@/app/actions/auth";

// ---------------------------------------------------------------------------
// Signing in, from wherever it was asked for.
//
// There are two doors onto it — `window.adminLogin()` in the console and
// `> window.adminLogin()` in the command palette — and they are the same door.
// Written once here so they cannot drift into two answers to one question; the
// bootstrap hangs it off `window`, the palette's registry names it, and neither
// of them knows anything about GitHub.
//
// The logic worth having is on the server (`startAdminLogin`). What is left
// over is this: ask where to go, mark the trip, go. The mark is read on the way
// back by `AdminLoginBootstrap`, which is the only part of the round trip that
// cannot live in one function, because the page it would report into has been
// thrown away and rebuilt by then.
// ---------------------------------------------------------------------------

/** Set across the redirect, so the return leg knows a login was asked for. */
export const ADMIN_LOGIN_PENDING_KEY = "adminLoginPending";

/**
 * Send the browser to GitHub to sign in, coming back to `/`.
 *
 * Never throws: it is called from a console prompt and from a palette row, and
 * neither has anywhere to put an exception. A failure to get the URL leaves the
 * page exactly where it was, with the reason on the console.
 */
export async function adminLogin(): Promise<void> {
  try {
    // Ordered so a handshake that never started leaves no mark to mislead the
    // next page load.
    const url = await startAdminLogin();
    sessionStorage.setItem(ADMIN_LOGIN_PENDING_KEY, "1");
    window.location.assign(url);
  } catch (error) {
    console.error("[adminLogin]", error);
  }
}
