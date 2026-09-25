"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { css } from "../../../../styled-system/css";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { useTakenLabels } from "./use-taken-labels";
import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import type { IconViewSettings } from "@/domain/icon";
import { selectionAfterClick, type Rect } from "./icon-selection";
import { IconTile, iconWellStyle } from "./icon-tile";
import type { IconEntry } from "./use-icon-library";

// A size container, so the grid measures the room beside the docked panel, not the window.
const columnStyle = css({
  containerType: "inline-size",
  containerName: "iconSheet",
  marginInline: "auto",
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
});

// `auto-fill`, not `auto-fit`, so a short set is not stretched across the row.
const gridStyle = css({
  display: "grid",
  gap: "sm",
  justifyItems: "stretch",

  gridTemplateColumns:
    "repeat(auto-fill, minmax(calc(var(--icon-well) + 2 * token(spacing.md)), 1fr))",

  // Ten across, unless the drawing no longer fits a tenth (4× on a 24 grid).
  "@container iconSheet (min-width: 960px)": {
    gridTemplateColumns:
      "repeat(auto-fill, minmax(max(calc(var(--icon-draw) + 2 * token(spacing.md)), calc((token(spacing.full) - 9 * token(spacing.sm)) / 10)), 1fr))",
  },

  _bottomSheet: {
    gridTemplateColumns:
      "repeat(auto-fill, minmax(max(calc(var(--icon-draw) + 2 * token(spacing.md)), calc((token(spacing.full) - 3 * token(spacing.sm)) / 4)), 1fr))",
  },
});

const marqueeStyle = css({
  position: "absolute",
  zIndex: 1,
  borderRadius: "xs",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "text.highlight",
  backgroundColor: "bg.highlight",
  pointerEvents: "none",
});

/** `visible` is separate so the label keeps its text while it fades out. */
interface IconHint {
  key: string;
  label: string;
  element: HTMLElement;
  visible: boolean;
}

export interface IconGridProps {
  entries: IconEntry[];
  settings: IconViewSettings;
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  /** The author is looking; held icons are marked only for them. */
  showsReview: boolean;
  /** Whether this click ends a sweep; asking consumes the answer. */
  consumeSweep: () => boolean;
  sweeping: boolean;
}

export function IconGrid({
  entries,
  settings,
  selection,
  onSelectionChange,
  showsReview,
  consumeSweep,
  sweeping,
}: IconGridProps) {
  const [hint, setHint] = useState<IconHint | null>(null);

  // Made here, not taken off the hook: the React Compiler reads a hook result reaching `ref` as a ref.
  const surfaceRef = useRef<HTMLDivElement>(null);

  const taken = entries.filter((entry) => selection.includes(entry.icon.key));
  const labels = useTakenLabels(
    surfaceRef,
    taken.map((entry) => entry.icon.key),
  );

  // Against the live selection, so taking the pointed-at tile hands its name to the anchored label.
  const hovering = hint && !selection.includes(hint.key) ? hint : null;

  const { ref, seed } = useCursorTooltip(Boolean(hovering?.visible), false);

  // Never for touch; checked per event, since touchscreen laptops also match `(hover: hover)`.
  const openHint = (entry: IconEntry, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const element = event.currentTarget;

    seed(event.clientX, event.clientY);

    setHint({
      key: entry.icon.key,
      label: entry.icon.title,
      element,
      visible: true,
    });
  };

  const closeHint = () =>
    setHint((current) => (current ? { ...current, visible: false } : null));

  const pressTile = (entry: IconEntry, event: ReactMouseEvent<HTMLElement>) => {
    // The click ending a sweep would otherwise replace what the band gathered.
    if (consumeSweep()) return;
    onSelectionChange(
      selectionAfterClick(
        selection,
        entry.icon.key,
        event.shiftKey || event.metaKey || event.ctrlKey,
      ),
    );
  };

  return (
    <>
      <div className={columnStyle}>
        <div ref={surfaceRef} className={gridStyle} style={iconWellStyle(settings)}>
          {entries.map((entry) => (
            <IconTile
              key={entry.icon.key}
              entry={entry}
              settings={settings}
              selected={selection.includes(entry.icon.key)}
              onPress={(event) => pressTile(entry, event)}
              onPointerEnter={(event) => openHint(entry, event)}
              onPointerLeave={closeHint}
              showsReview={showsReview}
            />
          ))}
        </div>

      </div>

      <TooltipHostContext.Provider
        value={{ ref, visible: Boolean(hovering?.visible) && !sweeping }}
      >
        <Tooltip>
          <Tooltip.Text>{hovering?.label ?? ""}</Tooltip.Text>
        </Tooltip>
      </TooltipHostContext.Provider>

      {taken.map((entry) => (
        <TooltipHostContext.Provider
          key={entry.icon.key}
          value={{ ref: labels.register(entry.icon.key), visible: !sweeping }}
        >
          <Tooltip>
            <Tooltip.Text>{entry.icon.title}</Tooltip.Text>
          </Tooltip>
        </TooltipHostContext.Provider>
      ))}
    </>
  );
}

/** Arithmetic over a live gesture, so it cannot be a Panda class. */
function bandStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

/** The sweep, drawn on the canvas the gesture is measured against. */
export function MarqueeBand({ rect }: { rect: Rect }) {
  return (
    <div
      data-icon-marquee
      className={marqueeStyle}
      style={bandStyle(rect)}
      aria-hidden
    />
  );
}
