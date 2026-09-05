"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { dragOffset, shouldDismiss } from "@/utils/sheet-drag";
import { beginControlDrag, endControlDrag } from "@/utils/control-drag";

// ---------------------------------------------------------------------------
// useSheetDrag — pull a bottom sheet down to send it away.
//
// The second way out of a sheet, beside the close button in its header: the
// one a thumb reaches for without looking. The header is the grip, so the
// gesture starts where the sheet already says "this is the top of me" and the
// controls below it keep their own scroll.
//
// What is left here is the bookkeeping — which pointer, where it went down, how
// fast it was going when it left. The two decisions it feeds (where the sheet
// sits, and what letting go means) are in `utils/sheet-drag.ts`.
//
// `enabled` is asked at PRESS TIME rather than subscribed to, because the
// answer is a layout question — is this thing a sheet right now, or a sidebar?
// — and a sidebar's header is dragged by nobody. Reading it here means no media
// query subscription, no re-render on rotation, and nothing for the server to
// render differently from the client.
// ---------------------------------------------------------------------------

export interface SheetDragOptions {
  /** The sheet itself, for the height the dismiss threshold is a share of. */
  sheetRef: RefObject<HTMLElement | null>;
  /** Called once, on release, when the gesture means "take it away". */
  onDismiss: () => void;
  /** Whether the panel is a sheet at all right now. */
  enabled: () => boolean;
  /**
   * The clock the flick is timed against, in milliseconds. A seam, and not one
   * for tests alone: `event.timeStamp` is measured from a different origin in
   * different browsers, and a gesture's speed is the one number here that
   * cannot be checked by eye.
   */
  now?: () => number;
}

export interface SheetDrag {
  /**
   * How far down the sheet is being held, or `null` when no gesture is running
   * — which is the difference between "sitting at 0 because I am holding it
   * there" and "not mine to place". A finished drag must hand the sheet back
   * to CSS rather than pin it with an inline transform.
   */
  offset: number | null;
  dragHandlers: {
    /**
     * Marks the element as the grip. It rides WITH the handlers rather than
     * being left to the consumer to remember, because the two are one decision:
     * whatever is dragged is what must not be selected while it is
     * (`[data-sheet-grip]` in panda.config.ts's globalCss). Nobody can wire the
     * gesture without the rule now, which is the point — this is a fix that
     * would otherwise have to be repeated by hand at every new grip.
     */
    "data-sheet-grip": string;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
}

/** Where a live gesture started, and where it was last seen. */
interface Gesture {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  speed: number;
}

export function useSheetDrag({
  sheetRef,
  onDismiss,
  enabled,
  now = () => performance.now(),
}: SheetDragOptions): SheetDrag {
  const [offset, setOffset] = useState<number | null>(null);
  // A ref, not state: this is read inside the move handler that would be
  // setting it, and it must not schedule a render of its own.
  const gesture = useRef<Gesture | null>(null);

  const end = () => {
    // Selection goes back before the gesture is forgotten — this is the one
    // place that knows which pointer was holding it, and every route out
    // (release, cancel, unmount) comes through here.
    if (gesture.current) endControlDrag(gesture.current.pointerId);
    gesture.current = null;
    setOffset(null);
  };

  // The route no event covers: a drag past the threshold DISMISSES the panel,
  // which unmounts the grip before any release reaches it. Without this the
  // page would be left permanently unable to select — by the gesture working,
  // not by it failing.
  useEffect(() => {
    const live = gesture;
    return () => {
      if (live.current) endControlDrag(live.current.pointerId);
    };
  }, []);

  return {
    offset,
    dragHandlers: {
      "data-sheet-grip": "",
      onPointerDown: (event) => {
        if (!enabled()) return;
        // The grip IS the header, and a header is a line of text. On a phone
        // that makes it the same defect the sliders had: iOS anchors a
        // selection on the nearest selectable text and paints the panel's own
        // title blue while it is being pulled down. The static half of the
        // answer is in globalCss; this is the half that covers where the drag
        // TRAVELS, which is the length of the screen.
        beginControlDrag(event.pointerId);
        gesture.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          lastTime: now(),
          speed: 0,
        };
        setOffset(0);
        // Follow the finger off the header — and off the sheet — so a fast drag
        // does not simply stop when it outruns the element it started on.
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },

      onPointerMove: (event) => {
        const live = gesture.current;
        if (!live || live.pointerId !== event.pointerId) return;
        const time = now();
        const elapsed = time - live.lastTime;
        // Two events in the same millisecond say nothing about speed: the
        // distance between them divided by nearly nothing is a flick every
        // time. The last reading stands until the clock has moved.
        if (elapsed > 0) {
          live.speed = (event.clientY - live.lastY) / elapsed;
          live.lastTime = time;
        }
        live.lastY = event.clientY;
        setOffset(dragOffset(event.clientY - live.startY));
      },

      onPointerUp: (event) => {
        const live = gesture.current;
        if (!live || live.pointerId !== event.pointerId) return;
        const released = {
          offset: dragOffset(event.clientY - live.startY),
          height: sheetRef.current?.offsetHeight ?? 0,
          speed: live.speed,
        };
        end();
        if (shouldDismiss(released)) onDismiss();
      },

      onPointerCancel: end,
    },
  };
}
