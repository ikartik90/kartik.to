"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collectionGrid,
  collectionLightbox,
} from "../../styled-system/recipes";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { MediaTransport } from "@/components/media-transport";
import { Dialog } from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import {
  MEDIA_PADDING_REFERENCE,
  mediaContainerWidth,
  mediaHeightBudgetFactor,
  mediaInsetPx,
  mediaPictureShare,
  mediaRadiusPx,
  type CollectionItem,
} from "@/domain/nodes";
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
            <CollectionTile
              key={`${index}-${item.src}`}
              item={item}
              index={index}
              styles={styles}
              // Slot 0 IS the featured position (see `featureItem`), and it is
              // the only clip in the grid that performs — three loops running
              // against each other is three things competing for one reader.
              featured={index === 0}
              surplus={carriesSurplus ? surplus : 0}
              onOpen={setOpenIndex}
            />
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
// Tile
// ---------------------------------------------------------------------------

interface CollectionTileProps {
  item: CollectionItem;
  index: number;
  styles: ReturnType<typeof collectionGrid>;
  /** Slot 0 — the one clip in the grid that plays itself. */
  featured: boolean;
  /** How many images this tile's badge stands for; 0 for no badge. */
  surplus: number;
  onOpen: (index: number) => void;
}

/**
 * One cell of the reader's grid: the photo's button, the ground behind it, the
 * surplus badge where there is one — and, for a clip, its transport.
 *
 * A component of its own for the sake of that last one. The chip has to hold
 * the ELEMENT it works, which is state, and state per tile means a component
 * per tile; inlining it would put one clip's element in a hook shared by three.
 */
