"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEventHandler,
} from "react";
import { MediaTransport } from "@/components/media-transport";
import {
  mediaBoxStyle,
  mediaFrameStyle,
  mediaObjectStyle,
  mediaReservationStyle,
  type MediaKind,
  type MediaLayout,
} from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Media — one source, shown with whichever element can show it.
//
// The library takes clips as well as pictures, and every place that renders one
// — the editor's collection cell, the reader's tile, the lightbox, the
// standalone block, the library's own preview — faces the same fork. It is
// settled here, once, so that no two surfaces answer it differently.
//
// Settled, not GUESSED. This component used to read the answer back off the
// filename, because the document did not record it; now `kind` is required and
// is the only thing consulted. Every caller has the answer first-hand: a
// document node states it (`MediaNodeSchema`, backfilled on the way in by
// `withMediaKind`), and the media library's preview holds an upload whose
// `contentType` was validated before it was ever stored. An optional prop with
// an extension fallback behind it would leave exactly one way for a clip under
// a bare R2 key to render as a broken picture — a caller that forgot — so
// there is no fallback to forget into.
//
// The two elements are interchangeable on purpose: same className, same box,
// same `object-fit`, and one `onMeasure` in place of the `naturalWidth` an
// <img> reports and the `videoWidth` a <video> does. A caller that already
// styled a picture needs to know nothing about the fork to keep working.
//
// A clip plays ITSELF: muted, looping, inline, no controls unless asked. That
// is the behaviour a portfolio wants of a product demo — the same as the
// animated GIFs the library already accepted, at a fraction of the bytes — and
// it is what makes a collection of clips read as a collection rather than as a
// wall of play buttons.
//
// There are two ways to ask, and which one a surface wants follows from what it
// is for. `controls` is the browser's full strip, for the places a clip is READ
// rather than looked at — the standalone block in an article, the library's
// preview pane, where you scrub what you are about to insert. `transport` is
// one play/pause chip in the surface's corner, for the place a clip is enlarged
// to be LOOKED at: the strip would lie across the picture the lightbox exists
// to show, and a loop nobody can stop is no better. A tile gets neither — it is
// a hit target for the lightbox, and anything laid over it eats the click.
// ---------------------------------------------------------------------------

/**
 * How far into a held clip to seek for a frame to show. Small enough to be the
 * opening image and large enough that browsers treat it as a real seek.
 */
const FIRST_FRAME_SEEK_S = 0.05;

