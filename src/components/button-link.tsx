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

export function ButtonLink({
  href,
  children,
}: {
  href: string;
  /**
   * A bare string, not `Link.Text`: this renders from Server Components, and
   * the compound sub-parts do not survive the client boundary.
   */
  children: ReactNode;
}) {
  return (
    <Link href={href} className={pillStyle}>
      {children}
    </Link>
  );
}
