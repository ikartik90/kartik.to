"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { css, cx } from "../../../styled-system/css";
import { BackgroundEffectLayer } from "@/components/background-effect";
import type { BackgroundEffect, MediaNode } from "@/domain/nodes";
import { useInView } from "@/hooks/use-in-view";
import { cubicBezier } from "@/utils/eased-fade";
import { CHECK_INS } from "./check-ins-content";
import { clipGround } from "./clips";
import type { ProjectCard } from "./data";
import { ONBOARDING } from "./onboarding-content";
import { SHIFT } from "./shift-content";

// A card's cover: its project's walkthrough on a bare screen, the screen's edge and a soft shadow under it, all on the
// walkthrough's shader and the dotted ground, which fade out up the card towards its heading.

const BLUE = ["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"];
const SHIFT_GLOW = clipGround(BLUE, { positions: 29, grainMixer: 0.65, offsetY: -0.08 });
const WALKTHROUGH_GLOW = clipGround(BLUE, {
  positions: 57,
  waveX: 0.49,
  waveXShift: 0.25,
  waveYShift: 0.46,
  mixing: 0.61,
  grainMixer: 0.4,
});

/** Each project's walkthrough, and the shader glowing behind its screen. */
const COVERS: Record<string, { clip: MediaNode; glow: BackgroundEffect }> = {
  "check-ins": { clip: CHECK_INS.clips[0], glow: WALKTHROUGH_GLOW },
  onboarding: { clip: ONBOARDING.clips[0], glow: WALKTHROUGH_GLOW },
  "shift-scheduling": { clip: SHIFT.clips[1], glow: SHIFT_GLOW },
};

// Clear at its top, whole 40% of the way down; 65 stops, so the ramp shows no edge. Rounded, so the server's render
// and the browser's agree.
const ease = cubicBezier(0.33, 0.19, 0.57, 1);
const FADE = {
  "--fade": `linear-gradient(to bottom, ${Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    return `rgb(0 0 0 / ${ease(t).toFixed(4)}) ${(t * 40).toFixed(2)}%`;
  }).join(", ")})`,
} as CSSProperties;

// The screen's width and its top left on the face: 96% of the face wide, 8% in and 31.3% down, running off its foot.
// On phones it zooms in to 150%, from the heading's left edge, running off the right too.
const coverStyle = css({
  "--screen-w": "96cqw",
  "--screen-x": "8cqw",
  "--screen-y": "31.3cqh",
  mdDown: { "--screen-w": "150cqw", "--screen-x": "token(spacing.xl)", "--screen-y": "44cqh" },
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  containerType: "size",
  pointerEvents: "none",
});

// From 24% down the face to its foot.
const groundStyle = css({
  position: "absolute",
  insetBlockStart: "24%",
  maskImage: "var(--fade)",
  WebkitMaskImage: "var(--fade)",
});
// Blurred, and past the face by twice its blur, so the blur doesn't dim its edges.
const glowStyle = css({
  insetInline: "calc(-2 * (token(spacing.4xl) + token(spacing.lg)))",
  insetBlockEnd: "calc(-2 * (token(spacing.4xl) + token(spacing.lg)))",
  filter: "blur(calc(token(spacing.4xl) + token(spacing.lg)))",
  opacity: 0.4,
});
// The project cards' dotted ground.
const dotsStyle = css({
  insetInline: 0,
  insetBlockEnd: 0,
  color: "text.default",
  backgroundImage:
    "radial-gradient(circle, color-mix(in srgb, currentColor 12%, transparent) 0 token(spacing.3xs), transparent token(spacing.xxs))",
  backgroundSize: "token(spacing.sm) token(spacing.sm)",
});

// The screen, 1000 × 636, its corner 18 of its 1000; its edge and shadow drawn at its scale.
const placedStyle = css({
  position: "absolute",
  insetInlineStart: "var(--screen-x)",
  insetBlockStart: "var(--screen-y)",
  width: "var(--screen-w)",
  aspectRatio: "1000 / 636",
  borderRadius: "calc(var(--screen-w) * 0.018)",
});
const shadowStyle = css({
  backgroundColor: "neutral.900",
  opacity: 0.2,
  filter: "blur(calc(var(--screen-w) * 0.0208))",
  translate: "0 calc(var(--screen-w) * 0.0042)",
});
const edgeStyle = css({ backgroundColor: "neutral.600", translate: "0 calc(var(--screen-w) * 0.0192)" });
const screenStyle = css({ overflow: "hidden", backgroundColor: "bg.canvas" });
const screenGroundStyle = css({ position: "absolute", inset: 0, width: "token(spacing.full)", height: "token(spacing.full)" });
// The walkthrough on its ground, 28 of the screen's 972 × 608 clear on every side; its corner 0.6% of the screen's
// width. Wider than 16:10, so its foot crops, never its browser bar.
const recordingStyle = css({
  position: "absolute",
  inset: "4.605% 2.881%",
  "& > video": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
    objectFit: "cover",
    objectPosition: "top",
    borderRadius: "calc(var(--screen-w) * 0.006)",
  },
});

/** Fills a card's face. The walkthrough plays while the card is in view, unless the visitor prefers reduced motion. */
export function DisplayCover({ card }: { card: ProjectCard }) {
  const ref = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { enter: 0.2, exit: 0.05 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!inView) return void video.pause();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.play()?.catch(() => {});
  }, [inView]);

  const cover = COVERS[card.id];
  if (!cover) return null;
  const { clip, glow } = cover;
  return (
    <span ref={ref} className={coverStyle} data-cover="">
      <BackgroundEffectLayer effect={glow} className={cx(groundStyle, glowStyle)} style={FADE} />
      <span aria-hidden className={cx(groundStyle, dotsStyle)} style={FADE} data-cover-dots="" />
      <span aria-hidden className={cx(placedStyle, shadowStyle)} />
      <span aria-hidden className={cx(placedStyle, edgeStyle)} />
      <span className={cx(placedStyle, screenStyle)}>
        {clip.backgroundEffect && (
          <BackgroundEffectLayer effect={clip.backgroundEffect} className={screenGroundStyle} />
        )}
        <span className={recordingStyle}>
          {clip.kind === "video" && (
            <video
              ref={videoRef}
              src={clip.src}
              poster={clip.poster}
              aria-label={clip.alt}
              muted
              loop
              playsInline
              preload="metadata"
            />
          )}
        </span>
      </span>
    </span>
  );
}
