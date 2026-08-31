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

// ---------------------------------------------------------------------------
// CollectionShowcase — the published collection.
//
// The whole grid is a client component rather than a server grid with a
// hydrating click layer: every tile is interactive, so splitting it would buy
// nothing and cost a second element tree. There is no SSR penalty — a client
// component is still server-rendered, so the <img> tags are in the initial HTML
// exactly as a plain figure's would be; only the handlers hydrate.
//
// The reader shows at most THREE tiles. Anything beyond that lives in the
// surplus badge and, from there, in the lightbox.
//
// What a tile IS — the ground behind it, the picture, the press that enlarges
// it, the clip's transport — is `MediaTile`, shared with the standalone media
// block (`MediaShowcase`). All this file adds is the arithmetic of a SET: how
// many tiles fit, which one is featured, and what the badge stands for.
// ---------------------------------------------------------------------------

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
          // The badge rides the LAST visible tile, and the two are siblings:
          // they open different images, and nesting one button in another is
          // not a thing the platform allows.
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
              // Slot 0 IS the featured position (see `featureItem`), and it is
              // the only clip in the grid that performs — three loops running
              // against each other is three things competing for one reader.
              autoPlay={index === 0}
              onOpen={() => setOpenIndex(index)}
              surfaceProps={{
                "data-surplus": carriesSurplus ? "" : undefined,
              }}
            >
              {carriesSurplus && (
                <button
                  type="button"
                  className={styles.surplus}
                  aria-label={`Show ${surplus} more image${surplus === 1 ? "" : "s"}`}
                  // The badge stands for items VISIBLE_TILES..n, so it opens
                  // the first one it is hiding.
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

      {/* Always mounted, opened by state — see the effect in MediaLightbox for
          why it cannot be conditionally rendered. */}
      <MediaLightbox
        items={items}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
