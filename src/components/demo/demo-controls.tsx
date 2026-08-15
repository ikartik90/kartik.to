"use client";

import { demoFrameControls } from "../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import PlayIcon from "@/assets/icons/play.svg";
import StopIcon from "@/assets/icons/stop.svg";
import ResetIcon from "@/assets/icons/reset.svg";

// ---------------------------------------------------------------------------
// The two controls a self-playing demo owes its visitor: work the performance,
// or put the prototype back the way it started. Shared by the Shift Scheduling
// demos that perform themselves, because the pair is the same offer every time
// — only what "reset" means differs, and that is the consumer's.
//
// The first of the two is ONE control with two faces, not two controls: a demo
// standing still offers the way in (play, from the top), and a demo mid-
// performance offers the way out (stop, where it stands). They share the corner
// because they are never both true, so whatever is under the pointer is always
// the thing the moment calls for — and a visitor who wants out no longer has to
// know that touching the prototype is what stands the show down.
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
  /**
   * Play the walkthrough from the top, cancelling any run in flight. In
   * practice always a REPLAY — the demo performs itself the moment it comes on
   * screen, so by the time this is pressed it has usually been through once.
   */
  onPlay: () => void;
  /**
   * Call the run off where it stands. Whatever it has already committed stays
   * committed: the visitor is stopping a performance, not undoing it, and reset
   * is the control that means the other thing.
   */
  onStop: () => void;
  /** Call off anything in flight and return the demo to its opening state. */
  onReset: () => void;
  /**
   * Is a run in flight right now — from the opening beat to the hand-over? It
   * decides which face the corner control wears, so it must be the tour's own
   * `running` rather than anything narrower: the cursor is off stage for the
   * opening beat and the whole withdrawal, and a stop button that blinked out
   * in those gaps would be offering to play a demo that is still performing.
   */
  running: boolean;
  /**
   * Is there anything for reset to undo, right now? Two conditions, and the
   * consumer owns both: the prototype carries work, and nothing is performing.
   *
   * A control that cannot change anything is worse than absent — it invites a
   * press and answers with nothing, and the visitor is left wondering what they
   * missed. So an untouched demo offers the transport alone, and a demo mid-
   * performance does too: the run is committing work by the second, "back to
   * how it started" is a moving target while it does, and the visitor has two
   * ways to break in — stopping the run outright, or touching the prototype —
   * either of which hands reset back on the spot.
   */
  resettable: boolean;
}

/** Play-or-Stop / Reset, tucked into the demo frame's bottom-right corner. */
export function DemoControls({
  onPlay,
  onStop,
  onReset,
  running,
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
      {/* The transport sits in the corner itself, with Reset inboard of it:
          working the performance is the offer the demo is always making, and
          reset only means anything once there is something to clear. DOM order
          is the visual order, so the tab order runs the same way.

          That ordering is also what lets Reset come and go without disturbing
          anything: the row is pinned by its right edge, so the one control
          that is always here keeps its corner and it is the row's far side
          that moves. Reset arrives beside the transport rather than under the
          pointer that was reaching for it. */}
      {resettable ? (
        <Button variant="icon" aria-label="Reset Demo" onClick={onReset}>
          <ResetIcon />
          <Button.Tooltip>
            <Tooltip.Text>Reset Demo</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      ) : null}
      {running ? (
        <Button variant="icon" aria-label="Stop Demo" onClick={onStop}>
          <StopIcon />
          <Button.Tooltip>
            <Tooltip.Text>Stop Demo</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      ) : (
        <Button variant="icon" aria-label="Play Demo" onClick={onPlay}>
          <PlayIcon />
          <Button.Tooltip>
            <Tooltip.Text>Play Demo</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      )}
    </div>
  );
}
