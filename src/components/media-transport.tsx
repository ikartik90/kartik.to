"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cx } from "../../styled-system/css";
import { mediaTransport } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import PlayIcon from "@/assets/icons/play.svg";
import PauseIcon from "@/assets/icons/pause.svg";

// ---------------------------------------------------------------------------
// The house transport for a clip: ONE play/pause chip in the bottom-right
// corner of the surface showing it, instead of the browser's strip across the
// foot of the picture.
//
// It takes the ELEMENT rather than rendering it, because the two are not always
// siblings. `Media` puts the chip beside its own clip, which is what the
// lightbox and the article block want; a collection tile cannot, because the
// tile is itself a button that opens the lightbox and one control may not
// contain another — there the chip is a sibling of that button, laid over the
// same cell. Taking the element keeps both arrangements on one implementation.
//
// Positioning is the `mediaTransport` recipe's, and it is absolute against
// whatever positioned box the surface provides — the cell, the lightbox frame,
// the article block's media frame. Nothing enters the media's own layout, so a
// surface turns this on without a pixel of the picture moving.
// ---------------------------------------------------------------------------

export interface MediaTransportProps {
  /**
   * The clip this works. Null until it mounts — which is why the surface holds
   * it as STATE rather than in a ref: the chip has to re-render when the
   * element arrives, and arrive again it does, since the lightbox keys its clip
   * by index and stepping mounts a fresh one.
   */
  clip: HTMLVideoElement | null;
  className?: string;
}

export function MediaTransport({ clip, className }: MediaTransportProps) {
  /**
   * The chip reports the ELEMENT, and the element is exactly the "external
   * system" this hook exists for: the clip is started and stopped by plenty of
   * things this button never hears about — the autoplay policy declining it,
   * the reduced-motion pause, a tab going to the background — so the answer is
   * READ from it on every render and re-read whenever it announces a change.
   *
   * A `playing` flag kept in state would be a copy of that answer, and a copy
   * can be stale: a clip that begins before the chip has finished mounting
   * announces its `play` to nobody, and the button then offers to start
   * something already running. (`ended` is not subscribed — every clip loops.)
   */
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!clip) return () => {};
      clip.addEventListener("play", onChange);
      clip.addEventListener("pause", onChange);
      return () => {
        clip.removeEventListener("play", onChange);
        clip.removeEventListener("pause", onChange);
      };
    },
    [clip],
  );
  const playing = useSyncExternalStore(
    subscribe,
    () => Boolean(clip) && !clip!.paused,
    // Nothing plays on the server, so the markup it renders is the one a clip
    // that has not started yet gets — no hydration mismatch either way.
    () => false,
  );

  // Reads its own state rather than the element's `paused`, so the press does
  // exactly what the label offered — the two can never disagree about which of
  // them the visitor is looking at.
  const toggle = useCallback(() => {
    if (!clip) return;
    if (playing) clip.pause();
    // Rejects whenever the browser declines; the clip simply stays where it is.
    else void clip.play()?.catch(() => {});
  }, [clip, playing]);

  // Nothing to work: either the element has not mounted yet (one render, at
  // most) or the surface handed over a photograph, which has nothing to play.
  // A chip that appears over a still picture is a button that cannot do
  // anything, which is worse than no button at all.
  if (!clip) return null;

  const label = playing ? "Pause video" : "Play video";

  // The corner is held by a box of its own rather than by the button, and that
  // is load-bearing: `action`'s `icon` variant is itself `position: relative`,
  // and a recipe's base cannot out-rank another recipe's VARIANT — they are in
  // different sub-layers, so source order cannot settle it either. Positioning
  // the button directly leaves it in flow, beside the picture instead of over
  // it. The same arrangement `demoFrameControls` has always had.
  return (
    <span data-media-transport="" className={cx(mediaTransport(), className)}>
      <Button
        variant="icon"
        // A chip on a picture, not on a surface of the app's own — it has to
        // carry its own ground to stay legible over whatever is playing.
        emphasis="glass"
        // Named for what the press will DO, which is the opposite of what the
        // clip is doing. The tooltip says the same thing, and it is never both.
        aria-label={label}
        onClick={toggle}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        <Button.Tooltip>
          <Tooltip.Text>{label}</Tooltip.Text>
        </Button.Tooltip>
      </Button>
    </span>
  );
}
