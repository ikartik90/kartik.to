"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { css, cx } from "../../styled-system/css";
import { hotkey } from "../../styled-system/recipes";
import MenuIcon from "@/assets/icons/menu.svg";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { openCommandPalette } from "@/utils/command-palette-channel";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

const TAGLINE = "DESIGNER • BUILDER • ENGINEER •";

const LOGO_SIZE = 48;
const ORBIT_RADIUS = 28;
const STAGE_WIDTH = 60;
const STAGE_HEIGHT = 60;
const ORBIT_CENTER_X = STAGE_WIDTH / 2;
const ORBIT_CENTER_Y = STAGE_HEIGHT / 2;
/** Clockwise offset in degrees before/at orbit start. Tweak to align tagline copy. */
const ORBIT_INITIAL_ANGLE_DEG = -132;

// One thing in the row now, so the row's whole job is to put it in the middle
// of the column the page below it reads on.
const brandStyle = css({
  display: "flex",
  justifyContent: "center",
});

// The shortcut and the tooltip are the same button's label wearing two faces,
// and they are never both up. At rest the chip says how to reach the menu
// without the mouse; the moment a cursor arrives, the tooltip beside it says
// what the menu IS, and the chip that was answering the other question steps
// out of the way. `visibility` rather than `display` so the button never moves,
// on the tooltip's own 150ms ease-out so one hands over to the other.
//
// Both faces are cursor-first by nature — `_hasCursor` withholds the chip from
// a device with no key to press, exactly as hover withholds the tooltip from a
// device with no pointer to reveal it. A touch visitor gets the icon and its
// accessible name, which is all that is true for them.
const shortcutStyle = css({
  display: "none",
  _hasCursor: { display: "flex" },
  transitionProperty: "opacity, visibility",
  transitionDuration: "150ms",
  transitionTimingFunction: "ease-out",
  "button:hover ~ &": {
    opacity: 0,
    visibility: "hidden",
  },
});

const orbitStageStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "48px",
  height: "48px",
  overflow: "visible",
});

/** Plain HTML box that carries the spin. Blink composites transform
 *  animations on HTML elements (unlike inner-SVG <g>/<svg>), so the rotation
 *  runs on the compositor thread and stays smooth during load. */
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
  const isHome = pathname === "/";
  const pathId = `brand-tagline-path-${useId().replace(/:/g, "")}`;
  // The chip names the key this visitor's keyboard actually has — ⌘K on Apple
  // hardware, Ctrl K on a PC — which is the same shortcut the palette listens
  // for on each.
  const shortcut = useShortcutLabel("K");

  if (!isHome) return null;

  return (
    <header data-site-header>
      {/* The left gutter's control, in the same seat the article pages give
          their back link: flush with the showcase edge, centred on the first
          row of the page. Both are the one control the surface opens with —
          and the theme toggle answers it from the gutter opposite. */}
      <div data-site-menu>
        <Button variant="icon" aria-label="Menu" onClick={openCommandPalette}>
          <MenuIcon />
          <Button.Tooltip>
            <Tooltip.Text>Menu</Tooltip.Text>
          </Button.Tooltip>
        </Button>
        <kbd className={cx(hotkey(), shortcutStyle)} data-site-menu-shortcut>
          {shortcut}
        </kbd>
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
              // Named, not decorative: with no title beside it the picture is
              // the only place the name is said, so an empty alt would take it
              // off the page for anyone not looking at it.
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
