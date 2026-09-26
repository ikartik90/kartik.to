"use client";

import { useState } from "react";
import { collectionGrid } from "../../styled-system/recipes";
import { MediaLightbox } from "@/components/media-lightbox";
import { MediaTile } from "@/components/media-tile";
import { type CollectionItem } from "@/domain/nodes";
import {
  collectionLayout,
  collectionSurplusCount,
} from "@/utils/collection-items";
import CollectionIcon from "@/assets/icons/collection.svg";

const VISIBLE_TILES = 3;

export interface CollectionShowcaseProps {
  items: CollectionItem[];
}

export function CollectionShowcase({ items }: CollectionShowcaseProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const layout = collectionLayout(items.length, "reader");
  const styles = collectionGrid({ layout });
  const visible = items.slice(0, VISIBLE_TILES);
  const surplus = collectionSurplusCount(items.length);

  return (
    <>
      <div className={styles.root}>
        {visible.map((item, index) => {
          // Siblings, not nested: a button cannot hold another button.
          const carriesSurplus = surplus > 0 && index === VISIBLE_TILES - 1;
          return (
            <MediaTile
              key={`${index}-${item.src}`}
              item={item}
              classes={{
                surface: styles.cell,
                tile: styles.tile,
                image: styles.image,
                backgroundEffect: styles.backgroundEffect,
              }}
              fallbackLabel={`Image ${index + 1}`}
              autoPlay={index === 0}
              onOpen={() => setOpenIndex(index)}
              // The badge takes the end corner.
              transportCorner={carriesSurplus ? "start" : undefined}
              surfaceProps={{
                "data-surplus": carriesSurplus ? "" : undefined,
              }}
            >
              {carriesSurplus && (
                <button
                  type="button"
                  className={styles.surplus}
                  aria-label={`Show ${surplus} more image${surplus === 1 ? "" : "s"}`}
                  onClick={() => setOpenIndex(VISIBLE_TILES)}
                >
                  <CollectionIcon aria-hidden />
                  <span className={styles.surplusDivider} aria-hidden />
                  <span className={styles.surplusLabel}>
                    +{surplus} Image{surplus === 1 ? "" : "s"}
                  </span>
                </button>
              )}
            </MediaTile>
          );
        })}
      </div>

      {/* Must stay mounted; see the effect in MediaLightbox. */}
      <MediaLightbox
        items={items}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
