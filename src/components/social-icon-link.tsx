"use client";

import { useState, type FC, type RefObject, type SVGProps } from "react";
import { css, cx } from "../../styled-system/css";
import { menuIcon, tooltip, tooltipIcon } from "../../styled-system/recipes";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { SocialIconShader, type SocialIconSize } from "./social-icon-shader";
import { Link } from "./ui/link";
import GotoIcon from "@/assets/icons/goto.svg";

// Brings no shader stage: wrap the whole set in one `SocialShaderStage`, never one per icon.

// The 16px size must be a utility: `menuIcon` and `action`'s `& svg` rule are recipes.
const triggerIconStyle = {
  md: menuIcon(),
  sm: cx(
    menuIcon(),
    css({ width: "token(spacing.xl)", height: "token(spacing.xl)" }),
  ),
} as const satisfies Record<SocialIconSize, string>;
const tooltipIconStyle = tooltipIcon();

// The `[data-social-link-item]` rules in globals.css keep the tooltip up while either half is hovered.
const itemStyle = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
});

const dividerStyle = css({
  flexShrink: 0,
  width: 0,
  height: "token(spacing.xl)",
  borderLeftWidth: "token(spacing.3xs)",
  borderLeftStyle: "solid",
  borderLeftColor: "border.divider",
});

const actionStyle = css({
  display: "inline-flex",
  flexShrink: 0,
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  cursor: "pointer",
});

export interface SocialIconLinkProps {
  href: string;
  /** The tooltip's words. */
  label: string;
  ariaLabel?: string;
  /** The glyph's silhouette, for the shader to be masked to. */
  maskSrc: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
  size?: SocialIconSize;
  /** Applied to the wrapper. */
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function SocialIconLink({
  href,
  label,
  ariaLabel,
  maskSrc,
  Icon,
  size = "md",
  className,
  onMouseEnter,
  onMouseLeave,
}: SocialIconLinkProps) {
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const visible = (triggerHovered || tooltipHovered) && !dismissed;
  const { ref: tooltipRef, seed } = useCursorTooltip(visible);

  return (
    <span
      className={cx(itemStyle, className)}
      data-social-link-item
      data-tooltip-visible={visible ? "" : undefined}
      data-tooltip-dismissed={dismissed ? "" : undefined}
      onMouseEnter={(event) => {
        seed(event.clientX, event.clientY);
        setDismissed(false);
        setTriggerHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setTriggerHovered(false);
        setDismissed(false);
        onMouseLeave?.();
      }}
    >
      <Link
        href={href}
        variant="icon"
        aria-label={ariaLabel ?? label}
        target="_blank"
        rel="noopener noreferrer"
        // Opts out of the chip's hover fill (globals.css): the shader is the hover state.
        data-social-trigger
      >
        <SocialIconShader maskSrc={maskSrc} active={triggerHovered} size={size}>
          <Icon className={triggerIconStyle[size]} aria-hidden />
        </SocialIconShader>
      </Link>

      {/* Positioned imperatively through `tooltipRef`, so tracking never re-renders. */}
      <div
        ref={tooltipRef as RefObject<HTMLDivElement | null>}
        data-social-tooltip
        className={tooltip()}
        aria-hidden
        onMouseEnter={() => setTooltipHovered(true)}
        onMouseLeave={() => setTooltipHovered(false)}
      >
        <span>{label}</span>
        <span className={dividerStyle} aria-hidden />
        <a
          href={href}
          className={actionStyle}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          onClick={() => setDismissed(true)}
        >
          <GotoIcon
            className={tooltipIconStyle}
            data-social-tooltip-icon
            aria-hidden
          />
        </a>
      </div>
    </span>
  );
}
