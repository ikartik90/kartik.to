"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { hasCursor } from "@/data/media-queries";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";
import { getPointerPosition } from "./use-input-modality";
import { useHintTooltip } from "./use-hint-tooltip";

// "Try it yourself" after a demo, at the visitor's cursor (docked at the foot without one).
// Offered once per page across all demos, hence the module-level latch keyed by pathname.

let invited = false;
// Separate from `invited`: `usePathname` can be null, which must not read as already invited.
let invitedOn: string | null = null;

/** Test-only: hand the page back its unspent invitation. */
export function resetDemoInvitation(): void {
  invited = false;
  invitedOn = null;
}

export interface DemoInvitation {
  /** Goes on the `Tooltip` that carries the copy, via `TooltipHostContext`. */
  ref: RefObject<HTMLElement | null>;
  visible: boolean;
  docked: boolean;
  offer: () => void;
}

/** A real press inside `stageRef` takes up the offer and retires it. */
export function useDemoInvitation(
  stageRef: RefObject<HTMLElement | null>,
): DemoInvitation {
  const pathname = usePathname();
  const { ref, visible, docked, show, dock, retire } = useHintTooltip();

  const offer = useCallback(() => {
    if (invited && invitedOn === pathname) return;
    const cursor = hasCursor();
    const pointer = cursor ? getPointerPosition() : null;
    // Don't spend the offer until the cursor is on the page.
    if (cursor && !pointer) return;
    invited = true;
    invitedOn = pathname;
    if (pointer) show(pointer.x, pointer.y);
    else dock();
  }, [pathname, show, dock]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!visible || !stage) return;
    const onPointerDown = (event: Event) => {
      if (!isSyntheticPointer(event)) retire();
    };
    stage.addEventListener("pointerdown", onPointerDown);
    return () => stage.removeEventListener("pointerdown", onPointerDown);
  }, [visible, stageRef, retire]);

  return { ref, visible, docked, offer };
}
