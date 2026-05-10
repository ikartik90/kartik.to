import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";

export const neonSql = neon(env.DATABASE_URL);
