import { NextResponse } from "next/server";
import { neonAuth } from "@/lib/auth/server";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const nextPath = reqUrl.searchParams.get("next") ?? "/";
  const callbackURL =
    nextPath.startsWith("http://") || nextPath.startsWith("https://")
      ? nextPath
      : `${reqUrl.origin}${nextPath.startsWith("/") ? nextPath : `/${nextPath}`}`;

  // Route through /auth/verify so unauthorized accounts are signed out
  // before landing on the final destination.
  const verifyUrl = new URL("/auth/verify", reqUrl.origin);
  verifyUrl.searchParams.set("next", callbackURL);

  const result = await neonAuth.signIn.social({
    provider: "github",
    callbackURL: verifyUrl.toString(),
  });

  if (result.error) {
    const message =
      typeof result.error.message === "string"
        ? result.error.message
        : String(result.error?.message ?? result.error ?? "oauth_error");
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(message)}`, reqUrl.origin),
    );
  }

  const redirectUrl = result.data?.url as string | undefined;
  if (typeof redirectUrl === "string" && redirectUrl.length > 0) {
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL("/?auth_error=no_oauth_redirect", reqUrl.origin));
}
