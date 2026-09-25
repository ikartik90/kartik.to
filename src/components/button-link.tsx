import type { ReactNode } from "react";
import { css, cx } from "../../styled-system/css";
import { action } from "../../styled-system/recipes";
import { Link } from "./ui/link";
import type { ActionEmphasis } from "./ui/action";
import type { ButtonLinkColor } from "@/domain/nodes";

// A utility, not a recipe variant, so it outranks `action`'s own corner.
const pillStyle = css({ borderRadius: "full" });

const emphasisFor = {
  neutral: "secondary",
  accent: "accent",
} as const satisfies Record<ButtonLinkColor, ActionEmphasis>;

/** The button's classes, for the editor, which draws it as a field that must not navigate. */
export const buttonLinkClass = (color: ButtonLinkColor = "neutral") =>
  cx(action({ variant: "text", emphasis: emphasisFor[color] }), pillStyle);

export const buttonLinkRowStyle = css({
  display: "flex",
  justifyContent: "center",
});

/** Sticky row for reader and editor; its backdrop blur lives in globals.css, keyed off `data-sticky`. */
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
  color = "neutral",
  children,
}: {
  href: string;
  newTab?: boolean;
  color?: ButtonLinkColor;
  /** Not `Link.Text`: compound sub-parts don't survive the RSC boundary. */
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      emphasis={emphasisFor[color]}
      className={pillStyle}
      target={newTab ? "_blank" : undefined}
    >
      {children}
    </Link>
  );
}
