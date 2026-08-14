"use client";

import { useCallback, type CSSProperties } from "react";
import { isVideoSource } from "@/utils/media-source";
import {
  mediaBoxStyle,
  mediaFrameStyle,
  mediaObjectStyle,
  type MediaLayout,
} from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Media — one source, shown with whichever element can show it.
//
// The library takes clips as well as pictures, and a document records both the
// same way: an `src` and an `alt` (see `ImageNodeSchema`). So every place that
// renders one — the editor's collection cell, the reader's tile, the lightbox,
// the standalone block, the library's own preview — faces the same fork, and
// each would otherwise answer it slightly differently. It is answered here,
// once, off the filename.
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
// wall of play buttons. Controls belong to the two places a clip is the whole
// subject rather than a tile: the lightbox and the standalone block.
// ---------------------------------------------------------------------------

export interface MediaProps {
  src: string;
  /** Describes the source. Empty means decorative, as it does on an `<img>`. */
  alt: string;
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
  draggable?: boolean;
  /** Pictures only — a clip decides its own fetching through `preload`. */
  loading?: "lazy" | "eager";
  /** Clips only — the transport, where the clip is the subject and not a tile. */
  controls?: boolean;
  /** The checkerboard hook; see the `collectionGrid` recipe's `image` slot. */
  "data-checkered"?: string;
  /**
   * The source's intrinsic width once it is known — `naturalWidth` for a
   * picture, `videoWidth` for a clip. One question, so one callback.
   */
  onMeasure?: (width: number) => void;
}

export function Media({
  src,
  alt,
  className,
  style,
  layout,
  draggable,
  loading = "lazy",
  controls,
  onMeasure,
  "data-checkered": checkered,
}: MediaProps) {
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
    if (!node) return;
    node.muted = true;
    node.setAttribute("muted", "");

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      node.pause();
      return;
    }
    // Rejects whenever the browser declines — a policy, a background tab — and
    // returns nothing at all outside a browser. Either way the clip simply
    // stays on its first frame; there is nothing to recover.
    void node.play()?.catch(() => {});
  }, []);

  // The caller's own style still wins — the lightbox's natural-size cap is a
  // constraint on the picture, not a layout property, so it is applied last.
  const objectStyle = layout
    ? { ...mediaObjectStyle(layout), ...style }
    : style;

  const element = !isVideoSource(src) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={objectStyle}
      draggable={draggable}
      loading={loading}
      data-checkered={checkered}
      onLoad={(event) => onMeasure?.(event.currentTarget.naturalWidth)}
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
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      data-checkered={checkered}
      onLoadedMetadata={(event) => onMeasure?.(event.currentTarget.videoWidth)}
    />
  );

  if (!layout) return element;

  // Two boxes, and the split is not decorative. The OUTER is the query
  // container the corner is a share of, so it must span the full width — which
  // is why the inset lives on the INNER one: query units resolve against a
  // container's content box, so padding out here would measure the corner
  // against the already-inset width.
  //
  // Both collapse to `display: contents` when there is nothing to apply, so an
  // untouched picture keeps exactly the box it had before this existed, and
  // turning padding on never restructures the tree.
  return (
    <span data-media-frame="" style={mediaFrameStyle(layout)}>
      <span data-media-box="" style={mediaBoxStyle(layout)}>
        {element}
      </span>
    </span>
  );
}
