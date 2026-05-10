import { createNeonAuth } from "@neondatabase/auth/next/server";
import { env } from "@/lib/env";

export const neonAuth = createNeonAuth({
  baseUrl: env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: env.NEON_AUTH_COOKIE_SECRET,
    sameSite: "lax",
  },
});
