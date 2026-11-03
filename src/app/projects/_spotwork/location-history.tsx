"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { css } from "../../../../styled-system/css";
import { LOCATION_HISTORY } from "./copy";
import type { Ping } from "./dashboard";
import { clock } from "./data";
import { sliderRaw } from "./filters";
import { Button, Tooltip, Typography } from "./ui";
import PauseIcon from "./assets/icons/medium/pause.svg";
import PlayIcon from "./assets/icons/medium/play.svg";

// A worker's location history under the map in View Location and the side sheet: Play, then Range Type's track with a
// dot for each report their phone made, evenly spaced and thicker between reports made in quick succession, and one
// handle on the report shown, the first and last reports' times under its ends.

/** How long Play takes from one report to the next: longer than the map's glide to it. */
export const PLAY_STEP = 800;

/** Reports this many minutes apart or closer were made on the move, their stretch of the track drawn thicker. */
const RUN = 5;

const timelineStyle = css(sliderRaw, {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-md)",
  padding: "var(--sw-padding-md)",
  "& > [data-frame]": {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sw-gap-xs)",
    flex: 1,
    minWidth: 0,
    paddingBlockStart: "var(--sw-padding-md)",
  },
  "& [data-run]": {
    position: "absolute",
    insetBlockStart: "50%",
    height: "0.5rem",
    translate: "0 -50%",
    overflow: "hidden",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-surface-disabled)",
  },
  "& [data-run] > [data-fill]": { height: "100%" },
  "& [data-tick]": { position: "absolute", insetBlockStart: 0, translate: "-50% 0" },
  "& [data-tick][data-in]": { backgroundColor: "var(--sw-glyph-inverted-default)" },
  "& [data-limits]": { display: "flex", justifyContent: "space-between" },
  "&[data-flush]": { paddingInline: 0, paddingBlockEnd: 0 },
});

/** The stretches of `trace` made on the move, as the indices of their first and last reports. */
function runsOf(trace: Ping[]) {
  const runs: [number, number][] = [];
  trace.forEach((ping, i) => {
    if (i === 0 || ping.at - trace[i - 1].at > RUN) return;
    const run = runs.at(-1);
    if (run?.[1] === i - 1) run[1] = i;
    else runs.push([i - 1, i]);
  });
  return runs;
}

/**
 * The timeline of `trace`, its handle at `position` (in reports: 2.5 is halfway from the third to the fourth), which a
 * press or drag on the track, the arrow keys and Play move; the handle rests on a report, and Play from the end starts over.
 * `flush`, its sides level with the map's, for a map inside a padded card.
 */
export function LocationTimeline({
  trace,
  position,
  onPosition,
  flush,
}: {
  trace: Ping[];
  position: number;
  onPosition: (position: number) => void;
  flush?: boolean;
}) {
  const last = trace.length - 1;
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const time = clock(trace[Math.floor(position)].at);
  const at = (index: number) => `${(index / (last || 1)) * 100}%`;

  const begun = useEffectEvent(() => position);
  const tell = useEffectEvent(onPosition);
  useEffect(() => {
    if (!playing) return;
    const from = begun();
    let start: number | undefined;
    let frame = requestAnimationFrame(function step(now) {
      start ??= now;
      const next = Math.min(from + (now - start) / PLAY_STEP, last);
      tell(next);
      if (next < last) frame = requestAnimationFrame(step);
      else setPlaying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, last]);

  const play = () => {
    if (playing) {
      setPlaying(false);
      return onPosition(Math.floor(position));
    }
    if (position >= last) onPosition(0);
    setPlaying(true);
  };

  const nearest = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    return Math.min(Math.max(Math.round(((clientX - box.left) / (box.width || 1)) * last), 0), last);
  };

  const press = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setPlaying(false);
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPosition(nearest(event.clientX));
  };

  const key = (event: KeyboardEvent<HTMLSpanElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: Math.min(Math.floor(position) + 1, last),
      ArrowUp: Math.min(Math.floor(position) + 1, last),
      ArrowLeft: Math.max(Math.ceil(position) - 1, 0),
      ArrowDown: Math.max(Math.ceil(position) - 1, 0),
      Home: 0,
      End: last,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setPlaying(false);
    onPosition(keys[event.key]);
  };

  const label = playing ? LOCATION_HISTORY.pause : LOCATION_HISTORY.play;
  return (
    <div className={timelineStyle} data-flush={flush ? "" : undefined}>
      <Button size="icon" aria-label={label} onClick={play}>
        {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        <Tooltip start>{label}</Tooltip>
      </Button>
      <div data-frame="">
        <div
          ref={track}
          data-track=""
          onPointerDown={press}
          onPointerMove={(event) => dragging && onPosition(nearest(event.clientX))}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <span data-fill="" style={{ left: 0, width: at(position) }} />
          {runsOf(trace).map(([from, to]) => (
            <span key={from} data-run="" style={{ left: at(from), width: at(to - from) }}>
              <span data-fill="" style={{ left: 0, width: `${Math.min(Math.max((position - from) / (to - from), 0), 1) * 100}%` }} />
            </span>
          ))}
          {trace.map((ping, i) => (
            <span key={ping.at} data-dot="" data-tick="" data-in={i <= position ? "" : undefined} style={{ left: at(i) }} />
          ))}
          <span
            role="slider"
            tabIndex={0}
            aria-label={LOCATION_HISTORY.timeline}
            aria-valuemin={0}
            aria-valuemax={last}
            aria-valuenow={Math.floor(position)}
            aria-valuetext={time}
            data-active={dragging || playing ? "" : undefined}
            data-pressed={dragging ? "" : undefined}
            style={{ left: at(position) }}
            onKeyDown={key}
          >
            <Typography variant="metadata">{time}</Typography>
          </span>
        </div>
        <Typography tag="div" variant="metadata" color="placeholder" data-limits="">
          <span>{clock(trace[0].at)}</span>
          <span>{clock(trace[last].at)}</span>
        </Typography>
      </div>
    </div>
  );
}
