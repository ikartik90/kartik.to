import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { CalchemyPlayground } from "./calchemy-playground";

// ---------------------------------------------------------------------------
// Calchemy Playground — a year of calendar driven by one line of English.
//
// GATED, unlike the shader playground next door. That one is a finished thing
// with nothing behind it to protect, and it is offered from ⌘K logged out. This
// is a workbench for a parser still being written: it exists to find the
// phrases Calchemy gets wrong, which is not a thing to hand a visitor. A 404
// rather than a 401, like every other admin route here — the route does not
// admit to existing.
//
// The playground itself is a client component: an engine that loads in the
// browser, a phrase, and the days it means. None of it is the server's
// business, and "today" deliberately is not either — see the component.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Calchemy Playground",
  description: "Fire natural language date queries at a year of calendar.",
  // It is behind the gate; keep it out of the index regardless.
  robots: { index: false, follow: false },
};

export default async function CalchemyPlaygroundPage() {
  if (!(await isAdmin())) notFound();

  return <CalchemyPlayground />;
}
