"use server";

import { auth } from "@/lib/auth/server";

// ---------------------------------------------------------------------------
// The one thing a visitor with no session is allowed to ask the server for:
// where to go to get one.
//
// The handshake is started HERE rather than in the browser because starting it
// is the server's business — it is the half that holds the Neon Auth base URL,
// the cookie secret and the state Neon mints to recognise the browser when it
// comes back. The client's part is what is left over once that is done: follow
// the URL. So this returns the URL rather than performing the redirect itself,
// which is what lets the same answer serve a console call, a palette command,
// or anything else that later wants to send someone to sign in.
//
// `disableRedirect` is what makes that possible: without it Neon Auth answers
// the POST with a 302 and the caller never sees the address.
//
// Nothing is gated. This is the front door, and a door that only opens for
// people who are already inside is not one — the gate is on the way BACK, where
// `proxy.ts` checks the session's email against `ADMIN_GITHUB_ID` and 404s
// anyone else out of the admin routes. Signing in with GitHub is not the same
// thing as being the author, and only the second of those is worth guarding.
// ---------------------------------------------------------------------------

/** Where the browser has to go to sign in, once the handshake is under way. */
export async function startAdminLogin(): Promise<string> {
  const { data, error } = await auth.signIn.social({
    provider: "github",
    callbackURL: "/",
    disableRedirect: true,
  });

  if (error) throw new Error(error.message ?? "Could not reach the provider");
  if (!data?.url) throw new Error("No authorization URL came back");

  return data.url;
}
