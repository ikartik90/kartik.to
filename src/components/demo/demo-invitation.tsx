"use client";

import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import type { DemoInvitation as DemoInvitationState } from "@/hooks/use-demo-invitation";

// ---------------------------------------------------------------------------
// The words a finished walkthrough hands over with, drawn at the visitor's own
// cursor — see `useDemoInvitation` for when a page makes the offer and when it
// declines to. This is only the copy and the wiring: the hook owns the state,
// the shared cursor-following tooltip owns the box, the position, and its own
// escape from anything that crops.
//
// That escape used to live here, because this was the first tooltip anchored to
// the CURSOR rather than to the element it labels — routinely outside the
// DemoFrame it was rendered inside, and a frame is `overflow: hidden` over a
// `container-type` whose containment makes it the containing block for a fixed
// child. v0 adds the shift form's `clip-path` torn edges on top of that. The
// frame's own replay/reset rail then proved the problem was never this
// component's: `Tooltip` portals itself now, so every tooltip in the app is
// clear of every clip and this is back to being copy.
// ---------------------------------------------------------------------------

export type DemoInvitationProps = DemoInvitationState;

/** "Try it yourself", at the visitor's cursor, once a demo has performed. */
export function DemoInvitation({ ref, visible }: DemoInvitationProps) {
  return (
    <TooltipHostContext.Provider value={{ ref, visible }}>
      <Tooltip tone="brand">
        <Tooltip.Text>Try it yourself</Tooltip.Text>
      </Tooltip>
    </TooltipHostContext.Provider>
  );
}
