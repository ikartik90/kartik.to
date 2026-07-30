"use client";

import { css } from "../../../../styled-system/css";
import { DemoFrame } from "@/components/demo-frame";
import { CalchemyDemo } from "@/components/demo/calchemy-demo";
import { Typography } from "@/components/ui/typography";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });
const stackStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
  marginTop: "5xl",
});

/** Local-only preview route for debugging demo logger layout. */
export default function DemoLoggerPreviewPage() {
  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <DemoFrame logger>
        <CalchemyDemo />
      </DemoFrame>

      <div className={stackStyle}>
        {/* Copy that HAS text: the bar takes the string's own width, so the
            wireframe occupies exactly the space the live heading will. */}
        <span className={captionStyle}>
          Typography — bars sized by the text they replace
        </span>
        <Wireframe>
          <Typography tag="h2" type="title">
            Scheduling shifts across sites
          </Typography>
          <Typography tag="p" type="bodyLarge">
            A short standfirst under the heading.
          </Typography>
        </Wireframe>

        {/* Copy that has NO text yet — the loading case. Nothing can be
            measured, so the shape is stated: `lines` stacks bars at the current
            line box, with the ragged last line real paragraphs have. */}
        <span className={captionStyle}>
          Skeleton lines — a paragraph whose text has not arrived
        </span>
        <Wireframe mode="loading">
          <Typography tag="h2" type="title">
            <Skeleton width="18ch" />
          </Typography>
          <Typography tag="p" type="bodyLarge">
            <Skeleton lines={4} />
          </Typography>
        </Wireframe>
      </div>
    </main>
  );
}
