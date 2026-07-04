"use client";

import { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";
import { Typography } from "./ui/typography";

const TAGLINE = "DESIGNER • ENGINEER • BUILDER •";

const LOGO_SIZE = 48;
const ORBIT_RADIUS = 28;
const STAGE_WIDTH = 60;
const STAGE_HEIGHT = 60;
const ORBIT_CENTER_X = STAGE_WIDTH / 2;
const ORBIT_CENTER_Y = STAGE_HEIGHT / 2;
const ORBIT_DURATION_MS = 50_000;

const brandStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "calc(token(spacing.xxl) + token(spacing.sm))",
});

const orbitStageStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "48px",
  height: "48px",
  overflow: "visible",
});

const orbitSvgStyle = css({
  position: "absolute",
  top: "-6px",
  left: "-6px",
  width: "60px",
  height: "60px",
  overflow: "visible",
  pointerEvents: "none",
});

const avatarWrapStyle = css({
  position: "absolute",
  top: "0",
  left: "0",
  zIndex: 2,
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  overflow: "hidden",
});

/** Clockwise circle centered at (centerX, centerY) for upright textPath glyphs. */
function buildOrbitPath(
  centerX: number,
  centerY: number,
  radius: number,
): string {
  return [
    `M ${centerX + radius},${centerY}`,
    `A ${radius},${radius} 0 0,1 ${centerX - radius},${centerY}`,
    `A ${radius},${radius} 0 0,1 ${centerX + radius},${centerY}`,
    "Z",
  ].join(" ");
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const pathId = `brand-tagline-path-${useId().replace(/:/g, "")}`;
  const orbitTextGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!isHome) return;
    const orbitTextGroup = orbitTextGroupRef.current;
    if (!orbitTextGroup) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      orbitTextGroup.setAttribute("transform", "rotate(0)");
      return;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = ((now - start) % ORBIT_DURATION_MS) / ORBIT_DURATION_MS;
      const angle = progress * 360;
      orbitTextGroup.setAttribute("transform", `rotate(${angle})`);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isHome]);

  if (!isHome) return null;

  return (
    <header data-site-header>
      <div className={brandStyle}>
        <div className={orbitStageStyle} aria-label={TAGLINE}>
          <svg
            data-brand-orbit=""
            className={orbitSvgStyle}
            viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
            aria-hidden="true"
          >
            <defs>
              <path
                id={pathId}
                d={buildOrbitPath(
                  ORBIT_CENTER_X,
                  ORBIT_CENTER_Y,
                  ORBIT_RADIUS,
                )}
              />
            </defs>
            <g
              data-brand-orbit-pivot=""
              transform={`translate(${ORBIT_CENTER_X} ${ORBIT_CENTER_Y})`}
            >
              <g ref={orbitTextGroupRef} data-brand-orbit-text-group="">
                <g
                  transform={`translate(${-ORBIT_CENTER_X} ${-ORBIT_CENTER_Y})`}
                >
                  <text>
                    <textPath
                      href={`#${pathId}`}
                      startOffset="0"
                      data-brand-orbit-text=""
                    >
                      {TAGLINE}
                    </textPath>
                  </text>
                </g>
              </g>
            </g>
          </svg>
          <span className={avatarWrapStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-brand-avatar=""
              src="/assets/kartik-iyer-logo.png"
              alt=""
              width={LOGO_SIZE}
              height={LOGO_SIZE}
            />
          </span>
        </div>
        <Typography tag="p" type="title">
          Kartik Iyer
        </Typography>
      </div>
    </header>
  );
}
