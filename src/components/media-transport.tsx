"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cx } from "../../styled-system/css";
import { mediaTransport } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import PlayIcon from "@/assets/icons/play.svg";
import PauseIcon from "@/assets/icons/pause.svg";

export interface MediaTransportProps {
  /** Hold it as state, not a ref: the chip must re-render when a new clip mounts. */
  clip: HTMLVideoElement | null;
  /** The bottom corner it sits in. */
  corner?: "start" | "end";
  className?: string;
}

export function MediaTransport({
  clip,
  corner = "end",
  className,
}: MediaTransportProps) {
  // Read from the element, not mirrored in state: a clip that starts before mount would leave a stale flag.
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
    () => false,
  );

  const toggle = useCallback(() => {
    if (!clip) return;
    if (playing) clip.pause();
    else void clip.play()?.catch(() => {});
  }, [clip, playing]);

  if (!clip) return null;

  const label = playing ? "Pause video" : "Play video";

  // The wrapper holds the corner: `action`'s icon variant is `position: relative` and would win on the button.
  return (
    <span className={cx(mediaTransport({ corner }), className)}>
      <Button
        variant="icon"
        emphasis="glass"
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
