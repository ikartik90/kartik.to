"use client";

import { toProcessedGemSmoke } from "@paper-design/shaders";
import { GemSmoke } from "@paper-design/shaders-react";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { css, cx } from "../../styled-system/css";

const BRAND_PINK = "#FF4D97";
const BRAND_ORANGE = "#FFAB6F";
const TRANSPARENT = "#00000000";

const FLUORESCENT = {
  innerDistortion: 0.5,
  outerDistortion: 0.8,
  outerGlow: 0,
  innerGlow: 1,
  offset: 0,
  angle: 0,
  size: 0.8,
} as const;

const maskPromises = new Map<string, Promise<void>>();

function preloadMask(src: string) {
  const cached = maskPromises.get(src);
  if (cached) return cached;

  const promise = toProcessedGemSmoke(src)
    .then(() => undefined)
    .catch(() => undefined);
  maskPromises.set(src, promise);
  return promise;
}

function useMaskReady(src: string) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    preloadMask(src).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  return ready;
}

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

const flatIconHiddenStyle = css({ opacity: 0 });

const shaderHiddenStyle = css({ opacity: 0, pointerEvents: "none" });

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
  const maskReady = useMaskReady(maskSrc);
  const showShader = active && !reducedMotion && maskReady;
  const colors =
    theme === "light"
      ? [BRAND_ORANGE, BRAND_PINK, "#ffffff"]
      : [BRAND_PINK, BRAND_ORANGE, "#ffffff"];

  return (
    <span className={slotStyle}>
      <span
        className={cx(layerStyle, showShader && flatIconHiddenStyle)}
        aria-hidden
      >
        {children}
      </span>
      <GemSmoke
        aria-hidden
        data-social-icon-shader
        data-shader-active={showShader ? "" : undefined}
        className={cx(layerStyle, !showShader && shaderHiddenStyle)}
        image={maskSrc}
        width={20}
        height={20}
        fit="contain"
        scale={1}
        speed={showShader ? 1 : 0}
        colors={colors}
        colorBack={TRANSPARENT}
        colorInner={TRANSPARENT}
        {...FLUORESCENT}
      />
    </span>
  );
}
