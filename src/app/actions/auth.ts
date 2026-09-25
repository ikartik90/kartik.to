"use server";

import { auth } from "@/lib/auth/server";

// Deliberately public: the sign-in front door. isAdmin() gates the session that comes back.

/** Returns the GitHub sign-in URL; `disableRedirect` stops Neon Auth answering with a 302 instead. */
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
