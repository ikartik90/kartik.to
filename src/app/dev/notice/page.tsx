"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { ShiftSchedulingV1 } from "@/components/demo/shift-scheduling-v1";
import { Notice } from "@/components/ui/notice";
import { Wireframe } from "@/components/ui/wireframe";
import InfoIcon from "@/assets/icons/info.svg";

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

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

export default function NoticeShowcasePage() {
  return (
    <main className={pageStyle}>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "3xl",
          width: "token(sizes.articleShowcase)",
          maxWidth: "token(spacing.full)",
        })}
      >
        <div className={stageStyle}>
          <DemoFrame aspectRatio="md">
            <ShiftSchedulingV1 />
          </DemoFrame>
        </div>

        <span className={captionStyle}>live</span>
        <Notice>
          <Notice.Icon>
            <InfoIcon />
          </Notice.Icon>
          <Notice.Label>
            Shifts posted after <strong>6 PM</strong> are queued until the next
            morning.
          </Notice.Label>
        </Notice>

        {/* The wash, radius and status glyph are the Notice's identity, so they
            stay; the message becomes one continuous bar — the inline <strong>
            included, since a run of prose reads as a single line, not as three
            fragments. */}
        <span className={captionStyle}>placeholder — one bar across the run</span>
        <Wireframe>
          <Notice>
            <Notice.Icon>
              <InfoIcon />
            </Notice.Icon>
            <Notice.Label>
              Shifts posted after <strong>6 PM</strong> are queued until the next
              morning.
            </Notice.Label>
          </Notice>
        </Wireframe>

        <span className={captionStyle}>loading — shimmering</span>
        <Wireframe mode="loading">
          <Notice>
            <Notice.Icon>
              <InfoIcon />
            </Notice.Icon>
            <Notice.Label>
              Shifts posted after <strong>6 PM</strong> are queued until the next
              morning.
            </Notice.Label>
          </Notice>
        </Wireframe>
      </div>
    </main>
  );
}
