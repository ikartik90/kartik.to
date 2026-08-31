"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { SchedulingLayoutRedesign } from "@/components/demo/scheduling-layout-redesign";

// ---------------------------------------------------------------------------
// Local-only preview for the Scheduling Layout Redesign demo (Figma 1143:6560),
// rendered through the DemoFrame exactly as the article renderer and the Insert
// Component overlay do — one source of truth, so this page and the embedded
// demo can never drift.
//
// This is a REVIEW page, and the /dev previews were retired on purpose (#119:
// "so the public site is only the site") — a route here is a route the
// production domain serves to anyone who guesses it. It is meant to be deleted
// once the demo has been looked at, not merged.
//
// The theme control is the whole reason it earns its keep over reading the demo
// in an article: the Figma draws this in both themes, the accent flips from
// pink to orange between them, and the redlines and the step rules are both
// drawn in that accent — so the pair has to be checked as a pair.
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

const themeSlotStyle = css({
  position: "fixed",
  top: "3xl",
  insetInlineEnd: "3xl",
});

export default function SchedulingLayoutRedesignPreviewPage() {
  return (
    <main className={pageStyle}>
      <div className={themeSlotStyle}>
        <ThemeToggleButton />
      </div>
      <div className={stageStyle}>
        <DemoFrame aspectRatio="2/1">
          <SchedulingLayoutRedesign />
        </DemoFrame>
      </div>
    </main>
  );
}
