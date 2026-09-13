import type { Metadata } from "next";
import { IconsPlayground } from "./icons-playground";

// ---------------------------------------------------------------------------
// Icons Playground — the icon set, at any size and any weight.
//
// PUBLIC, on the same grounds as the two playgrounds beside it, and reached
// the same way: ⌘K, then the Playgrounds group. The sliders write nothing —
// they redraw a set of files that are already on a public bucket — and the
// three things that DO write (upload, publish, delete) are the author's and
// are checked on the server. A playground nobody can walk into is a demo of a
// demo.
//
// Kept out of the index, as Calchemy is: it is a tool with a name rather than
// a page with a subject, and it has no business turning up in a search for
// one.
//
// The playground itself is a client component — a grid of files fetched from
// the bucket and repainted at whatever the sliders say, which is all local
// state over a public read. This file is the route and its title.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Icons Playground",
  description: "Scale and re-weight the icon set, and take it away as SVG.",
  robots: { index: false, follow: false },
};

export default function IconsPlaygroundPage() {
  return <IconsPlayground />;
}
