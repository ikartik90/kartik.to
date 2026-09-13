import type { Metadata } from "next";
import { listApprovedIconsWithSvg } from "@/lib/icons";
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
// The playground itself is a client component — a grid repainted at whatever
// the sliders say, which is all local state. What it is repainting comes from
// HERE: the approved set, read and parsed on the server (`@/lib/icons`) and
// handed down as a prop.
//
// That read asks nothing about who is calling, which is what keeps this route
// STATIC — it runs at build and at each revalidation, never on a visit. The
// grid used to build itself in the browser instead, a listing on mount and
// then one request per icon, and it cost a second on a warm cache and four on
// a cold one, every time. Measured both ways: 4,225ms to 46ms cold, 1,079ms to
// 60ms warm, and 310 requests down to 26.
//
// The author's held icons are the one part this cannot carry — see
// `listHeldIcons`. Any session read here would make the route dynamic for
// everybody in order to answer a question about one person.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Icons Playground",
  description: "Scale and re-weight the icon set, and take it away as SVG.",
  robots: { index: false, follow: false },
};

export default async function IconsPlaygroundPage() {
  return <IconsPlayground prerendered={await listApprovedIconsWithSvg()} />;
}
