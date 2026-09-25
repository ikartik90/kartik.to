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

/** Seek target for a held clip's first frame; above zero so browsers treat it as a real seek. */
const FIRST_FRAME_SEEK_S = 0.05;

export interface MediaProps {
  src: string;
  alt: string;
  kind: MediaKind;
  className?: string;
  style?: CSSProperties;
  layout?: MediaLayout;
  /** Only the ratio is read, to reserve the box until the source can size itself. */
  width?: number;
  height?: number;
  draggable?: boolean;
  /** Pictures only. */
  loading?: "lazy" | "eager";
  /** Clips only: the stored still, shown until the clip has a frame. */
  poster?: string;
  /** Clips only: the browser's own strip. */
  controls?: boolean;
  /** Clips only: one play/pause chip, pinned to the surface's positioned box. */
  transport?: boolean;
  /** Clips only. False leaves the clip on its first frame without ever asking it to play. */
  autoPlay?: boolean;
  "data-checkered"?: string;
  /** Handed through to whichever element renders, for the editor's focusable media block. */
  tabIndex?: number;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  "data-showcase-media"?: string;
  /** Reports the source's intrinsic size once known. */
  onMeasure?: (width: number, height: number) => void;
  /** Must be stable (a state setter or useCallback), or the element remounts every render. */
  elementRef?: (node: HTMLElement | null) => void;
}

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
  poster,
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
  // State, not a ref, so the transport re-renders when a new clip mounts.
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);

  // The src, not a boolean, so a new source re-reserves the box without an effect.
  const [paintedSrc, setPaintedSrc] = useState<string | null>(null);
  const pending = paintedSrc !== src;
  // The prop, not `currentSrc`, which the browser resolves to an absolute URL.
  const settle = useCallback(() => setPaintedSrc(src), [src]);

  // Also settles a source that painted before mount (a cached picture fires no load).
  // Reads the src attribute, not the prop, so its identity is stable and play() never re-runs.
  const hold = useCallback(
    (node: HTMLElement | null) => {
      if (hasSomethingToShow(node)) setPaintedSrc(node.getAttribute("src"));
      elementRef?.(node);
    },
    [elementRef],
  );

  // A ref, so a changed autoPlay never re-runs the ref callback and loses the playhead.
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  // React never renders the `muted` attribute, so an SSR clip arrives un-muted and autoplay declines;
  // setting it here and calling play() starts it. Reduced motion leaves it on its first frame.
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
    void node.play()?.catch(() => {});
  }, [hold]);

  // Layout, then the pending reservation, then the caller's caps, which win.
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
      // The shimmer keys on this; see the global `[data-media-pending]` rule.
      data-media-pending={pending ? "" : undefined}
      onLoad={(event) => {
        settle();
        onMeasure?.(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight,
        );
      }}
      onError={settle}
    />
  ) : (
    <video
      ref={startPlaying}
      src={src}
      // Omitted when empty: `aria-label=""` is a broken label, not "decorative".
      aria-label={alt || undefined}
      className={className}
      style={objectStyle}
      draggable={draggable}
      controls={controls}
      autoPlay={autoPlay}
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      tabIndex={tabIndex}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-checkered={checkered}
      data-showcase-media={showcaseMedia}
      data-media-pending={pending ? "" : undefined}
      // `loadeddata`, not `loadedmetadata`: a clip paints nothing until a frame decodes.
      onLoadedData={settle}
      onError={settle}
      onLoadedMetadata={(event) => {
        const node = event.currentTarget;
        onMeasure?.(node.videoWidth, node.videoHeight);
        // A held clip paints nothing until a frame decodes, so seek a hair in unless a poster covers it.
        if (!poster && !autoPlayRef.current && node.currentTime === 0) {
          node.currentTime = Math.min(FIRST_FRAME_SEEK_S, node.duration || 0);
        }
      }}
    />
  );

  // The outer box is the corner's query container, so the inset goes on the inner one.
  const media = !layout ? (
    element
  ) : (
    <span data-media-frame="" style={mediaFrameStyle(layout)}>
      <span data-media-box="" style={mediaBoxStyle(layout)}>
        {element}
      </span>
    </span>
  );

  if (!transport || !isClip) return media;

  // A sibling, not a wrapper, so turning the chip on moves nothing.
  return (
    <>
      {media}
      <MediaTransport clip={clip} />
    </>
  );
}
