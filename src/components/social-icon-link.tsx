"use client";

import { useState, type FC, type RefObject, type SVGProps } from "react";
import { css, cx } from "../../styled-system/css";
import { menuIcon, tooltip, tooltipIcon } from "../../styled-system/recipes";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { SocialIconShader } from "./social-icon-shader";
import { Link, type ActionSize } from "./ui/link";
import GotoIcon from "@/assets/icons/goto.svg";

// ---------------------------------------------------------------------------
// One icon that links somewhere, with the house social interaction: the line
// icon, the GemSmoke shader as its hover state, and a tooltip that follows the
// cursor carrying the label and a way to open the destination.
//
// EXTRACTED because there are two of these now — the row under the homepage
// intro, and a testimonial's profile on the admin board — and "the same
// interaction" is a promise two copies cannot keep. The shader in particular is
// not a style that can be duplicated: it is a WebGL context placed by a
// `SocialShaderStage` that must be an ancestor, so a second implementation
// would also mean a second answer to how many contexts a page is allowed.
//
// IT BRINGS NO STAGE OF ITS OWN, deliberately. One stage holds ONE shader and
// moves it to whichever icon is hovered, so the stage belongs around the whole
// SET — the homepage's row, the board's grid — and a stage per icon would be a
// WebGL context per icon. Without an ancestor stage the icon simply draws
// itself and skips the shader, which is what tests and a reduced-motion reader
// get too.
//
// The email trigger on the homepage is NOT one of these: it copies rather than
// navigates, and its tooltip morphs through a copied state. It stays in
// `social-links.tsx`, which is the one surface that has it.
// ---------------------------------------------------------------------------

const triggerIconStyle = menuIcon();
const tooltipIconStyle = tooltipIcon();

// The wrapper both the hover region and the tooltip's anchor hang off — see the
// `[data-social-link-item]` rules in globals.css, which is what makes the
// tooltip visible while either half is hovered.
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
  /** The words in the tooltip — "LinkedIn", or a profile's handle. */
  label: string;
  /**
   * The link's accessible name, when the label is not enough on its own. A
   * board of twelve profiles wants "Ada Lovelace on LinkedIn" rather than
   * twelve links that all announce themselves as the same handle.
   */
  ariaLabel?: string;
  /** The glyph's silhouette, for the shader to be masked to. */
  maskSrc: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
  /**
   * The chip around the glyph: the 28px toolbar one by default, 24px at `sm`.
   * The GLYPH is 20px either way — one shader instance, placed at a fixed box,
   * serves every icon on the page — so this is the inset and nothing else.
   */
  size?: ActionSize;
  /** Applied to the wrapper, so a caller can place the icon in its own layout. */
  className?: string;
  /** For a set that coordinates across its items — see `SocialLinks`. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function SocialIconLink({
  href,
  label,
  ariaLabel,
  maskSrc,
  Icon,
  size,
  className,
  onMouseEnter,
  onMouseLeave,
}: SocialIconLinkProps) {
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  // Pressing the tooltip's own "open" action takes the pointer to another tab
  // and leaves the tooltip standing over nothing. Cleared on the next hover.
  const [dismissed, setDismissed] = useState(false);

  const visible = (triggerHovered || tooltipHovered) && !dismissed;
  // Cursor-following positioning is the shared engine (Button and Link use it
  // too); what is kept here is this tooltip's own content and visibility.
  const { ref: tooltipRef, seed } = useCursorTooltip(visible);

  return (
    <span
      className={cx(itemStyle, className)}
      data-social-link-item
      data-tooltip-visible={visible ? "" : undefined}
      data-tooltip-dismissed={dismissed ? "" : undefined}
      onMouseEnter={(event) => {
        // Seeded from the pointer so the tooltip appears where the hand is,
        // rather than sliding in from wherever it was last left.
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
        size={size}
        aria-label={ariaLabel ?? label}
        target="_blank"
        rel="noopener noreferrer"
        // The WebGL shader IS the hover state — no background chip behind it
        // (see the [data-social-trigger] rule in globals.css).
        data-social-trigger
      >
        <SocialIconShader maskSrc={maskSrc} active={triggerHovered}>
          <Icon className={triggerIconStyle} aria-hidden />
        </SocialIconShader>
      </Link>

      {/* Position is written imperatively through `tooltipRef` (ref + rAF), so
          tracking the cursor never re-renders on pointermove. */}
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
