import type { Metadata } from "next";
import { SITE_PAGES } from "@/data/site-paths";
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
// Indexed like the other playgrounds: `site-index` lists it in `sitemap.xml`
// and `llms.txt`, so its metadata must not refuse a crawler.
//
// The playground itself is a client component: an engine that loads in the
// browser, a phrase, and the days it means. None of it is the server's
// business, and "today" deliberately is not either — see the component.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: SITE_PAGES.calchemy.title,
  description: "Fire natural language date queries at a year of calendar.",
};

export default function CalchemyPlaygroundPage() {
  return <CalchemyPlayground />;
}