export interface MediaProps {
  src: string;
  /** Describes the source. Empty means decorative, as it does on an `<img>`. */
  alt: string;
  /**
   * Which element to render with — a picture or a clip.
   *
   * Required, and deliberately so: the src is not consulted at all. Whoever
   * renders media here holds either a node that states its kind or an upload
   * whose content type does, so there is no caller left that would have to
   * guess, and no default quietly waiting to be wrong about one.
   */
  kind: MediaKind;
  className?: string;
  style?: CSSProperties;
  /**
   * How the picture sits in its box — its fit, its inset, its corner (the
   * properties panel's top section). Handed here rather than applied by each
   * caller because it takes TWO elements: a frame that carries the inset and
   * the object that carries the fit and the corner. See `mediaFrameStyle` for
   * why they cannot be the same element.
   *
   * Costs an untouched picture nothing — the frame collapses to
   * `display: contents` when there is no layout to apply.
   */
  layout?: MediaLayout;
  /**
   * The source's own pixel size, when the document recorded it — the shape the
   * box is HELD at until the source can size itself (`mediaReservedAspect`).
   *
   * Only the ratio is read; neither number is ever rendered as a length. A
   * caller that has no record passes nothing and the reserved box takes the
   * house ratio, which is what every document written before these fields
   * existed does.
   */
  width?: number;
  height?: number;
  draggable?: boolean;
  /** Pictures only — a clip decides its own fetching through `preload`. */
  loading?: "lazy" | "eager";
  /** Clips only — the browser's own strip, where the clip is read rather than
   * glanced at. Independent of `transport` below, which is the house control. */
  controls?: boolean;
  /**
   * Clips only — the house transport: ONE play/pause chip in the bottom-right
   * corner of the surface, instead of the browser's strip across the foot of
   * the picture. For the places a clip is enlarged to be LOOKED at, where the
   * strip would cover the very thing the surface exists to show but a loop the
   * visitor cannot stop is its own kind of rude.
   *
   * The chip is absolute, and it positions against the surface's own box (see
   * the `mediaTransport` recipe) — nothing is added to the media's layout, so a
   * caller turns this on without anything moving. That box has to be POSITIONED,
   * which every surface holding a media object already is.
   */
  transport?: boolean;
  /**
   * Clips only — does this one start itself? True everywhere a clip is the
   * thing being looked at. False for a clip that is one of SEVERAL on a page:
   * a collection shows up to three tiles at once, and three loops running
   * against each other is three things competing for the same reader, so only
   * the featured slot performs and the rest hold their first frame.
   *
   * Withheld, not stopped: the clip is never asked to play, rather than played
   * and paused, so nothing flickers and the transport can start it on request.
   */
  autoPlay?: boolean;
  /** The checkerboard hook; see the `collectionGrid` recipe's `image` slot. */
  "data-checkered"?: string;
  /**
   * The surface's own interaction contract, handed through untouched to
   * whichever element the fork produced.
   *
   * The list is here for one caller and one reason: the editor's media block is
   * FOCUSABLE. Its figure holds no caret, so the media element itself is the
   * tab stop — it is what the Change Image / Delete overlay keys off, what the
   * caret keys are read from, and what `focusBlockAtStart` reaches by querying
   * `[data-showcase-media]` and calling `.focus()` on whatever answers. All of
   * that has to sit on the element that actually ends up in the document, and
   * that element is now this component's to decide rather than the caller's.
   *
   * Hanging the contract on a box AROUND the media was the obvious alternative
   * and is the wrong shape twice over: the tab stop becomes the box, so a clip
   * stops being the thing that takes focus; and the two sibling branches that
   * already carry this same contract put it on the object itself — the
   * collection's grid root, the component block's demo frame. A pass-through is
   * what keeps all three saying one thing.
   *
   * The bargain is `data-checkered`'s, one prop up: this component owns which
   * element exists, so it must own the hooks that have to be ON that element.
   * It does not own what they mean, so it reads none of them.
   */
  tabIndex?: number;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  /** The editor's block-focus hook; see `tabIndex` above. */
  "data-showcase-media"?: string;
  /**
   * The source's intrinsic size once it is known — `naturalWidth`/`Height` for
   * a picture, `videoWidth`/`Height` for a clip. One question, so one callback.
   *
   * Both dimensions, because the caller fitting an enlargement to the screen
   * needs the picture's SHAPE: the band around it comes out of the box's width
   * on all four sides, so how much of the HEIGHT it eats depends on how wide
   * the picture is (`mediaHeightBudgetFactor`).
   */
  onMeasure?: (width: number, height: number) => void;
  /**
   * The element itself, for the caller that has to MEASURE what it came out at
   * — a question `onMeasure` cannot answer, since the intrinsic width is what
   * the file is rather than what the screen gave it. The lightbox needs it to
   * work back from the picture to the box it implies (`mediaContainerWidth`).
   *
   * A CALLBACK, so the caller can hold the element in state: both callers need
   * to re-render when it arrives (the lightbox to measure it, a tile to hand it
   * to the transport laid over the cell), and a ref object changing is not a
   * render. Must be stable — a `useState` setter or a `useCallback` — or the
   * element is torn down and stood back up on every render, and for a clip
   * that means losing its playhead.
   */
  elementRef?: (node: HTMLElement | null) => void;
}

/**
 * Has this element already got something on screen?
 *
 * The two elements answer it differently and neither answers it with an event
 * once the moment has passed — which is exactly the case a reserved box has to
 * survive: a cached picture and a hydrating clip both arrive done.
 */
