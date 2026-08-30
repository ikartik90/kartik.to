"use client";

import NextLink from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type PointerEvent,
  type Ref,
} from "react";
import { cx } from "../../../styled-system/css";
import { action } from "../../../styled-system/recipes";
import {
  ActionText,
  useActionTooltip,
  type ActionVariant,
  type ActionEmphasis,
} from "./action";
import { Tooltip } from "./tooltip";
import { WireframeContent } from "./wireframe";

// ---------------------------------------------------------------------------
// Link — an <a>/next-link that NAVIGATES, the sibling of Button (button.tsx).
// Same composition (bare icon, `Link.Text` label, `Link.Tooltip`) and the same
// shared `action` recipe, so a link and a button are visually identical; only
// their semantics differ — which is exactly why they're kept as two components.
//
//   <Link href="/" aria-label="Home">
//     <ReturnIcon />
//     <Link.Text>Home</Link.Text>
//   </Link>
//
// Internal hrefs route through next/link (client-side nav); external ones (an
// absolute/protocol-relative URL, mailto:, tel:, or an explicit `target`) render
// a plain <a> with a safe `rel` defaulted for `target="_blank"`.
// ---------------------------------------------------------------------------

const EXTERNAL_HREF = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

function isExternalHref(href: string) {
  return (
    EXTERNAL_HREF.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * Override the look. Left unset it's inferred from the children: a `Link.Text`
   * (or bare string) label ⇒ `text`, an icon alone ⇒ `icon`. Set it for `link`.
   */
  variant?: ActionVariant;
  /**
   * Fill prominence, independent of `variant` (the shape). `secondary` is the
   * filled chip; `tertiary` has no resting fill and a subtler hover wash. Left
   * unset it defaults to `secondary` for text links and `tertiary` for icon
   * links.
   */
  emphasis?: ActionEmphasis;
  /**
   * Force a plain <a> instead of next/link. Auto-detected for absolute /
   * mailto: / tel: hrefs and whenever a `target` is set.
   */
  external?: boolean;
}

function LinkRoot(
  {
    href,
    variant,
    emphasis,
    external,
    className,
    children,
    target,
    rel,
    onPointerEnter,
    onPointerLeave,
    ...rest
  }: LinkProps,
  ref: Ref<HTMLAnchorElement>,
) {
  const { content, hasText, tooltipNode, hasTooltip, show, hide } =
    useActionTooltip(children);
  const resolvedVariant = variant ?? (hasText ? "text" : "icon");
  const resolvedEmphasis =
    emphasis ?? (resolvedVariant === "text" ? "secondary" : "tertiary");
  const asAnchor = external ?? (isExternalHref(href) || target != null);
  // Never ship a target="_blank" without the reverse-tabnabbing guard.
  const safeRel =
    rel ?? (target === "_blank" ? "noopener noreferrer" : undefined);
  const classes = cx(
    action({ variant: resolvedVariant, emphasis: resolvedEmphasis }),
    className,
  );

  const handleEnter = (event: PointerEvent<HTMLAnchorElement>) => {
    onPointerEnter?.(event);
    if (hasTooltip) show(event);
  };
  const handleLeave = (event: PointerEvent<HTMLAnchorElement>) => {
    onPointerLeave?.(event);
    if (hasTooltip) hide();
  };

  return (
    <>
      {asAnchor ? (
        <a
          ref={ref}
          href={href}
          target={target}
          rel={safeRel}
          className={classes}
          onPointerEnter={handleEnter}
          onPointerLeave={handleLeave}
          {...rest}
        >
          <WireframeContent>{content}</WireframeContent>
        </a>
      ) : (
        <NextLink
          ref={ref}
          href={href}
          className={classes}
          onPointerEnter={handleEnter}
          onPointerLeave={handleLeave}
          {...rest}
        >
          <WireframeContent>{content}</WireframeContent>
        </NextLink>
      )}
      {tooltipNode}
    </>
  );
}

export const Link = Object.assign(forwardRef(LinkRoot), {
  Text: ActionText,
  Tooltip,
});

export type { ActionVariant, ActionEmphasis };
