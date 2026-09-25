"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { css } from "../../styled-system/css";
import { MenuButton } from "./menu-button";
import { ThemeToggle } from "./theme-toggle";

const TAGLINE = "DESIGNER • BUILDER • ENGINEER •";

const LOGO_SIZE = 48;
const ORBIT_RADIUS = 28;
const STAGE_WIDTH = 60;
const STAGE_HEIGHT = 60;
const ORBIT_CENTER_X = STAGE_WIDTH / 2;
const ORBIT_CENTER_Y = STAGE_HEIGHT / 2;
/** Orbit start angle, clockwise; tuned to align the tagline. */
const ORBIT_INITIAL_ANGLE_DEG = -132;

const brandStyle = css({
  display: "flex",
  justifyContent: "center",
});

const orbitStageStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "48px",
  height: "48px",
  overflow: "visible",
});

// An HTML box, not an SVG group, so Blink runs the spin on the compositor.
const orbitSpinnerStyle = css({
  position: "absolute",
  top: "-6px",
  left: "-6px",
  width: "60px",
  height: "60px",
  overflow: "visible",
  pointerEvents: "none",
  transformOrigin: "center",
});

const orbitSvgStyle = css({
  display: "block",
  width: "60px",
  height: "60px",
  overflow: "visible",
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
  // `/edit/home` is the homepage being edited, and keeps the header's furniture.
  const isHome = pathname === "/" || pathname === "/edit/home";
  const pathId = `brand-tagline-path-${useId().replace(/:/g, "")}`;

  if (!isHome) return null;

  return (
    <header data-site-header>
      <div data-site-menu>
        <MenuButton />
      </div>
      <div data-site-brand className={brandStyle}>
        <div className={orbitStageStyle} aria-label={TAGLINE}>
          <div
            data-brand-orbit-spinner=""
            className={orbitSpinnerStyle}
            style={
              {
                "--brand-orbit-initial-angle": `${ORBIT_INITIAL_ANGLE_DEG}deg`,
              } as React.CSSProperties
            }
          >
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
                <g data-brand-orbit-text-group="">
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
          </div>
          <span className={avatarWrapStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-brand-avatar=""
              src="/assets/kartik-iyer-logo.png"
              // Named, not decorative: no title beside it says the name.
              alt="Kartik Iyer"
              width={LOGO_SIZE}
              height={LOGO_SIZE}
            />
          </span>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
}
