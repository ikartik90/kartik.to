"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type RefObject,
  type SVGProps,
} from "react";
import CheckIcon from "@/assets/icons/check.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import EmailIcon from "@/assets/icons/email.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import OctocatIcon from "@/assets/icons/octocat.svg";
import TwitterIcon from "@/assets/icons/twitter.svg";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { css, cx } from "../../styled-system/css";
import { menuIcon, tooltip, tooltipIcon } from "../../styled-system/recipes";
import { SocialIconShader } from "./social-icon-shader";
import { Button } from "./ui/button";
import { Link } from "./ui/link";

const COPY_SUCCESS_MS = 2000;
const EMAIL_COPY_TEXT = "ikartik90@gmail.com";
const EMAIL_COPIED_LABEL = "Copied";

const SOCIAL_ITEMS = [
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/ikartik90",
    Icon: OctocatIcon,
    maskSrc: "/social-shader-masks/octocat.svg",
    action: "link",
  },
  {
    id: "twitter",
    label: "Follow me",
    href: "https://twitter.com/ikartik90",
    Icon: TwitterIcon,
    maskSrc: "/social-shader-masks/twitter.svg",
    action: "link",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://linkedin.com/in/ikartik90",
    Icon: LinkedInIcon,
    maskSrc: "/social-shader-masks/linkedin.svg",
    action: "link",
  },
  {
    id: "email",
    label: "Email address",
    Icon: EmailIcon,
    maskSrc: "/social-shader-masks/email.svg",
    action: "copy",
  },
] as const;

type SocialItem = (typeof SOCIAL_ITEMS)[number];

const triggerIconStyle = menuIcon();
const tooltipIconStyle = tooltipIcon();

// The icons already ship a `viewBox="0 0 20 20"` and svgr preserves it
// (removeViewBox:false), so CSS-sizing to 14px scales them — no viewBox override.
function TooltipIcon({ Icon }: { Icon: FC<SVGProps<SVGSVGElement>> }) {
  return (
    <Icon className={tooltipIconStyle} data-social-tooltip-icon aria-hidden />
  );
}

const copyActionIconSlotStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "token(sizes.tooltipIcon)",
  height: "token(sizes.tooltipIcon)",
});

const COPY_LABEL_TRANSITION = "opacity 200ms ease, filter 200ms ease";

const copyActionIconLayerStyle = css({
  position: "absolute",
  top: 0,
  left: 0,
  transition: COPY_LABEL_TRANSITION,
});

const copyActionIconHiddenStyle = css({
  opacity: 0,
});

const copyActionIconExitStyle = css({
  opacity: 0,
  filter: "blur(2px)",
});

const emailLabelSlotStyle = css({
  position: "relative",
  display: "inline-block",
  flexShrink: 0,
  height: "1.25rem",
  overflow: "visible",
  transition: "width 200ms ease",
});

const emailLabelLayerStyle = css({
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  whiteSpace: "nowrap",
  transition: COPY_LABEL_TRANSITION,
});

const emailLabelHiddenStyle = css({
  opacity: 0,
  filter: "blur(2px)",
});

function EmailTooltipLabel({
  copied,
  defaultLabel,
}: {
  copied: boolean;
  defaultLabel: string;
}) {
  const defaultRef = useRef<HTMLSpanElement>(null);
  const copiedRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState<number>();

  useLayoutEffect(() => {
    const activeRef = copied ? copiedRef : defaultRef;
    const width = activeRef.current?.offsetWidth;
    if (width != null) setLabelWidth(width);
  }, [copied, defaultLabel]);

  return (
    <span
      className={emailLabelSlotStyle}
      style={labelWidth == null ? undefined : { width: `${labelWidth}px` }}
    >
      <span
        ref={defaultRef}
        className={cx(emailLabelLayerStyle, copied && copyActionIconExitStyle)}
      >
        {defaultLabel}
      </span>
      <span
        ref={copiedRef}
        className={cx(
          emailLabelLayerStyle,
          copied ? undefined : emailLabelHiddenStyle,
        )}
      >
        {EMAIL_COPIED_LABEL}
      </span>
    </span>
  );
}

