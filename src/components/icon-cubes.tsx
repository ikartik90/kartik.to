"use client";

import { useRef } from "react";
import { css, cx } from "../../styled-system/css";
import { IconDrawing } from "./icon-drawing";
import { ICON_SIZES, ICON_STROKES, type CoverIcon } from "@/domain/icon";
import { useIconCubes } from "@/hooks/use-icon-cubes";

const COLUMNS = 5;
const ICON = { size: ICON_SIZES[1], stroke: ICON_STROKES[1] };
const HIDDEN = { display: "none" } as const;

// On the playground's canvas, over the card's own ground.
const coverStyle = css({
  position: "absolute",
  inset: 0,
  overflow: "clip",
  isolation: "isolate",
  backgroundColor: "bg.canvas",
  color: "text.default",
});

// The cubes and the icons over them are laid out alike, so each icon's place at rest is its cube's front.
const gridStyle = css({
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gridAutoRows: "minmax(0, 1fr)",
  placeItems: "center",
  padding: "3xl",
  gap: "xl",
  containerType: "inline-size",
  "--cube": "calc((100cqw - 4 * token(spacing.xl)) / 5)",
});

// The perspective is `CUBE_PERSPECTIVE` cubes, which the icons are fitted through.
const cellStyle = css({ width: "var(--cube)", height: "var(--cube)", perspective: "calc(var(--cube) * 4)" });

// Turned about its centre, half a face behind its front.
const bodyStyle = css({
  position: "relative",
  display: "block",
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  transformOrigin: "50% 50% calc(var(--cube) / -2)",
  transformStyle: "preserve-3d",
});

// Opaque, so a turn shows only the faces in front. A side is the brand surface: `bg.highlight` laid over the canvas
// as a solid layer, since it's translucent.
const faceStyle = css({
  position: "absolute",
  inset: 0,
  backgroundColor: "bg.canvas",
  transformOrigin: "50% 50% calc(var(--cube) / -2)",
  backfaceVisibility: "hidden",
  "&[data-side]": {
    backgroundImage: "linear-gradient(token(colors.bg.highlight), token(colors.bg.highlight))",
  },
});

// Its own stacking context, so the icons are painted into it at their slant rather than each lifted onto a layer of
// its own over the 3D faces, which Safari would draw flat and shrink unsmoothed.
const layerStyle = css({ isolation: "isolate", pointerEvents: "none" });
const flatCellStyle = css({ position: "relative", width: "var(--cube)", height: "var(--cube)" });
const flatIconStyle = css({
  position: "absolute",
  inset: 0,
  margin: "auto",
  display: "flex",
  width: "fit-content",
  height: "fit-content",
  transformOrigin: "0 0",
  "&[data-side]": { color: "text.highlight" },
});

/** The set's icons on a grid of cubes that turn toward the cursor and flip to fresh icons as it passes over them. */
export function IconCubes({ icons }: { icons: CoverIcon[] }) {
  const grid = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const faces = useIconCubes({ icons, columns: COLUMNS, iconSize: ICON.size, grid, layer });

  return (
    <div className={coverStyle} data-icon-cubes="">
      <div ref={grid} className={gridStyle}>
        {faces.map((cube, i) => (
          <span key={i} className={cellStyle}>
            <span className={bodyStyle}>
              {cube.map((_, element) => (
                <span key={element} className={faceStyle} style={element ? HIDDEN : undefined} />
              ))}
            </span>
          </span>
        ))}
      </div>
      <div ref={layer} className={cx(gridStyle, layerStyle)}>
        {faces.map((cube, i) => (
          <span key={i} className={flatCellStyle}>
            {cube.map((icon, element) => (
              <span key={element} className={flatIconStyle} style={element ? HIDDEN : undefined}>
                <IconDrawing svg={icon.svg} settings={ICON} />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
