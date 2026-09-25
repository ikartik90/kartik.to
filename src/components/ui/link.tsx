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
  /** Inferred when unset: a text label ⇒ `text`, an icon alone ⇒ `icon`. */
  variant?: ActionVariant;
  /** Defaults to `secondary` for text links, `tertiary` for icon links. */
  emphasis?: ActionEmphasis;
  /** Force a plain <a>; automatic for absolute, mailto: and tel: hrefs, or any `target`. */
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
