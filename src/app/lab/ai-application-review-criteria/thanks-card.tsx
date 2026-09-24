"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../../styled-system/css";
import { AUTHOR, SOCIAL_PROFILES } from "@/data/site";
import { plainButtonStyle, primaryButtonStyle } from "./parts";
import CloseIcon from "./icons/close.svg";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import XIcon from "@/assets/icons/twitter.svg";

// ---------------------------------------------------------------------------
// The thanks the walkthrough ends on: who made the prototype, and the ways to
// get in touch. A card in the window's bottom-left corner, 20px clear of both
// edges.
//
// A popover, so it is in the top layer; and written inside whichever modal
// dialog is open, because everything outside one is inert, and the drawer is
// still open when the walkthrough finishes. As that dialog starts to close, the
// card moves back to where it is written, without fading in a second time:
// inside the prototype, whose theme it is drawn in — not to the page's body.
// ---------------------------------------------------------------------------

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
  // Laid out only while shown: a closed popover is hidden by `display: none`.
  "&:popover-open": {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    opacity: 1,
    transform: "none",
  },
  _starting: { "&:popover-open": { opacity: 0, transform: "translateY(8px)" } },
  // In once: moved, it is simply there.
  "&[data-shown]": { transition: "none" },
});

const whoStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
});

// As tall as the name and role beside it.
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

// 12px from the card's corner, a glyph in no box of its own.
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

// The product's plain button, square around a glyph. Its name is text only a
// screen reader has: named by `aria-label` alone, a bare glyph gets a hover
// hint of the browser's own.
const profileStyle = css({ justifyContent: "center", width: "32px" });

const glyphStyle = css({ width: "16px", height: "16px" });

const nameOnlyReadStyle = css({ srOnly: true });

// The dialog on top, if one is open and staying open.
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

  // Moved, it is a new element, to be shown afresh.
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
        {/* The name is beside it. */}
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
