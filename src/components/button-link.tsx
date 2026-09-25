import type { ReactNode } from "react";
import { css, cx } from "../../styled-system/css";
import { action } from "../../styled-system/recipes";
import { Link } from "./ui/link";

// ---------------------------------------------------------------------------
// A button that goes somewhere — the `button_link` block, which is how the
// homepage's intro offers the About page and how any article offers anything.
//
// The shared `action` chip, rounded into a pill. The rounding is a `css()`
// utility rather than a recipe variant on purpose: `action`'s own `text`
// variant sets the 8px corner, and two recipe classes setting one property
// would be settled by emission order. A utility sits in the later layer and
// wins outright.
// ---------------------------------------------------------------------------

const pillStyle = css({ borderRadius: "full" });

/**
 * The button's classes, for the one place that draws it as something other
 * than a link: the article editor, whose button is a field to type its label
 * into and must not navigate when it is pressed.
 */
export const buttonLinkClass = cx(
  action({ variant: "text", emphasis: "secondary" }),
  pillStyle,
);

/**
 * A button on a line of its own, centred in the reading column — the block's
 * wrapper, which the editor wears too so the canvas matches the page.
 */
export const buttonLinkRowStyle = css({
  display: "flex",
  justifyContent: "center",
});

/**
 * A sticky button's row, in the reader and the editor alike. Pinned one
 * article gap (`xl`, the `<article>`'s own block gap) in from the bottom edge
 * until its place scrolls up to meet it, and from the top edge once that place
 * has passed, until the `<article>` — its containing block — runs out. The row spans the text column, so it lets the
 * pointer through to the prose it passes over; only the button takes it.
 * The blur behind the pinned chip is in `globals.css`, keyed off the row's
 * `data-sticky`: `css()` cannot write `backdrop-filter`.
 */
export const buttonLinkStickyRowStyle = css({
  position: "sticky",
  top: "xl",
  bottom: "xl",
  zIndex: 1,
  pointerEvents: "none",
  "& > *": { pointerEvents: "auto" },
});

export function ButtonLink({
  href,
  newTab = false,
  children,
}: {
  href: string;
  /** Open in a new tab; `Link` adds the `rel` that makes that safe. */
  newTab?: boolean;
  /**
   * A bare string, not `Link.Text`: this renders from Server Components, and
   * the compound sub-parts do not survive the client boundary.
   */
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={pillStyle}
      target={newTab ? "_blank" : undefined}
    >
      {children}
    </Link>
  );
}
