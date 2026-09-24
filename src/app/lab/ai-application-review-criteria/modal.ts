"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import { preservePageScroll } from "@/utils/preserve-page-scroll";

// ---------------------------------------------------------------------------
// A native modal <dialog>, opened and closed the way the product's drawer and
// its benchmark overlay both are.
//
// Modal, so what is behind is inert, focus is kept inside and handed back to
// whatever opened it, and the dialog sits in the top layer above every
// clipping box it is written inside.
//
// Each opening is a new SESSION: the caller keys the dialog's contents on it,
// so they are remounted fresh and nothing from the last opening survives.
//
// OPENING is the caller's CSS: `@starting-style` gives its transition
// somewhere to come from. CLOSING cannot be, because `close()` hides the
// element at once: the dialog is marked `data-closing`, the caller's CSS
// animates that, and it is closed when the animation has finished — which
// the promise `close` returns resolves on.
//
// A dialog opened from inside another is inside it in the DOM and in React's
// tree too, and React passes `cancel` and `close` up that tree although the
// platform does not bubble them. So every handler answers only for its own
// dialog, or closing the inner one would close both.
// ---------------------------------------------------------------------------

export function useModal({ onClosed }: { onClosed?: () => void } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState(0);
  const closing = useRef<Promise<void> | null>(null);
  // Where the press that became this click began. See `onClick`.
  const pressedBackdrop = useRef(false);

  // After the new contents are committed, so the dialog opens on them and
  // focus lands inside them rather than on what the last session left.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (session > 0 && dialog && !dialog.open) dialog.showModal();
  }, [session]);

  function open() {
    setSession((count) => count + 1);
  }

  function close(): Promise<void> {
    const dialog = ref.current;
    if (!dialog?.open) return Promise.resolve();
    if (closing.current) return closing.current;
    dialog.setAttribute("data-closing", "");
    // Reading the animations settles the style change, so the exit is already
    // among them. None at all (jsdom has no `getAnimations`) closes on the spot.
    const leaving = dialog.getAnimations?.() ?? [];
    if (leaving.length === 0) {
      dialog.close();
      return Promise.resolve();
    }
    closing.current = Promise.allSettled(
      leaving.map((animation) => animation.finished),
    ).then(() => dialog.close());
    return closing.current;
  }

  const own = (event: SyntheticEvent) => event.target === event.currentTarget;

  const dialogProps = {
    ref,
    onClose(event: SyntheticEvent<HTMLDialogElement>) {
      if (!own(event)) return;
      closing.current = null;
      event.currentTarget.removeAttribute("data-closing");
      // Safari drops the page's scroll a few frames after a modal closes.
      preservePageScroll();
      onClosed?.();
    },
    onCancel(event: SyntheticEvent<HTMLDialogElement>) {
      if (!own(event)) return;
      event.preventDefault();
      close();
    },
    // Escape is taken in the capture phase and its default refused, as the
    // site's `Dialog` does: in Safari the same key also leaves full screen.
    // A key pressed inside a dialog opened from this one is that dialog's.
    onKeyDownCapture(event: KeyboardEvent<HTMLDialogElement>) {
      if (
        event.key !== "Escape" ||
        (event.target as Element).closest("dialog") !== event.currentTarget
      )
        return;
      event.preventDefault();
      close();
    },
    // With a menu open, the press only closes the menu.
    onPointerDown(event: MouseEvent<HTMLDialogElement>) {
      pressedBackdrop.current =
        own(event) && !event.currentTarget.querySelector("[data-open-menu]");
    },
    // A click on the backdrop lands on the <dialog> itself. So does the click a
    // drag ends in when it began inside the dialog and was let go outside it —
    // selecting a prompt's text, say — because a click goes to the nearest
    // ancestor of both ends. Only a press that STARTED outside closes.
    onClick(event: MouseEvent<HTMLDialogElement>) {
      if (pressedBackdrop.current && own(event)) close();
    },
  };

  return { session, open, close, dialogProps };
}
