"use client";

import {
  Fragment,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import type { IconViewSettings } from "@/domain/icon";
import { iconAttrsToProps, resolveIconNodes, type IconNode } from "@/utils/icon-svg";
import type { IconEntry } from "./use-icon-library";

// ---------------------------------------------------------------------------
// One icon in the grid.
//
// The tile is a TOGGLE, not a link: pressing it takes the icon into the
// selection, which is what the sidebar's download, publish and delete all act
// on. `aria-pressed` says so, so the state is not something you have to see
// the ring to know.
//
// What is drawn is never the uploaded file. The sanitised tree is re-painted
// at the size and weight the page is set to (`resolveIconNodes`), as React
// elements rather than through innerHTML — the same tree that is serialised
// when the icon is downloaded, so the grid and the file cannot disagree.
//
// The cell is a fixed square and the icon sits at TRUE pixels in the middle of
// it, because a grid that scaled every icon to fill its cell would be showing
// you a drawing rather than the thing that ships. The zoom multiplies what is
// drawn — icon and stroke together, as a magnifying glass would — and the cell
// grows with it, so nothing collides at 4×.
//
// The tile carries the drawing and NOTHING VISIBLE else. A filename under
// each icon made the sheet a list of files rather than a set of marks — and
// it set the column width too, so the grid was spaced by the longest name in
// it instead of by the icons.
//
// The name is still there for anyone who cannot see the drawing, as hidden
// TEXT rather than an `aria-label`. That is not a stylistic preference: a
// browser volunteers its own hover hint for a control whose only name is an
// `aria-label`, and it landed beside the grid's own label saying the same
// thing twice. There is no attribute or rule that suppresses it — the way to
// not get it is to not name the control that way. Read from content the
// accessible name is identical and nothing is offered to draw.
// ---------------------------------------------------------------------------

const tileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Its cell's full width, and allowed to be narrower than its own contents:
  // content-sized, a tile holding a 4× drawing would push out of its column
  // and over the icon beside it.
  width: "token(spacing.full)",
  minWidth: 0,
  padding: "md",
  borderRadius: "lg",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  // Bordered only where the border MEANS something (a held icon, below); the
  // grid is otherwise a field of drawings with nothing ruled between them.
  borderColor: "transparent",
  backgroundColor: "transparent",
  cursor: "pointer",
  color: "text.default",
  focusVisibleRing: "outside",
  transition: "background-color 120ms ease-out, color 120ms ease-out",

  // The hover wash is for tiles that are NOT taken. Scoped rather than left to
  // source order: a bare `_hover` and the selected rule below have the same
  // specificity, so which one won would be decided by the order Panda happened
  // to emit them in — and the answer that loses is a selected tile going
  // neutral grey under the pointer.
  "&[aria-pressed='false']:hover": { backgroundColor: "bg.itemHover" },

  // Selected: the brand at 15% with the mark itself in the brand.
  //
  // `bg.highlight` and `text.highlight` are a PAIR the design system already
  // owns — the prose `<mark>` fill and its ink — which is the same claim this
  // makes about a tile, so selection here cannot drift from the brand
  // elsewhere in the app or from itself between themes. The icon needs nothing
  // of its own: it is painted in `currentColor` (see `resolveIconNodes`), so
  // setting the tile's colour is setting the drawing's.
  "&[aria-pressed='true']": {
    backgroundColor: "bg.highlight",
    color: "text.highlight",
  },

  // Held for review — shown to nobody but the author, so this is a mark only
  // they will ever see. Dashed rather than dimmed: the icon still has to be
  // judged at full strength, and it is the CELL that is provisional.
  "&[data-held]": {
    borderStyle: "dashed",
    borderColor: "border.divider",
  },
});

// The band the icon stands in the middle of. Its HEIGHT is the drawing plus a
// constant margin — so every row is level whatever each icon's own grid is,
// and the set breathes the same at 16px as at 4× — while its width is the
// column's, which the grid decides.
const wellStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.full)",
  height: "var(--icon-well)",
});

// The tile's name, for readers rather than lookers. `srOnly` takes it out of
// the flow entirely, so the flex row is still the drawing alone.
const srOnlyStyle = css({ srOnly: true });

