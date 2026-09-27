"use client";

import {
  forwardRef,
  type HTMLAttributes,
  type SyntheticEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cva, cx } from "../../../styled-system/css";
import { preservePageScroll } from "@/utils/preserve-page-scroll";
import { scrollBoundary } from "@/hooks/use-scroll-handoff";

export type DialogAlign =
  | "top"
  | "top-center"
  | "center"
  | "bottom-center"
  | "bottom"
  | "stretch";

export type DialogJustify = "start" | "center" | "end" | "stretch";

export type DialogMotion = "scale" | "zoom";

export interface DialogProps
  extends Omit<HTMLAttributes<HTMLDialogElement>, "onClose"> {
  align?: DialogAlign;
  justify?: DialogJustify;
  motion?: DialogMotion;
  onClose?: () => void;
  /** Takes Escape, the platform's cancel and a backdrop press instead of closing, for a caller that animates out first. */
  onRequestClose?: () => void;
  children: ReactNode;
}

const dialogRecipe = cva({
  base: {
    display: "none",
    transitionProperty: "opacity, transform, display, overlay",
    transitionTimingFunction: "ease-out",
    transitionDelay: "0s",
    transitionBehavior: "allow-discrete",

    // Flex column: panel footers (`marginTop: auto`) and bodies (`flex: 1`) rely on it.
    "&[open]": {
      display: "flex",
      flexDirection: "column",
    },

    "&::backdrop": {
      opacity: 0,
      // No blur here: Panda emits only `-webkit-backdrop-filter`; globals.css sets both.
      backgroundColor: "bg.canvas/50",
      transitionProperty: "opacity, display, overlay",
      transitionTimingFunction: "ease-out",
      transitionDelay: "0s",
      transitionBehavior: "allow-discrete",
    },

    "&[open]::backdrop": {
      opacity: 1,
    },

    // Must be a sibling of "&[open]", not nested inside it.
    _starting: {
      "&[open]::backdrop": {
        opacity: 0,
      },
    },
  },

  variants: {
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

    // 100%, not 100vw, so `stretch` excludes the scrollbar gutter.
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

    // `zoom`: the caller moves the contents itself, so only the backdrop fades, over its motion.
    motion: {
      scale: {
        opacity: 0,
        transform: "scale(0.95)",
        transitionDuration: "80ms",
        "&::backdrop": { transitionDuration: "80ms" },
        "&[open]": { opacity: 1, transform: "scale(1)" },
        _starting: {
          "&[open]": { opacity: 0, transform: "scale(0.95)" },
        },
      },
      zoom: {
        // `ZOOM_MS` in utils/lightbox-motion.
        "&::backdrop": { transitionDuration: "300ms" },
        "&[open][data-closing]::backdrop": { opacity: 0 },
      },
    },
  },

  defaultVariants: {
    align: "center",
    justify: "center",
    motion: "scale",
  },
});

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  function Dialog(
    {
      align,
      justify,
      motion,
      onClose,
      onRequestClose,
      children,
      className,
      onClick,
      ...rest
    },
    ref,
  ) {
    function requestClose(dialog: HTMLDialogElement) {
      if (onRequestClose) onRequestClose();
      else dialog.close();
    }

    function handleClick(e: MouseEvent<HTMLDialogElement>) {
      // A click on the dialog element itself is a click on its backdrop.
      if (e.target === e.currentTarget) requestClose(e.currentTarget);
      onClick?.(e);
    }

    // preventDefault stops Safari also exiting fullscreen; capture so no child (cmdk) swallows Escape.
    function handleKeyDownCapture(e: KeyboardEvent<HTMLDialogElement>) {
      if (e.key === "Escape" && e.currentTarget.open) {
        e.preventDefault();
        requestClose(e.currentTarget);
      }
    }

    // Safari cancels on Escape even when its keydown was prevented, and would shut the dialog at
    // once. Only the dialog's own: React hands a nested dialog's `cancel` up the component tree.
    function handleCancel(e: SyntheticEvent<HTMLDialogElement>) {
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      requestClose(e.currentTarget);
    }

    // Safari loses the page scroll a few frames after a modal closes; it is still intact here.
    function handleClose() {
      preservePageScroll();
      onClose?.();
    }

    return (
      <dialog
        ref={ref}
        {...scrollBoundary}
        className={cx(dialogRecipe({ align, justify, motion }), className)}
        onClose={handleClose}
        onCancel={handleCancel}
        onClick={handleClick}
        onKeyDownCapture={handleKeyDownCapture}
        {...rest}
      >
        {children}
      </dialog>
    );
  },
);