function CopyActionIcon({ copied }: { copied: boolean }) {
  return (
    <span className={copyActionIconSlotStyle} aria-hidden>
      <CopyIcon
        className={cx(
          tooltipIconStyle,
          copyActionIconLayerStyle,
          copied && copyActionIconExitStyle,
        )}
        data-social-tooltip-icon
        data-copy-action-icon="copy"
      />
      <CheckIcon
        className={cx(
          tooltipIconStyle,
          copyActionIconLayerStyle,
          copied ? undefined : copyActionIconHiddenStyle,
        )}
        data-social-tooltip-icon
        data-copy-action-icon="check"
      />
    </span>
  );
}

const tooltipDividerStyle = css({
  flexShrink: 0,
  width: 0,
  height: "token(spacing.xl)",
  borderLeftWidth: "token(spacing.3xs)",
  borderLeftStyle: "solid",
  borderLeftColor: "border.divider",
});

const tooltipActionStyle = css({
  display: "inline-flex",
  flexShrink: 0,
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  cursor: "pointer",
});

// No margin of its own. It carried a 32px `marginTop` from when the intro
// section stacked it straight under a paragraph and that margin WAS the gap.
// The row is now a block in a document, spaced by the layout around it, and an
// internal margin there is invisible from the outside: it made the space above
// the icons 48px while the markup said 16, so tuning the gap from the page
// moved a number that was never the whole story.
const listStyle = css({
  display: "flex",
  gap: "xl",
  listStyle: "none",
  flexWrap: "wrap",
});

const itemStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
});

