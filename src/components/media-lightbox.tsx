"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { Dialog } from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import {
  MEDIA_PADDING_REFERENCE,
  mediaContainerWidth,
  mediaHeightBudgetFactor,
  mediaInsetPx,
  mediaPictureShare,
  mediaRadiusPx,
  type MediaNode,
} from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";

// The reader's enlarged-image view.
//
// The size rule — "natural size, or 85vh/85vw, whichever is smaller" —
// needs no JavaScript branch on orientation. With both maxima in play
// and the natural width set inline, `width: auto` resolves to exactly
// min(natural, 85vw, 85vh × ratio): a tall image is caught by the
// height cap, a wide one by the width cap, and a small one by neither.
//
// An enlarged media object — clamped to its natural size or 85% of the
// viewport, whichever is smaller, with the object's caption beneath. Shared by
// a collection's tiles and a standalone media block, which enlarge the same
// object.
const lightboxPanelStyle = css({
  background: "transparent",
  border: "none",
  padding: "none",
  overflow: "visible",
  maxWidth: "none",
  maxHeight: "none",
  // A modal <dialog> is focusable, and this one holds focus on
  // ITSELF — it has no focusable children to hand off to, and it
  // needs the focus to receive the arrow keys. So the moment you
  // press one, `:focus-visible` matches and the UA paints its
  // default ring around a panel that is transparent and hugs the
  // photo, which reads as a border drawn on the image.
  //
  // globals.css's outline reset doesn't cover it: that list is
  // `a, button, input, select, textarea, summary, [tabindex]` and a
  // modal dialog is focusable without matching any of them. Every
  // other dialog in the app escapes this only because focus lands
  // on a child instead.
  //
  // Suppressing it costs no affordance — the dialog is a container,
  // not a control, so the ring marks nothing you could activate.
  focusVisibleRing: "none",
});

const lightboxFigureStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "md",
  margin: "none",
});

// Wraps the image so the gradient has a box to fill. It cannot fill
// the FIGURE — that column also holds the caption, and the ground
// would run out behind the text. `flex` (not block) so the wrapper
// shrink-wraps whatever size the image's own maxima resolve to.
// No corner of its own — the enlarged picture keeps the one it was
// authored with, like every other surface showing it. The clip
// stays: it is what holds the gradient to the picture's shape,
// since the ground fills this box exactly.
const lightboxFrameStyle = css({
  position: "relative",
  display: "flex",
  minWidth: 0,
  overflow: "hidden",
});

const lightboxBackgroundEffectStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  // The same card corner a collection cell draws, for the same
  // reason: this is the container the picture and its ground sit
  // in, and a container's corner is a constant of the design system
  // rather than a per-image property. The picture in front of it
  // wears its own, which grows with the enlargement (see
  // `mediaRadiusPx`) while this does not.
  borderRadius: "xl",
});

const lightboxImageStyle = css({
  display: "block",
  // BOTH auto, so the two maxima below scale the image on its own
  // aspect ratio instead of cropping or stretching its box. The
  // component narrows `maxWidth` to the natural width once the
  // image has loaded, which is the third term of the size rule.
  width: "auto",
  height: "auto",
  maxWidth: "85vw",
  // Leave the caption room to sit under the image without pushing
  // the pair past the viewport.
  maxHeight: "calc(85vh - token(spacing.4xl))",
  objectFit: "contain",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  // Above the gradient behind it — see the grid's `image` slot for
  // why a positioned sibling would otherwise win.
  position: "relative",
  zIndex: 1,
});

const lightboxCaptionStyle = css({
  // Never wider than the showcase block the picture was enlarged
  // FROM (960px): a picture may run to 85% of a wide screen, but
  // the words under it keep a prose measure. Below that width the
  // caption keeps the same 85vw margin the picture does.
  maxWidth: "min(85vw, token(sizes.articleShowcase))",
  textAlign: "center",
  // No `textWrap` here — `Typography`'s `caption` type balances
  // the lines from the utilities layer, which outranks this one,
  // so a value set here is dead (see `articleShowcase`'s note).
});

// ---------------------------------------------------------------------------
// MediaLightbox — a media object enlarged.
//
// Takes a LIST and an index into it, so a collection steps through its images
// and a standalone block hands in a list of one. Stepping wraps, which for a
// list of one is a no-op: there is no "only one image" branch, because the
// arithmetic already answers it.
// ---------------------------------------------------------------------------


export interface MediaLightboxProps {
  items: readonly MediaNode[];
  /** The open object, or `null` while the lightbox is dismissed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: MediaLightboxProps) {
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
      className={lightboxPanelStyle}
      onClose={onClose}
      onKeyDown={(event) => {
        if (index === null) return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        // Wraps: it's a gallery, and stopping dead at the ends would make the
        // last image feel like an error rather than the end of a loop. A
        // gallery of ONE wraps onto itself, which is the standalone block's
        // whole answer to the arrow keys — nothing to special-case.
        onIndexChange((index + step + items.length) % items.length);
      }}
    >
      {/* Nothing to paint while dismissed — the element stays in the DOM only
          so its open state can be driven rather than remounted. */}
      {item && index !== null && (
        <figure className={lightboxFigureStyle}>
          {/* The frame shrink-wraps the image so the gradient has a box to
              fill. It cannot fill the figure — that column also holds the
              caption, and the ground would run on behind the text.

              `data-media-surface` marks it as the box a clip's transport pins
              to and reveals itself inside; see the `mediaTransport` recipe. */}
          <div data-media-surface="" className={lightboxFrameStyle}>
          {/* The card behind the picture, and it wears the card's corner from
              its own class — a constant, like the collection cell's. The
              picture in front of it wears its own. */}
          {item.backgroundEffect && (
            <BackgroundEffectLayer
              effect={item.backgroundEffect}
              className={lightboxBackgroundEffectStyle}
            />
          )}
          <Media
            // Keyed so stepping swaps the element rather than mutating one —
            // otherwise the browser would paint the old bitmap at the new box
            // until the next decode. For a clip it is what stops the next one
            // inheriting the last one's playhead.
            key={index}
            src={item.src}
            kind={item.kind}
            alt={collectionItemAlt(item)}
            className={lightboxImageStyle}
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
            // No `layout`, uniquely among the surfaces that show this object: it
            // is expressed in SHARES of the box a picture is given, and this is
            // the one surface with no such box to share out — the frame around
            // this image is sized BY the image. A percentage inset and a `cqw`
            // corner both resolve against something indefinite here, and the
            // whole column collapses to a pixel around a picture that then has
            // nothing to show. (It did exactly that for every inset picture
            // until this was written.)
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
              className={lightboxCaptionStyle}
            >
              {item.caption}
            </Typography>
          )}
        </figure>
      )}
    </Dialog>
  );
}
