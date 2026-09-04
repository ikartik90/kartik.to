import type { Metadata } from "next";
import { CalchemyPlayground } from "./calchemy-playground";

// ---------------------------------------------------------------------------
// Calchemy Playground — a year of calendar driven by one line of English.
//
// PUBLIC, and reached the way the shader playground beside it is reached: ⌘K,
// then the Playgrounds group. It was gated to a 404 while the parser was raw
// enough that its wrong answers were the point — but a workbench nobody can
// walk into is a workbench for one, and this one writes nothing: the engine
// loads in the browser, reads a phrase and paints the days it means. There was
// never anything behind the gate to protect.
//
// Kept out of the index all the same. It is a tool with a name rather than a
// page with a subject, and it has no business turning up in a search for one.
//
// The playground itself is a client component: an engine that loads in the
// browser, a phrase, and the days it means. None of it is the server's
// business, and "today" deliberately is not either — see the component.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Calchemy Playground",
  description: "Fire natural language date queries at a year of calendar.",
  robots: { index: false, follow: false },
};

export default function CalchemyPlaygroundPage() {
  return <CalchemyPlayground />;
}
