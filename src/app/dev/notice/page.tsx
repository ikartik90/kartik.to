"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { ShiftSchedulingV1 } from "@/components/demo/shift-scheduling-v1";

// ---------------------------------------------------------------------------
// Local-only preview for the Notice component in its scheduling showcase. Renders
// the registered `shift-scheduling-v1` demo through the DemoFrame exactly as the
// article renderer and the Insert Component overlay do — one source of truth for
// the showcase, so this page and the embedded demo can never drift.
// ---------------------------------------------------------------------------

const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5xl",
});

const stageStyle = css({ width: "token(sizes.articleShowcase)", maxWidth: "token(spacing.full)" });

export default function NoticeShowcasePage() {
  return (
    <main className={pageStyle}>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="md">
          <ShiftSchedulingV1 />
        </DemoFrame>
      </div>
    </main>
  );
}
