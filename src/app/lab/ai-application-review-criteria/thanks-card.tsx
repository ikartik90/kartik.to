"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../../styled-system/css";
import { AUTHOR, SOCIAL_PROFILES } from "@/data/site";
import { plainButtonStyle, primaryButtonStyle } from "./parts";
import CloseIcon from "./icons/close.svg";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import XIcon from "@/assets/icons/twitter.svg";

const BOOKING = "https://calendly.com/ikartik90/30min";

const cardStyle = css({
  position: "fixed",
  inset: "auto",
  insetBlockEnd: "20px",
  insetInlineStart: "20px",
  margin: 0,
  width: "360px",
  maxWidth: "calc(100vw - 40px)",
  padding: "20px",
  borderRadius: "12px",
  borderWidth: "var(--cashby-rule)",
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  filter: "drop-shadow(0 0 10px var(--cashby-border))",
  color: "var(--cashby-ink)",
  font: "var(--cashby-text-body)",
  opacity: 0,
  transform: "translateY(8px)",
  transition:
    "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&:popover-open": {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    opacity: 1,
    transform: "none",
  },
  _starting: { "&:popover-open": { opacity: 0, transform: "translateY(8px)" } },
  // No second fade-in after moving to another dialog.
  "&[data-shown]": { transition: "none" },
});

const whoStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
});

const avatarStyle = css({
  flexShrink: 0,
  width: "44px",
  height: "44px",
  borderRadius: "50%",
});

const nameStyle = css({ font: "var(--cashby-text-body-strong)" });

const roleStyle = css({
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate-subtle)",
});

const closeStyle = css({
  position: "absolute",
  insetBlockStart: "12px",
  insetInlineEnd: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
});

const textStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

const titleStyle = css({ font: "var(--cashby-text-card-title)" });

const actionsStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

// Named by sr-only text, not `aria-label`, which gets a native hover hint on a bare glyph.
const profileStyle = css({ justifyContent: "center", width: "32px" });

const glyphStyle = css({ width: "16px", height: "16px" });

const nameOnlyReadStyle = css({ srOnly: true });

// The card portals into the top open modal: everything outside it is inert.
function topDialog() {
  return (
    [
      ...document.querySelectorAll<HTMLDialogElement>(
        "dialog[open]:not([data-closing])",
      ),
    ].at(-1) ?? null
  );
}

export function ThanksCard({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [host, setHost] = useState(topDialog);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const watch = new MutationObserver(() => setHost(topDialog()));
    watch.observe(document.body, {
      subtree: true,
      attributeFilter: ["open", "data-closing"],
    });
    return () => watch.disconnect();
  }, []);

  // A moved popover is a new element and must be shown again.
  useLayoutEffect(() => {
    ref.current?.showPopover();
  }, [host]);

  const external = { target: "_blank", rel: "noopener noreferrer" } as const;

  const card = (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-labelledby={titleId}
      className={cardStyle}
      data-shown={shown || undefined}
      onTransitionEnd={() => setShown(true)}
    >
      <div className={whoStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTHOR.avatar}
          alt=""
          width={44}
          height={44}
          className={avatarStyle}
        />
        <div>
          <p className={nameStyle}>{AUTHOR.name}</p>
          <p className={roleStyle}>Product designer, Toronto</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className={closeStyle}
          onClick={onClose}
        >
          <CloseIcon aria-hidden />
        </button>
      </div>
      <div className={textStyle}>
        <h2 id={titleId} className={titleStyle}>
          Thanks for trying the prototype
        </h2>
        <p>
          Given the chance, I’d love to present this in person and walk you
          through the decisions behind it.
        </p>
      </div>
      <div className={actionsStyle}>
        <a href={BOOKING} className={primaryButtonStyle} {...external}>
          Book a time
        </a>
        <a
          href={SOCIAL_PROFILES.linkedin}
          className={cx(plainButtonStyle, profileStyle)}
          {...external}
        >
          <LinkedInIcon aria-hidden className={glyphStyle} />
          <span className={nameOnlyReadStyle}>LinkedIn</span>
        </a>
        <a
          href={SOCIAL_PROFILES.twitter}
          className={cx(plainButtonStyle, profileStyle)}
          {...external}
        >
          <XIcon aria-hidden className={glyphStyle} />
          <span className={nameOnlyReadStyle}>X</span>
        </a>
      </div>
    </div>
  );
  return host ? createPortal(card, host) : card;
}
