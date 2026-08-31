"use client";

import { useMemo, useState } from "react";
import { mediaBlock } from "../../styled-system/recipes";
import { MediaLightbox } from "@/components/media-lightbox";
import { MediaTile } from "@/components/media-tile";
import type { MediaNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// MediaShowcase — the published media block: one object, and its enlargement.
//
// `CollectionShowcase` with a list of one, near enough — and deliberately built
// out of the same two pieces, so a picture that can be enlarged and given a
// shader ground in a collection can be enlarged and given one standing alone.
// The lightbox takes a LIST, so the block hands it a list of one and the arrow
// keys wrap onto that one object with nothing to special-case.
//
// A client component, where the rest of the article's blocks are server-
// rendered: the press has to be handled somewhere. That costs nothing at the
// wire — a client component is still server-rendered, so the <img> is in the
// initial HTML exactly as a plain figure's would be; only the handler hydrates.
// ---------------------------------------------------------------------------

const styles = mediaBlock();

export interface MediaShowcaseProps {
  item: MediaNode;
}

export function MediaShowcase({ item }: MediaShowcaseProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // The lightbox observes this list, so a fresh array on every render would
  // restart its measurement each time.
  const items = useMemo(() => [item], [item]);

  return (
    <>
      <MediaTile
        item={item}
        classes={{
          surface: styles.frame,
          tile: styles.tile,
          image: styles.image,
          backgroundEffect: styles.backgroundEffect,
        }}
        fallbackLabel="Image"
        onOpen={() => setOpenIndex(0)}
      />
      <MediaLightbox
        items={items}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