function SocialTooltip({
  item,
  copySuccess,
  onDismiss,
  onEmailCopy,
  tooltipRef,
  onPointerEnter,
  onPointerLeave,
}: {
  item: SocialItem;
  copySuccess: boolean;
  onDismiss: () => void;
  onEmailCopy: () => void;
  tooltipRef: RefObject<HTMLElement | null>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  async function handleCopy() {
    if (item.action !== "copy") return;
    try {
      await navigator.clipboard.writeText(EMAIL_COPY_TEXT);
      onEmailCopy();
    } catch {
      // Clipboard API unavailable — fail silently.
    }
  }

  const content = (
    <>
      {item.action === "copy" ? (
        <EmailTooltipLabel copied={copySuccess} defaultLabel={item.label} />
      ) : (
        <span>{item.label}</span>
      )}
      <span className={tooltipDividerStyle} aria-hidden />
      {item.action === "copy" ? (
        <CopyActionIcon copied={copySuccess} />
      ) : (
        <a
          href={item.href}
          className={tooltipActionStyle}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          onClick={onDismiss}
        >
          <TooltipIcon Icon={GotoIcon} />
        </a>
      )}
    </>
  );

  const tooltipProps = {
    "data-social-tooltip": true,
    className: tooltip(),
    "aria-hidden": true as const,
    onMouseEnter: onPointerEnter,
    onMouseLeave: onPointerLeave,
  };

  // Position is written imperatively via tooltipRef (ref + rAF) so tracking the
  // cursor never triggers a React re-render on every pointermove.
  if (item.action === "copy") {
    return (
      <button
        ref={tooltipRef as RefObject<HTMLButtonElement | null>}
        type="button"
        {...tooltipProps}
        tabIndex={-1}
        onClick={handleCopy}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={tooltipRef as RefObject<HTMLDivElement | null>} {...tooltipProps}>
      {content}
    </div>
  );
}

export function SocialLinks() {
  const [emailCopySuccess, setEmailCopySuccess] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function dismissEmail() {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setEmailCopySuccess(false);
    setDismissed((current) => ({ ...current, email: true }));
  }

  function handleEmailCopySuccess() {
    setEmailCopySuccess(true);
    setDismissed((current) => ({ ...current, email: false }));
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(dismissEmail, COPY_SUCCESS_MS);
  }

  async function handleEmailTriggerClick() {
    try {
      await navigator.clipboard.writeText(EMAIL_COPY_TEXT);
      handleEmailCopySuccess();
    } catch {
      // Clipboard API unavailable — fail silently.
    }
  }

  function handleItemMouseEnter(id: string) {
    if (id !== "email" && emailCopySuccess) {
      dismissEmail();
    }
    setDismissed((current) => ({ ...current, [id]: false }));
  }

  function handleItemMouseLeave(id: string) {
    if (id === "email" && emailCopySuccess) return;
    setDismissed((current) => ({ ...current, [id]: false }));
  }

  return (
    <ul className={listStyle}>
      {SOCIAL_ITEMS.map((item) => (
        <SocialLinkItem
          key={item.id}
          item={item}
          copySuccess={item.id === "email" && emailCopySuccess}
          tooltipDismissed={dismissed[item.id] ?? false}
          onMouseEnter={() => handleItemMouseEnter(item.id)}
          onMouseLeave={() => handleItemMouseLeave(item.id)}
          onDismiss={() =>
            setDismissed((current) => ({ ...current, [item.id]: true }))
          }
          onEmailTriggerClick={handleEmailTriggerClick}
          onEmailCopy={handleEmailCopySuccess}
        />
      ))}
    </ul>
  );
}

function SocialLinkItem({
  item,
  copySuccess,
  tooltipDismissed,
  onMouseEnter,
  onMouseLeave,
  onDismiss,
  onEmailTriggerClick,
  onEmailCopy,
}: {
  item: SocialItem;
  copySuccess: boolean;
  tooltipDismissed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDismiss: () => void;
  onEmailTriggerClick: () => void;
  onEmailCopy: () => void;
}) {
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const tooltipVisible =
    (triggerHovered || tooltipHovered || copySuccess) && !tooltipDismissed;
  // Cursor-following positioning is the shared engine now (Button/Link use it
  // too); this component keeps only its bespoke copy/goto/email-morph content
  // and its own visibility state.
  const { ref: tooltipRef, seed } = useCursorTooltip(tooltipVisible);

  const triggerLabel =
    item.action === "copy" && copySuccess ? EMAIL_COPIED_LABEL : item.label;

  function handleTriggerMouseEnter(event: React.MouseEvent) {
    seed(event.clientX, event.clientY);
    setTriggerHovered(true);
    onMouseEnter();
  }

  function handleTriggerMouseLeave() {
    setTriggerHovered(false);
    onMouseLeave();
  }

  function handleTooltipMouseEnter() {
    setTooltipHovered(true);
  }

  function handleTooltipMouseLeave() {
    setTooltipHovered(false);
  }

  const icon = (
    <SocialIconShader maskSrc={item.maskSrc} active={triggerHovered}>
      <item.Icon className={triggerIconStyle} aria-hidden />
    </SocialIconShader>
  );

  return (
    <li
      className={itemStyle}
      data-social-link-item
      data-tooltip-visible={tooltipVisible ? "" : undefined}
      data-tooltip-dismissed={tooltipDismissed ? "" : undefined}
      data-copy-success={copySuccess ? "" : undefined}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {item.action === "link" ? (
        <Link
          href={item.href}
          variant="icon"
          aria-label={item.label}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
          // The WebGL shader IS the hover state — no background chip behind it
          // (see the [data-social-trigger] rule in globals.css).
          data-social-trigger
        >
          {icon}
        </Link>
      ) : (
        <Button
          variant="icon"
          aria-label={triggerLabel}
          aria-live="polite"
          onClick={(event) => {
            event.preventDefault();
            onEmailTriggerClick();
          }}
          data-social-trigger
        >
          {icon}
        </Button>
      )}
      <SocialTooltip
        item={item}
        copySuccess={copySuccess}
        onDismiss={onDismiss}
        onEmailCopy={onEmailCopy}
        tooltipRef={tooltipRef}
        onPointerEnter={handleTooltipMouseEnter}
        onPointerLeave={handleTooltipMouseLeave}
      />
    </li>
  );
}
