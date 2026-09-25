"use client";

import { useMemo, useState } from "react";
import { mediaBlock } from "../../styled-system/recipes";
import { MediaLightbox } from "@/components/media-lightbox";
import { MediaTile } from "@/components/media-tile";
import type { MediaNode } from "@/domain/nodes";

const styles = mediaBlock();

export interface MediaShowcaseProps {
  item: MediaNode;
}

export function MediaShowcase({ item }: MediaShowcaseProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Memoized: a new array restarts the lightbox's measurement.
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
