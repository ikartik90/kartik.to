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

// Pull a bottom sheet down by its header to dismiss it; the decisions live in utils/sheet-drag.ts.

export interface SheetDragOptions {
  sheetRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  /** Asked at press time: is the panel a sheet right now? */
  enabled: () => boolean;
  /** Clock in ms; not `event.timeStamp`, whose origin differs between browsers. */
  now?: () => number;
}

export interface SheetDrag {
  /** Drag offset, or `null` when not dragging so CSS places the sheet, not an inline transform. */
  offset: number | null;
  dragHandlers: {
    /** Pairs with the no-select `[data-sheet-grip]` rule in panda.config.ts globalCss. */
    "data-sheet-grip": string;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
}

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
  const gesture = useRef<Gesture | null>(null);

  const end = () => {
    if (gesture.current) endControlDrag(gesture.current.pointerId);
    gesture.current = null;
    setOffset(null);
  };

  // A dismiss unmounts the grip before any release, so restore selection on unmount too.
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
        // Otherwise iOS selects text along the drag's path.
        beginControlDrag(event.pointerId);
        gesture.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          lastY: event.clientY,
          lastTime: now(),
          speed: 0,
        };
        setOffset(0);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },

      onPointerMove: (event) => {
        const live = gesture.current;
        if (!live || live.pointerId !== event.pointerId) return;
        const time = now();
        const elapsed = time - live.lastTime;
        // Same-millisecond events would read as an infinite flick; keep the last speed.
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
