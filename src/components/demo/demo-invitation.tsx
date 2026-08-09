"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import type { DemoInvitation as DemoInvitationState } from "@/hooks/use-demo-invitation";

// ---------------------------------------------------------------------------
// The words a finished walkthrough hands over with, drawn at the visitor's own
// cursor — see `useDemoInvitation` for when a page makes the offer and when it
// declines to. This is only the copy and the wiring: the hook owns the state,
// the shared cursor-following tooltip owns the box and the position.
//
// PORTALLED TO THE BODY, and that is the whole reason this component exists
// rather than a `Tooltip` dropped straight into each demo. `position: fixed`
// buys the right COORDINATES, never the right to be seen: an ancestor still
// clips its subtree at paint time, and a DemoFrame is `overflow: hidden` over a
// `container-type` — a showcase frame whose entire job is to crop what it
// holds. v0 adds the shift form's `clip-path` torn edges on top of that.
//
// Every other cursor-following tooltip in the app is anchored to the very
// element it labels, so it is always inside whatever box its trigger lives in.
// This one is anchored to the VISITOR'S CURSOR, which is somewhere on the page
// at large — routinely outside the frame — so as a child of the frame it is
// positioned perfectly and painted nowhere. The tell is a box with a correct
// `getBoundingClientRect`, `opacity: 1`, and no pixels; `element.style.left`
// only ever reports what was written to it, which is why it looked fine.
//
// The popovers the tours open already portal for the same reason, and the
// stand-in cursor is hoisted clear of every clip for its own version of it.
// ---------------------------------------------------------------------------

/** Never changes after the first client render, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

export type DemoInvitationProps = DemoInvitationState;

/** "Try it yourself", at the visitor's cursor, once a demo has performed. */
export function DemoInvitation({ ref, visible }: DemoInvitationProps) {
  // Portalled only from the second render on. There is no `document` to portal
  // into on the server, and simply branching on that is what CAUSES a mismatch:
  // React hydrates by walking the client tree against the server's markup, and
  // a first client render that differs from the server's — even to nothing in
  // place — is the thing it refuses. Rendering null on both passes and moving
  // in an effect later is the fix. Nothing is lost by the delay; the invitation
  // is not wanted until a walkthrough has finished, seconds away.
  // `useSyncExternalStore` with a server snapshot of false is the house way of
  // asking this (see `usePageLoaded`): it answers false on the server AND
  // through hydration, then true, without a state write in an effect.
  const hydrated = useSyncExternalStore(subscribeNever, onClient, onServer);
  if (!hydrated) return null;

  return createPortal(
    <TooltipHostContext.Provider value={{ ref, visible }}>
      <Tooltip>
        <Tooltip.Text>Try it yourself</Tooltip.Text>
      </Tooltip>
    </TooltipHostContext.Provider>,
    document.body,
  );
}
