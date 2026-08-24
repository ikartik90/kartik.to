import type { Metadata } from "next";
import { CoverPlayground } from "./cover-playground";

// ---------------------------------------------------------------------------
// Cover Playground — where a cover's background is tuned before it is published
// as a component.
//
// PUBLIC, and reached the way everything else on this site is reached: ⌘K, then
// the Playground group. It began life as an admin tool under `/edit`, gated to
// a 404 like the routes that write to the database — but it writes nothing. It
// reads a shader table, draws a canvas, and hands back a JSX tag on the
// clipboard, all of it in the browser. There was nothing behind the gate to
// protect, and a playground nobody can walk into is a demo of a demo.
//
// It keeps its own segment rather than joining `/dev`: those are the design
// system's living previews, one per primitive, and this is a finished thing
// with a name.
//
// The playground itself is a client component: it is one long-lived piece of
// local UI state (which shader, its uniforms) over a WebGL canvas, and none of
// it is the server's business. This file is the route and its title.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Cover Playground",
  description: "Tune a cover's shader background and copy it out as JSX.",
};

export default function CoverPlaygroundPage() {
  return <CoverPlayground />;
}
