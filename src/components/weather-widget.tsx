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

// Renders the true sky (server and no-JS), drops to a resting sky before paint, then settles back
// so the transition plays on arrival. A timeout backs up the frames, since a hidden tab runs none.

/** Backs up the two frames in a hidden tab, which runs none. */
const ENTRY_TIMEOUT_MS = 250;

function motionIsUnwanted(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

export interface WeatherWidgetProps {
  /** `null` when the service could not supply one. */
  reading: WeatherReading | null;
}

export function WeatherWidget({ reading }: WeatherWidgetProps) {
  const classes = weatherWidget({ available: reading !== null });

  // From the reading only: the visitor's clock is in the wrong timezone.
  const time = reading?.time ?? "day";

  // True from the first render, so the server's markup is the real sky.
  const [settled, setSettled] = useState(true);

  useLayoutEffect(() => {
    if (!reading || motionIsUnwanted()) return;
    // Deliberately disagrees with the server's commit, before paint, to start the entry.
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

  // Clear at the reading's own hour, so a night arrival never flashes a sun.
  const condition = settled ? reading?.condition ?? "clear" : "clear";

  return (
    <div className={classes.root} data-available={reading !== null}>
      {/* The place leads, so the temperature is not read as the visitor's own. */}
      <p className={classes.place}>{WEATHER_LOCATION.place}</p>

      <div
        className={classes.art}
        // Only for the frame the entry starts from (see the recipe's `art` slot).
        data-entry={settled ? undefined : "resting"}
      >
        <div className={classes.drawing}>
          {/* Decorative: the readout says it in words. */}
          <WeatherGraphic condition={condition} time={time} label={null} />
        </div>
      </div>

      <div className={classes.readout}>
        {reading && (
          <p className={classes.temperature}>
            {formatDegrees(reading.temperatureC)}
            {/* Out of flow, so the digits are what the column centres. */}
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
