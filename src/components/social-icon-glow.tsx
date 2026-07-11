import type { CSSProperties, ReactNode } from "react";
import { css, cx } from "../../styled-system/css";

// A crisp SVG icon at rest; on hover a living brand gradient fills the icon's
// silhouette. The gradient is a plain DOM layer masked by the icon shape and
// spun with `transform` only — the whole effect lives on the compositor thread,
// so it never competes with the main-thread canvas cursor. There is no WebGL
// context, no rAF, and no async mount, so the reveal can't drop a blank frame.

const slotStyle = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
});

const iconLayerStyle = css({
  position: "absolute",
  inset: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

// The masked window. Always in the DOM; only its opacity changes on hover, which
// the compositor animates. `mask` clips the gradient below to the icon shape.
const glowLayerStyle = css({
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  maskSize: "contain",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  pointerEvents: "none",
});

const glowLayerActiveStyle = css({ opacity: 1 });

// Oversized so any rotation still covers the 20px box (side ≥ box·√2); clipped
// by the parent. Paused at rest so idle icons cost the compositor nothing.
const glowGradientStyle = css({
  position: "absolute",
  top: "-50%",
  left: "-50%",
  width: "200%",
  height: "200%",
  backgroundImage:
    "conic-gradient(from 0deg, token(colors.brand.pink), token(colors.brand.orange), #ffffff, token(colors.brand.orange), token(colors.brand.pink))",
  filter: "blur(1px)",
  animationName: "social-glow-spin",
  animationDuration: "5s",
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
  animationPlayState: "paused",
  willChange: "transform",
});

const glowGradientActiveStyle = css({ animationPlayState: "running" });

export function SocialIconGlow({
  maskSrc,
  active,
  children,
}: {
  maskSrc: string;
  active: boolean;
  children: ReactNode;
}) {
  const maskStyle: CSSProperties = {
    maskImage: `url("${maskSrc}")`,
    WebkitMaskImage: `url("${maskSrc}")`,
  };

  return (
    <span className={slotStyle}>
      <span className={iconLayerStyle} aria-hidden>
        {children}
      </span>
      <span
        className={cx(glowLayerStyle, active && glowLayerActiveStyle)}
        style={maskStyle}
        data-social-icon-glow
        data-glow-active={active ? "" : undefined}
        aria-hidden
      >
        <span
          className={cx(glowGradientStyle, active && glowGradientActiveStyle)}
        />
      </span>
    </span>
  );
}
