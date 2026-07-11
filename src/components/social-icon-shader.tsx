"use client";

import { GemSmoke } from "@paper-design/shaders-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { css, cx } from "../../styled-system/css";

const BRAND_PINK = "#FF4D97";
const BRAND_ORANGE = "#FFAB6F";
const TRANSPARENT = "#00000000";

// Cap the render buffer so retina screens don't quadruple the fragment work on
// a 20px icon. 40×40 ≈ 2×; smoke is soft, so it reads fine well below native DPR.
const SHADER_MAX_PIXELS = 40 * 40;

const FLUORESCENT = {
  innerDistortion: 0.5,
  outerDistortion: 0.8,
  outerGlow: 0,
  innerGlow: 1,
  offset: 0,
  angle: 0,
  size: 0.8,
} as const;

function subscribeTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Create the WebGL context + compile the program + fetch the mask texture BEFORE
// the hover, so hovering only resumes an already-live shader (speed 0 → 1). Two
// triggers, whichever comes first:
//   • first pointer movement — fires before any hover, and works even if the tab
//     was hidden at load (rAF is paused in background tabs; pointer events aren't);
//   • post-paint (double rAF) — covers a foreground page the user just settles on.
// Measured: this removes the ~90ms "mask still loading" pop-in on the first hover;
// a warm hover is a pure speed toggle with no context/compile/fetch on the path.
function useShaderWarmup(enabled: boolean) {
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (!enabled || warm) return;
    let done = false;
    const warmNow = () => {
      if (done) return;
      done = true;
      setWarm(true);
    };
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(warmNow);
    });
    window.addEventListener("pointermove", warmNow, {
      once: true,
      passive: true,
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("pointermove", warmNow);
    };
  }, [enabled, warm]);

  return warm;
}

const slotStyle = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
});

const layerStyle = css({
  position: "absolute",
  inset: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});

// The line icon crossfades out as the shader takes over, so only the shader
// shows on hover (its fade-in covers the swap — no blank frame).
const iconLayerStyle = css({
  transitionProperty: "opacity",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
});

const iconHiddenStyle = css({ opacity: 0 });

const shaderLayerStyle = css({
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
  pointerEvents: "none",
});

const shaderVisibleStyle = css({ opacity: 1, _starting: { opacity: 0 } });

export function SocialIconShader({
  maskSrc,
  active,
  children,
}: {
  maskSrc: string;
  active: boolean;
  children: ReactNode;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light");
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const enabled = !reducedMotion;
  const warm = useShaderWarmup(enabled);
  // Warm before any real hover and `warm` never flips back, so the context stays
  // mounted (parked at speed 0) — moving between icons just toggles speed, never
  // remounts. A hover in the first frame mounts on demand once (the only path
  // that can still feel a compile).
  const mounted = enabled && (warm || active);
  const showShader = enabled && active;

  const colors =
    theme === "light"
      ? [BRAND_ORANGE, BRAND_PINK, "#ffffff"]
      : [BRAND_PINK, BRAND_ORANGE, "#ffffff"];

  return (
    <span className={slotStyle}>
      <span
        className={cx(layerStyle, iconLayerStyle, showShader && iconHiddenStyle)}
        aria-hidden
      >
        {children}
      </span>
      {mounted && (
        <GemSmoke
          aria-hidden
          data-social-icon-shader
          data-shader-active={showShader ? "" : undefined}
          className={cx(
            layerStyle,
            shaderLayerStyle,
            showShader && shaderVisibleStyle,
          )}
          image={maskSrc}
          width={20}
          height={20}
          fit="contain"
          scale={1}
          speed={showShader ? 1 : 0}
          maxPixelCount={SHADER_MAX_PIXELS}
          colors={colors}
          colorBack={TRANSPARENT}
          colorInner={TRANSPARENT}
          {...FLUORESCENT}
        />
      )}
    </span>
  );
}
