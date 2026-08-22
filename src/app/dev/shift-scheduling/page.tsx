"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { ShiftSchedulingV0 } from "@/components/demo/shift-scheduling-v0";
import { ShiftSchedulingV1 } from "@/components/demo/shift-scheduling-v1";
import { ShiftSchedulingV2 } from "@/components/demo/shift-scheduling-v2";

// ---------------------------------------------------------------------------
// Local-only preview of all three Shift Scheduling demos on ONE page, rendered
// through the DemoFrame exactly as the article renderer does — the sibling of
// `dev/shift-scheduling-v0`, which previews that one alone.
//
// Stacked rather than side by side because the thing this page exists to show
// is page-scoped: each frame performs itself when it comes on screen, and the
// page makes its "Try it yourself" offer ONCE, on whichever run finishes first.
// A screen of space between them means only one frame can be 70% visible at a
// time, so scrolling down the page runs them in order, the way an article does.
// ---------------------------------------------------------------------------

const pageStyle = css({
  backgroundColor: "bg.canvas",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  // A viewport of clear air above, below and between, so a frame arrives at the
  // in-view gate on its own rather than in company.
  gap: "100dvh",
  paddingBlock: "50dvh",
  paddingInline: "5xl",
});

const stageStyle = css({
  width: "token(sizes.articleShowcase)",
  maxWidth: "token(spacing.full)",
});

export default function ShiftSchedulingPreviewPage() {
  return (
    <main className={pageStyle}>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="3/2">
          <ShiftSchedulingV0 />
        </DemoFrame>
      </div>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="3/2">
          <ShiftSchedulingV1 />
        </DemoFrame>
      </div>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="3/2">
          <ShiftSchedulingV2 />
        </DemoFrame>
      </div>
    </main>
  );
}