function hasSomethingToShow(
  node: HTMLElement | null,
): node is HTMLImageElement | HTMLVideoElement {
  if (node instanceof HTMLImageElement) {
    return node.complete && node.naturalWidth > 0;
  }
  if (node instanceof HTMLVideoElement) {
    return node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }
  return false;
}

export function Media({
  src,
  alt,
  kind,
  className,
  style,
  layout,
  width,
  height,
  draggable,
  loading = "lazy",
  controls,
  transport,
  autoPlay = true,
  onMeasure,
  elementRef,
  tabIndex,
  onFocus,
  onBlur,
  onKeyDown,
  "data-checkered": checkered,
  "data-showcase-media": showcaseMedia,
}: MediaProps) {
  // The element itself, held as STATE rather than in a ref, because the
  // transport has to re-render when it arrives — and arrive again it does: the
  // lightbox keys its clip by index, so stepping to the next one mounts a
  // fresh element that the chip has to pick up.
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);

  // Which source has actually PAINTED — the src itself rather than a boolean,
  // so that swapping the source takes the reserved box back with no effect to
  // reset it. The lightbox steps between pictures on one element, and a box the
  // last one released is not a box the next one has earned.
  const [paintedSrc, setPaintedSrc] = useState<string | null>(null);
  const pending = paintedSrc !== src;
  // Settled by the PROP, never by the element's `currentSrc` — the browser
  // resolves that to an absolute URL, and this value has to compare equal to
  // the src the next render brings.
  const settle = useCallback(() => setPaintedSrc(src), [src]);

  // The caller's ref, which takes whichever element this turned out to be.
  //
  // It also settles a source that had ALREADY painted by the time the element
  // reached us, which no event will ever announce: a cached picture is
  // `complete` before React hears a `load`, and a hydrating one has usually
  // decoded before hydration gets to it. Without this the box stays reserved
  // and the shimmer runs under a picture that is plainly there.
  //
  // The src comes off the ATTRIBUTE rather than the prop so that this callback
  // owes nothing to the current render. Its identity must not change — a ref
  // callback that changes is a ref callback React re-runs, and the clip's
  // branch below re-runs `play()` when it does — and the attribute is the prop
  // in any case, unresolved, which is what `paintedSrc` compares against.
  const hold = useCallback(
    (node: HTMLElement | null) => {
      if (hasSomethingToShow(node)) setPaintedSrc(node.getAttribute("src"));
      elementRef?.(node);
    },
    [elementRef],
  );

  // Read through a ref so that changing it later never re-runs the ref callback
  // below — that would tear the element down and stand it back up, which for a
  // clip means losing its playhead. Only the value at MOUNT decides anything,
  // and that one is the initializer's; later ones are written after render, so
  // nothing here reads a ref while rendering.
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  /**
   * Everything about a clip that cannot be said in markup.
   *
   * `muted` is the load-bearing one. React sets it as a PROPERTY and never
   * renders the attribute, so a server-rendered clip reaches the browser
   * un-muted, the autoplay policy declines it, and hydration setting the
   * property afterwards does not make the browser reconsider. Stating both —
   * and then asking for the play ourselves — is what actually starts it.
   *
   * `prefers-reduced-motion` is honoured here rather than in CSS because CSS
   * cannot stop a video: the clip is left on its first frame, which is what a
   * poster would have been, and the two places that offer controls can still
   * play it deliberately.
   */
  const startPlaying = useCallback((node: HTMLVideoElement | null) => {
    setClip(node);
    hold(node);
    if (!node) return;
    node.muted = true;
    node.setAttribute("muted", "");

    if (!autoPlayRef.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      node.pause();
      return;
    }
    // Rejects whenever the browser declines — a policy, a background tab — and
    // returns nothing at all outside a browser. Either way the clip simply
    // stays on its first frame; there is nothing to recover.
    void node.play()?.catch(() => {});
  }, [hold]);

  // The caller's own style still wins — the lightbox's natural-size cap is a
  // constraint on the picture, not a layout property, so it is applied last.
  //
  // The reservation sits between the two, and only while the source has
  // nothing to paint: it OVERRIDES the layout (a `contain` picture's
  // sized-to-content width has nothing to size itself from yet) and is
  // overridden by the caller, whose caps are constraints on a picture that will
  // arrive rather than a shape for the box waiting on it.
  const objectStyle = {
    ...(layout ? mediaObjectStyle(layout) : {}),
    ...(pending ? mediaReservationStyle({ width, height }, layout) : {}),
    ...style,
  };

  const isClip = kind === "video";

  const element = !isClip ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={hold}
      src={src}
      alt={alt}
      className={className}
      style={objectStyle}
      draggable={draggable}
      loading={loading}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-checkered={checkered}
      data-showcase-media={showcaseMedia}
      // The hook the shimmer keys on, and the box's own answer to "is there
      // anything here yet" — see the global rule for `[data-media-pending]`.
      data-media-pending={pending ? "" : undefined}
      onLoad={(event) => {
        settle();
        onMeasure?.(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight,
        );
      }}
      // A source that will never arrive is a FINISHED state, not a pending
      // one: a broken picture under a shimmer that never stops is worse than
      // the broken picture on its own.
      onError={settle}
    />
  ) : (
    <video
      ref={startPlaying}
      src={src}
      // A <video> has no `alt`. An empty one is left OFF rather than set to the
      // empty string: in the grid and the lightbox the surrounding button
      // already carries the name, and an `aria-label=""` is not a way to say
      // "decorative" — it is an element with a broken label.
      aria-label={alt || undefined}
      className={className}
      style={objectStyle}
      draggable={draggable}
      controls={controls}
      autoPlay={autoPlay}
      loop
      muted
      playsInline
      preload="metadata"
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-checkered={checkered}
      data-showcase-media={showcaseMedia}
      data-media-pending={pending ? "" : undefined}
      // `loadeddata`, not `loadedmetadata`: metadata answers how big the clip
      // is, and a <video> with no frame decoded still paints nothing at all.
      // The box is held until there is something to put in it.
      onLoadedData={settle}
      onError={settle}
      onLoadedMetadata={(event) => {
        const node = event.currentTarget;
        onMeasure?.(node.videoWidth, node.videoHeight);
        // A HELD clip has to be given something to show. `preload="metadata"`
        // fetches the header and no frames, and a video element with no frame
        // decoded paints nothing at all — so a tile that is not playing comes
        // up as an empty box where the picture should be. Seeking a hair past
        // the start is what asks for that first frame; it is the poster a clip
        // does not have, and it costs one frame of data.
        if (!autoPlayRef.current && node.currentTime === 0) {
          node.currentTime = Math.min(FIRST_FRAME_SEEK_S, node.duration || 0);
        }
      }}
    />
  );

  // Two boxes, and the split is not decorative. The OUTER is the query
  // container the corner is a share of, so it must span the full width — which
  // is why the inset lives on the INNER one: query units resolve against a
  // container's content box, so padding out here would measure the corner
  // against the already-inset width.
  //
  // Both collapse to `display: contents` when there is nothing to apply, so an
  // untouched picture keeps exactly the box it had before this existed, and
  // turning padding on never restructures the tree.
  const media = !layout ? (
    element
  ) : (
    <span data-media-frame="" style={mediaFrameStyle(layout)}>
      <span data-media-box="" style={mediaBoxStyle(layout)}>
        {element}
      </span>
    </span>
  );

  // A picture has nothing to play, so asking for a transport over one is a
  // no-op rather than a dead button.
  if (!transport || !isClip) return media;

  // A SIBLING of the media, never a box around it — the chip is out of flow and
  // pins itself to the surface's own corner, which is what lets this be turned
  // on without a pixel of the picture moving. The same arrangement the demo
  // frame's controls have with the demo they belong to.
  //
  // A surface that cannot have the chip HERE — the collection tile, whose media
  // sits inside the button that opens the lightbox — takes the element instead
  // and renders `MediaTransport` itself.
  return (
    <>
      {media}
      <MediaTransport clip={clip} />
    </>
  );
}
