import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../../styled-system/css";
import { notice } from "../../../styled-system/recipes";
import { WireframeText } from "./wireframe";

// ---------------------------------------------------------------------------
// Notice — an inline informational callout: a leading status icon beside a
// short run of prose on a subtle neutral wash. Composed the way the rest of the
// library composes (icon-as-child, like OptionList.Option / Button):
//
//   <Notice>
//     <Notice.Icon>
//       <InfoIcon />
//     </Notice.Icon>
//     <Notice.Label>
//       This shift starts on <strong>Tuesday, 11 August, 2026</strong> and
//       repeats every <strong>Tuesday</strong> and <strong>Thursday</strong>.
//     </Notice.Label>
//   </Notice>
//
// The look is the shared `notice` recipe (panda.config.ts): the root owns the
// fill + row layout and the single `color` the icon inherits; the label reads
// as 75% body prose with its <strong> runs stepped back up to the full accent.
// It's purely presentational — no state, no client hooks — so it stays a Server
// Component. The icon is decorative (aria-hidden); the meaning lives in the
// label. Pass `role`/`aria-live` through the root when the message updates live.
// ---------------------------------------------------------------------------

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function NoticeRoot({ className, children, ...rest }: NoticeProps) {
  return (
    <div className={cx(notice().root, className)} {...rest}>
      {children}
    </div>
  );
}

export interface NoticeIconProps extends HTMLAttributes<HTMLSpanElement> {
  /** The glyph — a bare `<Icon/>`, sized and tinted by the recipe. */
  children: ReactNode;
}

/** Leading icon slot — decorative, so it's hidden from assistive tech. */
function NoticeIcon({ className, children, ...rest }: NoticeIconProps) {
  return (
    <span aria-hidden className={cx(notice().icon, className)} {...rest}>
      {children}
    </span>
  );
}

export interface NoticeLabelProps
  extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

/** The message — wrap the salient bits in `<strong>` to emphasize them. */
function NoticeLabel({ className, children, ...rest }: NoticeLabelProps) {
  return (
    <p className={cx(notice().label, className)} {...rest}>
      <WireframeText>{children}</WireframeText>
    </p>
  );
}

export const Notice = Object.assign(NoticeRoot, {
  Icon: NoticeIcon,
  Label: NoticeLabel,
});
