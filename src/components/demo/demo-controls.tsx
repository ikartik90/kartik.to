"use client";

import { demoFrameControls } from "../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import ReplayIcon from "@/assets/icons/replay.svg";
import ResetIcon from "@/assets/icons/reset.svg";

// ---------------------------------------------------------------------------
// The two controls a self-playing demo owes its visitor: run the walkthrough
// again, or put the prototype back the way it started. Shared by the Shift
// Scheduling demos that perform themselves, because the pair is the same offer
// every time — only what "reset" means differs, and that is the consumer's.
//
// It renders into the FRAME's corner (`demoFrameControls` is absolute against
// the DemoFrame, which is why the recipe lives there rather than here), so it
// must be placed outside the demo's own stage: a press on one of these is the
// visitor operating the demo, not reaching into it mid-performance.
//
// The row IS the toolbar — the recipe already lays the pair out as one
// horizontal row in the corner, so the semantics go on the element that is
// there rather than on a wrapper around it. That element is now a bare flex row
// and nothing else: the shared `toolbar` chrome it used to compose drew a
// second bordered box inside a frame that is already one, so the surface, the
// hairline and the 8px inset are gone and only the buttons are left. The role
// stays regardless — a toolbar is a grouping of controls, not a box drawn
// around them.
//
// `OptionList.Toolbar` is the house primitive for this and was the first thing
// considered, but it is bound to an `OptionList` root for its context and
// layout, and its contract is to flip `OptionList.Option` children into
// toggles — these are icon `Button`s with hover tooltips, which an Option
// cannot carry. Borrowing it would mean an empty OptionList root, a layout to
// fight, and no tooltips.
//
// Semantics only, no roving cursor, matching that primitive's own call: two
// controls do not need a keyboard mode, and folding them into a single tab stop
// would take one of them out of reach to buy nothing.
// ---------------------------------------------------------------------------

export interface DemoControlsProps {
  /** Play the walkthrough again, from the top. */
  onReplay: () => void;
  /** Call off anything in flight and return the demo to its opening state. */
  onReset: () => void;
  /**
   * Is there anything for reset to undo, right now? Two conditions, and the
   * consumer owns both: the prototype carries work, and nothing is performing.
   *
   * A control that cannot change anything is worse than absent — it invites a
   * press and answers with nothing, and the visitor is left wondering what they
   * missed. So an untouched demo offers replay alone, and a demo mid-
   * performance does too: the run is committing work by the second, "back to
   * how it started" is a moving target while it does, and the visitor already
   * has a way to break in — touching the prototype, which stands the show down
   * and hands reset back on the spot.
   */
  resettable: boolean;
}

/** Replay / Reset, tucked into the demo frame's bottom-right corner. */
export function DemoControls({
  onReplay,
  onReset,
  resettable,
}: DemoControlsProps) {
  return (
    <div
      role="toolbar"
      // Named because there is nothing visible to name it — every other toolbar
      // in the app is labelled the same way, and an unnamed one announces as a
      // bare group.
      aria-label="Demo controls"
      className={demoFrameControls()}
    >
      {/* Replay sits in the corner itself, with Reset inboard of it: replay is
          the offer the demo has just finished making, and reset only means
          anything once there is something to clear. DOM order is the visual
          order, so the tab order runs the same way.

          That ordering is also what lets Reset come and go without disturbing
          anything: the row is pinned by its right edge, so the one control
          that is always here keeps its corner and it is the row's far side
          that moves. Reset arrives beside Replay rather than under the pointer
          that was reaching for it. */}
      {resettable ? (
        <Button variant="icon" aria-label="Reset Demo" onClick={onReset}>
          <ResetIcon />
          <Button.Tooltip>
            <Tooltip.Text>Reset Demo</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      ) : null}
      <Button variant="icon" aria-label="Replay Demo" onClick={onReplay}>
        <ReplayIcon />
        <Button.Tooltip>
          <Tooltip.Text>Replay Demo</Tooltip.Text>
        </Button.Tooltip>
      </Button>
    </div>
  );
}
