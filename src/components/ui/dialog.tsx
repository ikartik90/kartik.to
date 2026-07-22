"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cva, cx } from "../../../styled-system/css";

export type DialogAlign =
  | "top"
  | "top-center"
  | "center"
  | "bottom-center"
  | "bottom"
  | "stretch";

export type DialogJustify = "start" | "center" | "end" | "stretch";

export interface DialogProps
  extends Omit<HTMLAttributes<HTMLDialogElement>, "onClose"> {
  align?: DialogAlign;
  justify?: DialogJustify;
  onClose?: () => void;
  children: ReactNode;
}

// All variant values are static string literals — Panda's extractor generates
// the CSS at build time. No runtime variables passed into cva().
const dialogRecipe = cva({
  base: {
    // Closed state — exit target
    opacity: 0,
    display: "none",
    transform: "scale(0.95)",
    transitionProperty: "opacity, transform, display, overlay",
    transitionDuration: "80ms",
    transitionTimingFunction: "ease-out",
    transitionDelay: "0s",
    transitionBehavior: "allow-discrete",

    // Open/steady state — flex column so panel recipes (footer marginTop: auto, body flex: 1) work
    "&[open]": {
      opacity: 1,
      transform: "scale(1)",
      display: "flex",
      flexDirection: "column",
    },

    // Backdrop — closed/exit state
    "&::backdrop": {
      opacity: 0,
      backdropFilter: "blur(2px)",
      backgroundColor: "bg.canvas/50",
      transitionProperty: "opacity, display, overlay",
      transitionDuration: "80ms",
      transitionTimingFunction: "ease-out",
      transitionDelay: "0s",
      transitionBehavior: "allow-discrete",
    },

    // Backdrop — open/steady state
    "&[open]::backdrop": {
      opacity: 1,
    },

    // Entry animation — must be a sibling of "&[open]", not nested inside it
    _starting: {
      "&[open]": {
        opacity: 0,
        transform: "scale(0.95)",
      },
      "&[open]::backdrop": {
        opacity: 0,
      },
    },
  },

  variants: {
    // Vertical placement — drives margin-block axis
    align: {
      top: {
        marginBlockStart: "xl",
        marginBlockEnd: "auto",
      },
      "top-center": {
        marginBlockStart: "25dvh",
        marginBlockEnd: "auto",
      },
      center: {
        marginBlock: "auto",
      },
      "bottom-center": {
        marginBlockStart: "auto",
        marginBlockEnd: "25dvh",
      },
      bottom: {
        marginBlockStart: "auto",
        marginBlockEnd: "xl",
      },
      stretch: {
        marginBlock: "xl",
        height: "calc(100dvh - token(spacing.xl) * 2)",
      },
    },

    // Horizontal placement — drives margin-inline axis.
    // Uses 100% (not 100vw) for stretch to exclude the scrollbar gutter,
    // preventing a horizontal scrollbar on pages with a visible scrollbar.
    justify: {
      start: {
        marginInlineStart: "xl",
        marginInlineEnd: "auto",
      },
      center: {
        marginInline: "auto",
      },
      end: {
        marginInlineStart: "auto",
        marginInlineEnd: "xl",
      },
      stretch: {
        marginInline: "xl",
        width: "calc(100% - token(spacing.xl) * 2)",
      },
    },
  },

  defaultVariants: {
    align: "center",
    justify: "center",
  },
});

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  function Dialog(
    { align, justify, onClose, children, className, onClick, ...rest },
    ref,
  ) {
    function handleClick(e: MouseEvent<HTMLDialogElement>) {
      // Close when clicking the backdrop (the dialog element itself, not its content)
      if (e.target === e.currentTarget) {
        (e.currentTarget as HTMLDialogElement).close();
      }
      onClick?.(e);
    }

    // Own the Escape dismissal rather than leaving it to the browser's native
    // <dialog> cancel. In Safari, an Escape that closes a modal dialog is also
    // treated as an "exit fullscreen" request; preventDefault() suppresses that,
    // and we close the dialog ourselves. Capture phase so no child (e.g. cmdk)
    // can swallow the key first.
    function handleKeyDownCapture(e: KeyboardEvent<HTMLDialogElement>) {
      if (e.key === "Escape" && e.currentTarget.open) {
        e.preventDefault();
        e.currentTarget.close();
      }
    }

    return (
      <dialog
        ref={ref}
        className={cx(dialogRecipe({ align, justify }), className)}
        onClose={onClose}
        onClick={handleClick}
        onKeyDownCapture={handleKeyDownCapture}
        {...rest}
      >
        {children}
      </dialog>
    );
  },
);
