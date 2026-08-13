"use client";

import { useEffect, useRef, useState } from "react";
import {
  collectionGrid,
  collectionLightbox,
} from "../../styled-system/recipes";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { Dialog } from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import type { CollectionItem } from "@/domain/nodes";
import {
  collectionItemAlt,
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
            <div
              key={`${index}-${item.src}`}
              className={styles.cell}
              data-surplus={carriesSurplus ? "" : undefined}
            >
              {/* Sibling of the tile button, not a child of it: the gradient
                  fills the CELL, and the tile is only the photo's hit target —
                  in a surplus cell that button is inset to a quadrant. */}
              {item.backgroundEffect && (
                <BackgroundEffectLayer
                  effect={item.backgroundEffect}
                  className={styles.backgroundEffect}
                />
              )}
              <button
                type="button"
                data-collection-tile=""
                className={styles.tile}
                aria-label={collectionItemAlt(item) || `Image ${index + 1}`}
                onClick={() => setOpenIndex(index)}
              >
                {/* No transport on a tile: the button around it opens the
                    lightbox, and a control strip laid over a 300px thumbnail
                    would swallow the gesture the tile exists for. */}
                <Media
                  src={item.src}
                  alt={collectionItemAlt(item)}
                  className={styles.image}
                  loading="lazy"
                />
              </button>
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
            </div>
          );
        })}
      </div>

      {/* Always mounted, opened by state — see the effect in CollectionLightbox
          for why it cannot be conditionally rendered. */}
      <CollectionLightbox
        items={items}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

const lightboxStyles = collectionLightbox();

interface CollectionLightboxProps {
  items: CollectionItem[];
  /** The open image, or `null` while the lightbox is dismissed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function CollectionLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: CollectionLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Stamped with the image it was measured from, so stepping to another one
  // discards it by derivation — a portrait never inherits the box a landscape
  // just left behind, and no effect is needed to clear it.
  const [measured, setMeasured] = useState<{
    index: number;
    width: number;
  } | null>(null);
  const intrinsicWidth = measured?.index === index ? measured.width : null;
  const item = index === null ? null : items[index];

  // `showModal` (not the `open` attribute) is what buys the focus trap, the
  // inert background, the ::backdrop and — on close — focus returning to the
  // tile that opened this.
  //
  // This element must stay MOUNTED and be driven by `index`, never rendered
  // conditionally with a cleanup that closes it. `Dialog` maps `onClose` to the
  // native `close` EVENT, so a cleanup calling `close()` reports a user
  // dismissal — and because React runs every effect twice in development, the
  // lightbox would open, tear down, dismiss itself and unmount before the
  // second pass could reopen it. Both branches are guarded, so re-running this
  // effect is a no-op rather than a throw.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    else if (index === null && dialog.open) dialog.close();
  }, [index]);

  return (
    <Dialog
      ref={dialogRef}
      align="center"
      justify="center"
      aria-label={
        item ? collectionItemAlt(item) || `Image ${index! + 1}` : "Image viewer"
      }
      className={lightboxStyles.panel}
      onClose={onClose}
      onKeyDown={(event) => {
        if (index === null) return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        // Wraps: it's a gallery, and stopping dead at the ends would make the
        // last image feel like an error rather than the end of a loop.
        onIndexChange((index + step + items.length) % items.length);
      }}
    >
      {/* Nothing to paint while dismissed — the element stays in the DOM only
          so its open state can be driven rather than remounted. */}
      {item && index !== null && (
        <figure className={lightboxStyles.figure}>
          {/* The frame shrink-wraps the image so the gradient has a box to
              fill. It cannot fill the figure — that column also holds the
              caption, and the ground would run on behind the text. */}
          <div className={lightboxStyles.frame}>
          {item.backgroundEffect && (
            <BackgroundEffectLayer
              effect={item.backgroundEffect}
              className={lightboxStyles.backgroundEffect}
            />
          )}
          <Media
            // Keyed so stepping swaps the element rather than mutating one —
            // otherwise the browser would paint the old bitmap at the new box
            // until the next decode. For a clip it is what stops the next one
            // inheriting the last one's playhead.
            key={index}
            src={item.src}
            alt={collectionItemAlt(item)}
            className={lightboxStyles.image}
            // One image at full size, alone on a dimmed page — the one place
            // in the reader where a clip is the subject rather than a tile.
            controls
            // The whole size rule is min(natural, 85vw, 85vh) — and it lands as
            // three MAX constraints, never a fixed width. With `width`/`height`
            // both auto, a replaced element under two maxima scales down on its
            // own aspect ratio, so whichever cap binds first is the one that
            // wins and no portrait/landscape branch is needed. Pinning `width`
            // instead would let the height cap shrink the BOX while the image
            // letterboxed inside it — a tall photo in a too-wide frame.
            style={
              intrinsicWidth
                ? { maxWidth: `min(${intrinsicWidth}px, 85vw)` }
                : undefined
            }
            onMeasure={(width) => setMeasured({ index, width })}
          />
          </div>
          {item.caption && (
            <Typography
              tag="figcaption"
              type="caption"
              className={lightboxStyles.caption}
            >
              {item.caption}
            </Typography>
          )}
        </figure>
      )}
    </Dialog>
  );
}
