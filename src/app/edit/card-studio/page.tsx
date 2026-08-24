import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { CardStudio } from "./card-studio";

// ---------------------------------------------------------------------------
// Card Studio — where a card's background is tuned before it is published as a
// component.
//
// An EDIT route, not a `/dev` playground, and the move is the point: what comes
// out of here is meant to be published and inserted, so it belongs in the same
// namespace as everything else that writes to the site, behind the same gate.
// A visitor gets the same 404 the other admin routes give — the studio does not
// admit to existing.
//
// A STATIC segment, so Next matches it ahead of `/edit/[slug]`.
//
// The studio itself is a client component: it is one long-lived piece of local
// UI state (which shader, its uniforms, the canvas theme) over a WebGL canvas,
// and none of it is the server's business. This file is the gate and nothing
// else.
// ---------------------------------------------------------------------------

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

export default async function CardStudioPage() {
  // 404, not 401 — the admin routes do not admit to existing.
  if (!(await isAdmin())) notFound();

  return <CardStudio />;
}
