"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { ShiftSchedulingV0 } from "@/components/demo/shift-scheduling-v0";

// ---------------------------------------------------------------------------
// Local-only preview for the "Old Shift Scheduling" demo (Figma 745:4375 light
// / 745:4080 dark), rendered through the DemoFrame exactly as the article
// renderer and the Insert Component overlay do — one source of truth, so this
// page and the embedded demo can never drift.
// ---------------------------------------------------------------------------

const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5xl",
});

const stageStyle = css({
  width: "token(sizes.articleShowcase)",
  maxWidth: "token(spacing.full)",
});

export default function ShiftSchedulingV0PreviewPage() {
  return (
    <main className={pageStyle}>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="md">
          <ShiftSchedulingV0 />
        </DemoFrame>
      </div>
    </main>
  );
}
