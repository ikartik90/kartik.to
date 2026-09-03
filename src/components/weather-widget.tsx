"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { weatherWidget } from "../../styled-system/recipes";
import { WeatherGraphic } from "@/components/weather-graphic";
import { WEATHER_LOCATION } from "@/data/weather-location";
import {
  DEGREE_RING,
  formatDegrees,
  weatherLabel,
  type WeatherReading,
} from "@/domain/weather";

// ---------------------------------------------------------------------------
// The weather graphic as a home-screen card: the drawing, and a readout of
// what it means.
//
// The graphic is built entirely around the transition BETWEEN two skies —
// clouds that slide in and fade up, rain that starts falling out of the deck
// that arrived to carry it. Wiring it to live weather is the one thing that
// throws all of that away: real weather changes a couple of times a day, so
// essentially every visitor would meet a still picture and never learn there
// was anything to see.
//
// So the card performs its transition on ARRIVAL. It opens on a resting sky
// and the reading's own weather moves into it, once, on load. Nothing false is
// ever claimed by that — an empty sky is where the drawing starts, not a
// competing forecast — and it means the craft is visible on a first visit
// rather than on the statistical off-chance of being here when the rain does.
//
// The staging is the fiddly part and is deliberate:
//
//   - `useLayoutEffect` drops to the resting sky BEFORE the browser paints, so
//     the true sky the server rendered is never shown and then taken away. An
//     ordinary effect runs after paint, which would flicker true → empty →
//     true on every load.
//   - The markup React renders is therefore the TRUE state. That is what the
//     server sends and what a visitor running no JS keeps, so the card is
//     never merely a spinner for a bundle.
//   - Two nested frames before settling, because a CSS transition only runs if
//     the old value was painted; setting both ends inside one frame is a cut.
//   - A timer behind those frames, because a HIDDEN tab runs no frames at all.
//     Staged on `requestAnimationFrame` alone, a card opened in a background
//     tab (a cmd-click, a restored session) sat on the resting sky until
//     someone looked at it — showing a clear sky under the word "cloudy",
//     which is the one thing this card must never do.
// ---------------------------------------------------------------------------

/**
 * How long the entry may wait for frames that may never come, in ms.
 *
 * Two frames is about 32ms on a live tab, so this is far enough back to never
 * beat them and short enough that a tab which produces none is only briefly
 * wrong. When it does win there is no transition to see, which is correct: the
 * only tab that gets here is one nobody is looking at.
 */
const ENTRY_TIMEOUT_MS = 250;

/** Whether this visitor has asked not to be moved at. */
function motionIsUnwanted(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

export interface WeatherWidgetProps {
  /** The current observation, or `null` if the service could not supply one. */
  reading: WeatherReading | null;
}

export function WeatherWidget({ reading }: WeatherWidgetProps) {
  const classes = weatherWidget({ available: reading !== null });

  // The hour is known even when the weather is not — but only from a reading,
  // so a card with no data rests at day rather than guessing from a clock in
  // the visitor's timezone, which is the wrong timezone.
  const time = reading?.time ?? "day";

  // True from the very first render, so the server's markup is the real sky.
  // The entry, when it runs, only ever moves this backwards for a frame.
  const [settled, setSettled] = useState(true);

  useLayoutEffect(() => {
    // Nothing to arrive at, and nothing to arrive from.
    if (!reading || motionIsUnwanted()) return;
    // Deliberate — the whole point is a commit that DISAGREES with the one the
    // server rendered, staged before the browser paints. There is no way to
    // start an entry animation from a state the server must not send other
    // than to leave it, once, after mounting. Same bargain as `useThemeToggle`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettled(false);
  }, [reading]);

  useEffect(() => {
    if (settled) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    const fallback = setTimeout(() => setSettled(true), ENTRY_TIMEOUT_MS);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(fallback);
    };
  }, [settled]);

  // Clear, at the reading's own hour — a night arrival must not flash a sun on
  // its way to the rain.
  const condition = settled ? reading?.condition ?? "clear" : "clear";

  return (
    <div className={classes.root} data-available={reading !== null}>
      {/* The place leads, and this is the order the card is read in as much as
          the order it is drawn in: the temperature is the loudest thing here,
          and a visitor who meets it before they meet the city takes it for
          their own weather and has to be corrected. */}
      <p className={classes.place}>{WEATHER_LOCATION.place}</p>

      <div
        className={classes.art}
        // Present only for the single frame the entry starts from — see the
        // `art` slot in `panda.config.ts` for what it switches off and why.
        data-entry={settled ? undefined : "resting"}
      >
        <div className={classes.drawing}>
          {/* Decorative: the readout below it already says what the weather
              is, in words, and a screen reader should not hear it twice. */}
          <WeatherGraphic condition={condition} time={time} label={null} />
        </div>
      </div>

      <div className={classes.readout}>
        {reading && (
          <p className={classes.temperature}>
            {formatDegrees(reading.temperatureC)}
            {/* Out of flow, so the DIGITS are what the column centres — see
                `DEGREE_RING`. Adjacent in the DOM either way, so the line is
                still read as "23°". */}
            <span className={classes.degree}>{DEGREE_RING}</span>
          </p>
        )}
        <p className={classes.condition}>
          {reading ? weatherLabel(reading.condition) : "Weather unavailable"}
        </p>
      </div>
    </div>
  );
}
