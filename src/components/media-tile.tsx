"use client";

import {
  useCallback,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { Media } from "@/components/media";
import { MediaTransport } from "@/components/media-transport";
import { BackgroundEffectLayer } from "@/components/background-effect";
import type { MediaNode } from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";

// The transport is a sibling of the tile button, since one control may not contain another.

export interface MediaTileClasses {
  /** The positioned box the ground fills and the transport pins to. */
  surface: string;
  tile: string;
  image: string;
  backgroundEffect: string;
}

export interface MediaTileProps {
  item: MediaNode;
  classes: MediaTileClasses;
  fallbackLabel: string;
  autoPlay?: boolean;
  /** Absent, the picture is shown but opens nothing. */
  onOpen?: () => void;
  children?: ReactNode;
  surfaceProps?: HTMLAttributes<HTMLDivElement> & {
    ref?: Ref<HTMLDivElement>;
    [state: `data-${string}`]: unknown;
  };
}

export function MediaTile({
  item,
  classes,
  fallbackLabel,
  autoPlay = true,
  onOpen,
  children,
  surfaceProps,
}: MediaTileProps) {
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);
  const holdClip = useCallback((node: HTMLElement | null) => {
    setClip(node instanceof HTMLVideoElement ? node : null);
  }, []);

  const media = (
    <Media
      src={item.src}
      kind={item.kind}
      alt={collectionItemAlt(item)}
      className={classes.image}
      layout={item}
      width={item.width}
      height={item.height}
      loading="lazy"
      autoPlay={autoPlay}
      elementRef={holdClip}
    />
  );

  return (
    <div
      className={classes.surface}
      // The box the transport pins to.
      data-media-surface=""
      {...surfaceProps}
    >
      {item.backgroundEffect && (
        <BackgroundEffectLayer
          effect={item.backgroundEffect}
          className={classes.backgroundEffect}
        />
      )}
      {onOpen ? (
        <button
          type="button"
          data-media-tile=""
          className={classes.tile}
          aria-label={collectionItemAlt(item) || fallbackLabel}
          onClick={onOpen}
        >
          {media}
        </button>
      ) : (
        media
      )}
      {children}
      <MediaTransport clip={clip} />
    </div>
  );
}
