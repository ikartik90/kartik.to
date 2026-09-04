"use client";

import {
  useCallback,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Media } from "@/components/media";
import { MediaTransport } from "@/components/media-transport";
import { BackgroundEffectLayer } from "@/components/background-effect";
import type { MediaNode } from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";

// ---------------------------------------------------------------------------
// MediaTile — a media object as the reader meets it: the ground behind it, the
// picture, the press that enlarges it, and a clip's transport.
//
// The same composition whether the object is one of a collection's tiles or a
// block standing alone in the prose, which is the point: they are one object
// (`MediaNode`), so what a reader can do to it should not depend on which
// position it happens to occupy. Before this, a picture in a collection could
// be enlarged and had a shader behind it, and the identical picture in a block
// could do neither.
//
// The transport is a SIBLING of the button rather than `Media`'s own
// `transport`, and that is the whole reason this is a component and not a
// fragment: the tile is itself a control that opens the enlargement, and one
// control may not contain another. Laid over the same surface it takes its own
// press — the ~28px it costs the tile's hit area is the corner, not the
// picture. Holding the element it works is state, and state per tile means a
// component per tile.
// ---------------------------------------------------------------------------

export interface MediaTileClasses {
  /** The positioned box the ground fills and the transport pins to. */
  surface: string;
  /** The button around the picture. */
  tile: string;
  image: string;
  backgroundEffect: string;
}

export interface MediaTileProps {
  item: MediaNode;
  classes: MediaTileClasses;
  /** What to call the press when the object describes itself with nothing. */
  fallbackLabel: string;
  /**
   * Does this clip start itself? True where the object is the thing being
   * looked at; false for one of SEVERAL on a page — a collection shows up to
   * three tiles at once, and three loops running against each other is three
   * things competing for the same reader.
   */
  autoPlay?: boolean;
  onOpen: () => void;
  /** Anything else laid over the same surface — the collection's surplus badge. */
  children?: ReactNode;
  /** The surface's own hooks, spread onto the positioned box. */
  surfaceProps?: HTMLAttributes<HTMLDivElement> & {
    /** The state hooks a surface's own recipe keys on. */
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
  // Anything that is not a clip has nothing to play, so it is not held: an
  // <img> arrives here too, and the chip must not appear over a photograph.
  const holdClip = useCallback((node: HTMLElement | null) => {
    setClip(node instanceof HTMLVideoElement ? node : null);
  }, []);

  return (
    <div
      className={classes.surface}
      // The box the transport pins to, and reveals itself inside.
      data-media-surface=""
      {...surfaceProps}
    >
      {/* Sibling of the tile button, not a child of it: the gradient fills the
          SURFACE, and the tile is only the picture's hit target — in a
          collection's surplus cell that button is inset to a quadrant. */}
      {item.backgroundEffect && (
        <BackgroundEffectLayer
          effect={item.backgroundEffect}
          className={classes.backgroundEffect}
        />
      )}
      <button
        type="button"
        // The hook the surplus badge's quadrant layout keys on — the photo's
        // button leaves the flow so the grid positions nothing but the badge.
        data-media-tile=""
        className={classes.tile}
        aria-label={collectionItemAlt(item) || fallbackLabel}
        onClick={onOpen}
      >
        <Media
          src={item.src}
          kind={item.kind}
          alt={collectionItemAlt(item)}
          className={classes.image}
          // The same fit, inset and corner the editor previewed — the whole
          // reason both read it off the object rather than deciding locally.
          layout={item}
          // And the same shape, so the tile holds its box from the first paint
          // rather than opening under the reader when the file lands.
          width={item.width}
          height={item.height}
          loading="lazy"
          autoPlay={autoPlay}
          elementRef={holdClip}
        />
      </button>
      {children}
      <MediaTransport clip={clip} />
    </div>
  );
}