// A file that would not parse. Not an error state to be cleared — it is what
// that object IS — so it draws a box rather than a message. Reached only once
// the bytes are actually IN: a file still on its way is a skeleton, and the
// two looked identical for as long as the entry conflated them.
const brokenStyle = css({
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "sm",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "dashed",
  borderColor: "border.divider",
});

/** The sanitised tree as elements. Recursive, because a `g` may hold a `g`. */
function IconNodes({ nodes }: { nodes: IconNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const Tag = node.tag as "path";
        const props = iconAttrsToProps(node.attrs);
        return (
          <Fragment key={index}>
            {node.children.length === 0 ? (
              <Tag {...props} />
            ) : (
              <Tag {...props}>
                <IconNodes nodes={node.children} />
              </Tag>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export interface IconTileProps {
  entry: IconEntry;
  settings: IconViewSettings;
  selected: boolean;
  /**
   * Pressed. The EVENT comes with it because what a press means depends on
   * the modifiers on it — plain takes this icon alone, shifted adds it — and
   * that decision belongs to the grid, which is what holds the selection.
   */
  onPress: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  /**
   * Hover, for the grid's shared label. The tile reports it and owns none of
   * it: one tooltip names whichever tile the pointer is on (`IconGrid`),
   * because a portalled box per tile would be two hundred hidden nodes to
   * keep one visible.
   */
  onPointerEnter?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  /** Whether the author is looking — the only person a held icon is marked for. */
  showsReview: boolean;
}

export function IconTile({
  entry,
  settings,
  selected,
  onPress,
  onPointerEnter,
  onPointerLeave,
  showsReview,
}: IconTileProps) {
  const { icon, svg } = entry;
  const held = showsReview && icon.review === "held";
  const drawn = settings.size * settings.zoom;

  return (
    <button
      type="button"
      className={tileStyle}
      aria-pressed={selected}
      data-held={held || undefined}
      // What the sheet's band measures itself against — it collects the
      // tiles by this rather than by class, and reads the key off it.
      data-icon-tile={icon.key}
      onClick={onPress}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className={wellStyle}>
        {svg === undefined ? (
          // Still coming. Blank rather than marked: the sheet as a whole waits
          // behind the preloader, so the only tiles that reach this are the
          // ones a fresh upload has just added to a set already on screen.
          null
        ) : svg ? (
          <svg
            width={drawn}
            height={drawn}
            viewBox={`0 0 ${svg.viewBox} ${svg.viewBox}`}
            fill="none"
            aria-hidden
            data-icon-drawing
          >
            <IconNodes nodes={resolveIconNodes(svg, settings)} />
          </svg>
        ) : (
          <span className={cx(brokenStyle)} data-icon-broken aria-hidden />
        )}
      </span>

      {/* Everything the tile shows, in one line, for a reader who gets no help
          from the drawing: the name, the grid it was made on, and whether it
          is on show. Hidden text rather than an attribute — see the note at
          the top of this file. */}
      <span className={srOnlyStyle}>
        {[icon.name, `${icon.native} grid`, held ? "held for review" : null]
          .filter(Boolean)
          .join(", ")}
      </span>
    </button>
  );
}

/**
 * The two lengths the grid lays itself out against, as a style it hands down.
 *
 *   --icon-draw  the drawing's own side: the size, times the zoom. The hard
 *                floor on a column — anything narrower clips the icon.
 *   --icon-well  the row's height: that plus a constant margin, and never
 *                less than the app's 80px tile, so a sheet of 16s is not a
 *                row of specks and 4× still breathes.
 *
 * Here rather than in a recipe because it is arithmetic over two settings, and
 * a Panda class cannot be computed at runtime — see the note in `.cursor/rules`
 * about arbitrary values in `css()`.
 */
export function iconWellStyle(settings: IconViewSettings): CSSProperties {
  const drawn = settings.size * settings.zoom;
  return {
    "--icon-draw": `${drawn}px`,
    "--icon-well": `max(80px, ${drawn + 32}px)`,
  } as CSSProperties;
}
