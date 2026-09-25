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

export function useModal({ onClosed }: { onClosed?: () => void } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState(0);
  const closing = useRef<Promise<void> | null>(null);
  const pressedBackdrop = useRef(false);

  // Opens after commit, so focus lands in the new session's contents.
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
    // getAnimations() flushes style, so the exit is already listed; jsdom has none.
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

  // React bubbles cancel/close out of nested dialogs; answer only for our own.
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
    // Escape's default is refused: in Safari it also exits full screen.
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
    // A drag from inside to outside also clicks the <dialog>, so only a press
    // that started on the backdrop closes.
    onClick(event: MouseEvent<HTMLDialogElement>) {
      if (pressedBackdrop.current && own(event)) close();
    },
  };

  return { session, open, close, dialogProps };
}
