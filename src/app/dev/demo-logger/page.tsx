"use client";

import { DemoFrame } from "@/components/demo-frame";
import { CalchemyDemo } from "@/components/demo/calchemy-demo";

/** Local-only preview route for debugging demo logger layout. */
export default function DemoLoggerPreviewPage() {
  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <DemoFrame logger>
        <CalchemyDemo />
      </DemoFrame>
    </main>
  );
}
