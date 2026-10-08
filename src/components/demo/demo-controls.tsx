"use client";

import { createContext, useContext } from "react";
import { css } from "../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import PlayIcon from "@/assets/icons/play.svg";
import StopIcon from "@/assets/icons/stop.svg";
import ResetIcon from "@/assets/icons/reset.svg";

export interface DemoControlsProps {
  /** Replays from the top, cancelling any run in flight. */
  onPlay: () => void;
  /** Stops where it stands; whatever the run committed stays. */
  onStop: () => void;
  onReset: () => void;
  /** The tour's own `running`, opening beat to hand-over, not the cursor's visibility. */
  running: boolean;
  /** The demo carries work and nothing is performing. */
  resettable: boolean;
}

export interface DemoControlsLabels {
  play: string;
  stop: string;
  /** Said after the transport. */
  hint?: string;
}

/** Words for Play and Stop, for a page that shows the controls in the open; without it they're icons in the corner. */
export const DemoControlsLabels = createContext<DemoControlsLabels | null>(
  null,
);

const demoFrameControlsStyle = css({
  position: "absolute",
  // 16 − 12 = 4 keeps the chip's corner concentric with the frame's.
  right: "lg",
  bottom: "lg",
  // The demo can carry stacking contexts of its own.
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "sm",
  // `icon` buttons inherit colour; this is the calendar chevrons' pair, right in both themes.
  color: "field.text.default",
  opacity: 0,
  transition: "opacity 150ms ease",
  "[data-demo-frame]:hover &, [data-demo-frame]:focus-within &": {
    opacity: 1,
  },
  "@media (hover: none)": { opacity: 1 },
});

/** Play-or-Stop and Reset in the frame's corner; render it outside the demo's stage. */
export function DemoControls({
  onPlay,
  onStop,
  onReset,
  running,
  resettable,
}: DemoControlsProps) {
  const labels = useContext(DemoControlsLabels);
  return (
    <div
      role="toolbar"
      aria-label="Demo controls"
      className={demoFrameControlsStyle}
    >
      {/* Reset sits inboard: the row is pinned by its right edge, so Reset comes and goes without moving the transport. */}
      {resettable ? (
        <Button
          variant="icon"
          emphasis={labels ? "accent" : undefined}
          aria-label="Reset Demo"
          onClick={onReset}
          data-control="reset"
        >
          <ResetIcon />
          <Button.Tooltip>
            <Tooltip.Text>Reset Demo</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      ) : null}
      {labels ? (
        <>
          {running ? (
            <Button
              variant="text"
              aria-label="Stop Demo"
              onClick={onStop}
              data-control="transport"
            >
              <StopIcon aria-hidden />
              {labels.stop}
            </Button>
          ) : (
            <Button variant="text" onClick={onPlay} data-control="transport">
              <PlayIcon aria-hidden />
              {labels.play}
            </Button>
          )}
          {labels.hint ? <span data-control="hint">{labels.hint}</span> : null}
        </>
      ) : running ? (
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
