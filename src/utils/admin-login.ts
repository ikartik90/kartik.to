import { startAdminLogin } from "@/app/actions/auth";

/** Set across the redirect, so the return leg knows a login was asked for. */
export const ADMIN_LOGIN_PENDING_KEY = "adminLoginPending";

/** Never throws: its callers (the console, a palette row) have nowhere to put an exception. */
export async function adminLogin(): Promise<void> {
  try {
    // Marked only once the URL arrives, so a failed handshake leaves no mark.
    const url = await startAdminLogin();
    sessionStorage.setItem(ADMIN_LOGIN_PENDING_KEY, "1");
    window.location.assign(url);
  } catch (error) {
    console.error("[adminLogin]", error);
  }
}
