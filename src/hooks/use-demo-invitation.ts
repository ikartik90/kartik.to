"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { hasCursor } from "@/data/media-queries";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";
import { getPointerPosition } from "./use-input-modality";
import { useHintTooltip } from "./use-hint-tooltip";

// ---------------------------------------------------------------------------
// The hand-over at the end of a self-playing demo: "Try it yourself", put where
// the visitor's OWN cursor is resting, so the invitation arrives in the one
// place they are already looking rather than pinned to a corner of the frame.
//
// It belongs to the PAGE, not to the frame. An article carrying three of these
// demos makes the offer once between them — on whichever run finishes first —
// because the invitation is to try the prototype, and it only needs making
// once. The latch is module-level for that reason (three sibling components
// have no other common ground) and keyed by pathname, so a soft navigation to
// the next article is a fresh room with a fresh offer.
//
// Positioning and the clocks are `useHintTooltip`'s, which is the right
// primitive for exactly this: it teaches rather than labels, so it withdraws on
// its own after a few seconds and can be retired outright the moment the
// gesture it was suggesting actually happens. Because that hook rides on
// `useCursorTooltip`, the invitation FOLLOWS the visitor from the instant they
// move — which is the whole trick, since a cursor that has not moved is still
// exactly where `getPointerPosition` last saw it, scrolling included.
//
// No cursor on screen, no invitation: `getPointerPosition` answers null for a
// mouse that has never been over the page and for one that has since left it.
// Neither is a place to put a tooltip, and neither SPENDS the page's offer —
// the demo that finishes after the visitor's pointer arrives still gets to
// make it.
//
// A device with no cursor AT ALL is a different question, and the answer is not
// "wait for one". A finger leaves no cursor behind, only the coordinates of the
// last thing it touched — which is why the invitation used to arrive at some
// arbitrary spot on a phone, wherever the visitor had last tapped, and then
// slide about as they scrolled. So the offer DOCKS instead: the same hint on
// the same clock, placed by the stylesheet at the foot of the screen, where an
// invitation with no cursor to point from belongs. `hasCursor()` is asked at
// the moment a run finishes rather than watched, because that is the only
// moment it decides anything.
// ---------------------------------------------------------------------------

/** Has an invitation been made at all? */
let invited = false;
/**
 * The path it was made on. Kept ALONGSIDE the flag rather than standing in for
 * it, because `usePathname` answers null outside a router — and "which page is
 * this" being unanswerable must not read as "this page has had its invitation",
 * which comparing a null-initialised path against a null pathname would do.
 */
let invitedOn: string | null = null;

/** Test-only: hand the page back its unspent invitation. */
export function resetDemoInvitation(): void {
  invited = false;
  invitedOn = null;
}

export interface DemoInvitation {
  /** Goes on the `Tooltip` that carries the copy, via `TooltipHostContext`. */
  ref: RefObject<HTMLElement | null>;
  /** Is it up? Same context, same host contract. */
  visible: boolean;
  /** Placed at the foot of the screen rather than at a cursor. Same contract. */
  docked: boolean;
  /** A run finished — make the offer, if this page still has one to make. */
  offer: () => void;
}

/**
 * @param stageRef The demo's own stage. A press inside it is the visitor taking
 * the demo up on the offer, which retires it — the show's own presses excepted.
 */
export function useDemoInvitation(
  stageRef: RefObject<HTMLElement | null>,
): DemoInvitation {
  const pathname = usePathname();
  const { ref, visible, docked, show, dock, retire } = useHintTooltip();

  const offer = useCallback(() => {
    if (invited && invitedOn === pathname) return;
    const cursor = hasCursor();
    const pointer = cursor ? getPointerPosition() : null;
    // A device that HAS a cursor and has not shown it yet is worth waiting for.
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
      // A replay pressed while the invitation is still up performs with a
      // stand-in cursor that presses things. That is the show reaching in, not
      // the visitor, and it has not taken anybody up on anything.
      if (!isSyntheticPointer(event)) retire();
    };
    stage.addEventListener("pointerdown", onPointerDown);
    return () => stage.removeEventListener("pointerdown", onPointerDown);
  }, [visible, stageRef, retire]);

  return { ref, visible, docked, offer };
}