function CollectionTile({
  item,
  index,
  styles,
  featured,
  surplus,
  onOpen,
}: CollectionTileProps) {
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);
  // Anything that is not a clip has nothing to play, so it is not held: an
  // <img> arrives here too, and the chip must not appear over a photograph.
  const holdClip = useCallback((node: HTMLElement | null) => {
    setClip(node instanceof HTMLVideoElement ? node : null);
  }, []);

  return (
    <div
      className={styles.cell}
      data-surplus={surplus > 0 ? "" : undefined}
      // The box the transport pins to, and reveals itself inside.
      data-media-surface=""
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
        onClick={() => onOpen(index)}
      >
        <Media
          src={item.src}
          alt={collectionItemAlt(item)}
          className={styles.image}
          // The same fit and inset the editor previewed — the whole
          // reason both read it off the item rather than deciding
          // locally.
          layout={item}
          loading="lazy"
          autoPlay={featured}
          elementRef={holdClip}
        />
      </button>
      {surplus > 0 && (
        <button
          type="button"
          className={styles.surplus}
          aria-label={`Show ${surplus} more image${surplus === 1 ? "" : "s"}`}
          // The badge stands for items VISIBLE_TILES..n, so it opens
          // the first one it is hiding.
          onClick={() => onOpen(VISIBLE_TILES)}
        >
          <CollectionIcon aria-hidden />
          <span className={styles.surplusDivider} aria-hidden />
          <span className={styles.surplusLabel}>
            +{surplus} Image{surplus === 1 ? "" : "s"}
          </span>
        </button>
      )}
      {/* OUTSIDE the tile's button, and that is the whole reason this is not
          `Media`'s own `transport`: the tile is itself a control that opens the
          lightbox, and one may not contain another. As a sibling laid over the
          same cell it takes its own press — the ~28px it costs the tile's hit
          area is the corner, not the picture. */}
      <MediaTransport clip={clip} />
    </div>
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
    height: number;
  } | null>(null);
  const intrinsic = measured?.index === index ? measured : null;
  const intrinsicWidth = intrinsic?.width ?? null;
  const item = index === null ? null : items[index];

  // The box the enlargement is composed in — which is what BOTH the corner and
  // the inset are shares of, and the one thing this surface does not know.
  //
  // Every other surface hands that arithmetic to CSS: the box is a query
  // container, the corner a `cqw` of it and the inset a percentage. Here it
  // cannot be — a container may not take its inline size from its contents, and
  // this frame is sized BY the picture — so the box is measured instead.
  // Without it both properties stayed the numbers they were authored as, and a
  // picture enlarged to fill a wide screen read progressively sharper and more
  // tightly banded the bigger it got, against a tile that keeps its composition
  // at every size.
  //
  // The PICTURE is what is observed, and the box is worked back from it
  // (`mediaContainerWidth`). Measuring the frame instead would be measuring the
  // picture PLUS the very band being derived from it — a value feeding its own
  // next input, settling over several frames of visibly growing picture. The
  // picture's own width owes the band nothing, so one measurement is final.
  //
  // Stamped with its image like `measured` above, and for the same reason: a
  // portrait must not spend a frame wearing the box a landscape's picture
  // earned. Stepping falls back to the authored numbers until the observer
  // reports the new picture, which is one frame later at most.
  const [picture, setPicture] = useState<HTMLElement | null>(null);
  const [framed, setFramed] = useState<{ index: number; width: number } | null>(
    null,
  );
  useEffect(() => {
    // Absent on the server and in jsdom, where nothing is laid out anyway —
    // both properties then stay the authored pixels, exactly as they were.
    if (index === null || !picture || typeof ResizeObserver !== "function")
      return;
    const observer = new ResizeObserver(([entry]) =>
      setFramed({
        index,
        width: mediaContainerWidth(items[index], entry.contentRect.width),
      }),
    );
    // Observing reports the box straight away, so opening measures without
    // waiting for anything to change size.
    observer.observe(picture);
    return () => observer.disconnect();
    // The element is STATE rather than a ref, so this runs when it actually
    // arrives instead of assuming it already has.
  }, [index, items, picture]);
  const boxWidth = framed?.index === index ? framed.width : null;
  const corner = item
    ? mediaRadiusPx(item, boxWidth ?? MEDIA_PADDING_REFERENCE)
    : 0;
  const inset = item
    ? mediaInsetPx(item, boxWidth ?? MEDIA_PADDING_REFERENCE)
    : 0;
  const share = item ? mediaPictureShare(item) : 1;
  // What the PICTURE may take of the viewport — its share of what the whole
  // composition may, which is the same 85vw until there is a band to fit
  // inside it too.
  const widthCap = share === 1 ? "85vw" : `calc(85vw * ${share})`;
  // The height budget answers the same question on the other axis, but not with
  // the same number: both bands come out of the box's WIDTH, so how much of the
  // height they eat depends on the picture's shape (`mediaHeightBudgetFactor`).
  // The shape is the FILE's, so this stays a constant — a cap derived from what
  // the screen gave the picture would be a cap chasing its own effect.
  const heightFactor = item
    ? mediaHeightBudgetFactor(
        item,
        intrinsic?.height ? intrinsic.width / intrinsic.height : 1,
      )
    : 1;

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
              caption, and the ground would run on behind the text.

              `data-media-surface` marks it as the box a clip's transport pins
              to and reveals itself inside; see the `mediaTransport` recipe. */}
          <div data-media-surface="" className={lightboxStyles.frame}>
          {/* The card behind the picture, and it wears the card's corner from
              its own class — a constant, like the collection cell's. The
              picture in front of it wears its own. */}
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
            // A clip gets ONE control here rather than the browser's strip: the
            // strip would lie across the foot of the very picture this surface
            // exists to show, while a chip in the corner leaves the enlargement
            // whole and still lets a reader stop the loop. It pins itself to
            // the frame above — which is why the frame is `position: relative`.
            // Scrubbing belongs to the standalone block, where a clip is read
            // rather than looked at.
            transport
            //
            // The whole size rule is min(natural, 85vw, 85vh) — and it lands as
            // three MAX constraints, never a fixed width. With `width`/`height`
            // both auto, a replaced element under two maxima scales down on its
            // own aspect ratio, so whichever cap binds first is the one that
            // wins and no portrait/landscape branch is needed. Pinning `width`
            // instead would let the height cap shrink the BOX while the image
            // letterboxed inside it — a tall photo in a too-wide frame.
            //
            // No `layout`, uniquely among the four surfaces: it is expressed in
            // SHARES of the box a picture is given, and this is the one surface
            // with no such box to share out — the frame around this image is
            // sized BY the image. A percentage inset and a `cqw` corner both
            // resolve against something indefinite here, and the whole column
            // collapses to a pixel around a picture that then has nothing to
            // show. (It did exactly that for every inset picture until this
            // was written.)
            //
            // So both arrive as pixels — and both are still SHARES, of the box
            // measured back from the picture above (see `boxWidth`). A corner
            // and a band that stayed the numbers they were authored at would
            // make an enlargement a different composition from the tile it was
            // composed in: sharper at the corners and more tightly banded the
            // bigger it got. `objectFit` is inert here by construction — width
            // and height are both auto, so there is no box to cover or fit
            // inside and the picture is always shown whole.
            //
            // The inset is a MARGIN rather than a padding, so that the ground
            // behind it still fills the whole card: the gradient is positioned
            // `inset: 0`, which resolves against the frame's PADDING box, and a
            // padded frame would hold the gradient back to exactly the picture
            // it is supposed to be spreading out from under.
            //
            // The two viewport caps are the picture's share of what the whole
            // COMPOSITION may take (`mediaPictureShare`), not the whole of it:
            // capping the picture at 85vw and then hanging a band off each side
            // composes something wider than the screen. Taken as a constant
            // rather than off the measurement, so a cap that binds cannot feed
            // the band that feeds the cap.
            style={{
              margin: inset,
              borderRadius: corner,
              ...(intrinsicWidth ? { maxWidth: `min(${intrinsicWidth}px, ${widthCap})` } : {}),
              // Only when there is a band to make room for. A picture with no
              // inset IS the whole composition, so it keeps the caps its class
              // already states and nothing is written over them.
              ...(share === 1
                ? {}
                : {
                    ...(intrinsicWidth ? {} : { maxWidth: widthCap }),
                    maxHeight: `calc((85vh - var(--spacing-4xl)) / ${heightFactor})`,
                  }),
            }}
            elementRef={setPicture}
            onMeasure={(width, height) => setMeasured({ index, width, height })}
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
