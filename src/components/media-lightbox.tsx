"use client";

import {
  useCallback,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { css, cx } from "../../styled-system/css";
import { carousel } from "../../styled-system/recipes";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media } from "@/components/media";
import { MediaTransport } from "@/components/media-transport";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Typography } from "@/components/ui/typography";
import {
  MEDIA_PADDING_REFERENCE,
  lightboxFrameShape,
  mediaBoxStyle,
  mediaFrameStyle,
  mediaObjectStyle,
  type MediaNode,
  type MediaShape,
} from "@/domain/nodes";
import type { GestureFrame } from "@/hooks/use-gesture-input";
import { useLightboxGestures } from "@/hooks/use-lightbox-gestures";
import { collectionItemAlt } from "@/utils/collection-items";
import {
  animate,
  animateBox,
  boxKeyframe,
  clearBox,
  cornerRadius,
  sameBox,
  settle,
} from "@/utils/lightbox-motion";
import {
  OPENING,
  stepTransit,
  stripSlots,
  type StripSlot,
  type Transit,
} from "@/utils/lightbox-strip";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";

const cell = carousel();

const panelStyle = css({
  background: "transparent",
  border: "none",
  padding: "none",
  overflow: "visible",
  maxWidth: "none",
  maxHeight: "none",
  // The dialog holds focus itself, so the UA ring would outline the photo.
  focusVisibleRing: "none",
  // Its own pinch, pan and swipe (`useLightboxGestures`), never the page's.
  touchAction: "none",
  "&::backdrop": { touchAction: "none" },
});

// Clicks beside the item fall through to the dialog, which takes them as the backdrop's.
const stripStyle = css({
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
});

// A screen apart, so the next item enters as the current one leaves.
const figureStyle = css({
  gridArea: "1 / 1",
  translate: "calc(var(--slot) * 100vw) 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "md",
  margin: "none",
  "&:not([inert])": { pointerEvents: "auto" },
});

// Sized before anything loads (`lightboxFrameShape`); the 40px under the height cap is the caption's.
const frameStyle = css({
  flexShrink: 0,
  width:
    "min(85vw, calc((85vh - token(spacing.4xl)) * var(--frame-aspect)), var(--frame-max, 85vw))",
  aspectRatio: "var(--frame-aspect)",
});

// Scales and pans the picture inside the frame, which clips it.
const zoomStyle = css({ position: "absolute", inset: 0 });

const groundCopyStyle = css({
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  objectFit: "cover",
});

const standInStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: 2,
  pointerEvents: "none",
});

// Fades in with the opening zoom (`show`), out on `data-closing`.
const chromeStyle = css({
  transition: "opacity 300ms ease-out",
  "[data-closing] &": { opacity: 0 },
});

// A picture loads hidden under its copy, which a see-through one would double up with. A clip
// stays in sight there, or WebKit shows a blank frame while its layer comes up.
const UNDER_COPY: CSSProperties = { visibility: "hidden" };

const captionStyle = css({
  maxWidth: "min(85vw, token(sizes.articleShowcase))",
  textAlign: "center",
  // No `textWrap`: Typography's utilities layer would override it.
});

const navStyle = css({
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  display: "none",
  lg: { display: "block" },
});

const navButtonStyle = css({
  position: "absolute",
  top: "50%",
  translate: "0 -50%",
  pointerEvents: "auto",
});

const previousStyle = css({ left: "xxl" });

const nextStyle = css({ right: "xxl" });

const dotsStyle = css({
  position: "fixed",
  insetInline: 0,
  bottom: "xxl",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "md",
  lg: { display: "none" },
});

const dotStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "token(spacing.sm)",
  height: "token(spacing.sm)",
  padding: "none",
  border: "none",
  borderRadius: "full",
  appearance: "none",
  cursor: "pointer",
  backgroundColor: "text.body",
  transition:
    "width 150ms ease, height 150ms ease, background-color 150ms ease",
  // A finger-sized target that stops where its neighbours' begin.
  _before: {
    content: '""',
    position: "absolute",
    insetBlock: "calc(-1 * token(spacing.lg))",
    insetInline: "calc(-1 * token(spacing.sm))",
  },
  "&[aria-current=true]": {
    width: "token(spacing.md)",
    height: "token(spacing.md)",
    backgroundColor: "text.title",
  },
});

type Drawable = HTMLImageElement | HTMLVideoElement;

function pixelSize(element: Drawable): MediaShape {
  return element instanceof HTMLVideoElement
    ? { width: element.videoWidth, height: element.videoHeight }
    : { width: element.naturalWidth, height: element.naturalHeight };
}

function canShow(element: Drawable): boolean {
  return element instanceof HTMLVideoElement
    ? element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    : element.complete && element.naturalWidth > 0;
}

/** What the opener already shows of `item`, to stand in until the lightbox's own copies can. */
function standInsFrom(item: MediaNode, source: HTMLElement | null) {
  const ground = item.backgroundEffect
    ? source?.querySelector<HTMLCanvasElement>(
        "[data-background-effect] canvas",
      )
    : null;
  const picture = source?.querySelector<Drawable>("img, video");
  return {
    ground: ground && ground.width > 0 ? ground : null,
    picture:
      picture && picture.getAttribute("src") === item.src && canShow(picture)
        ? picture
        : null,
  };
}

// A paused clip may draw no new frame to report.
const REDRAW_WAIT_MS = 200;

/**
 * Once a clip has put a frame on screen. Ready is not yet drawn: a clip that has just loaded,
 * seeked or come out of hiding paints blank until then.
 */
function whenDrawn(clip: HTMLVideoElement | null | undefined, then: () => void) {
  if (!clip || typeof clip.requestVideoFrameCallback !== "function") return then();
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    then();
  };
  clip.requestVideoFrameCallback(once);
  setTimeout(once, REDRAW_WAIT_MS);
}

function copyInto(
  canvas: HTMLCanvasElement | null,
  from: CanvasImageSource,
  { width = 0, height = 0 }: MediaShape,
) {
  if (!canvas) return;
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(from, 0, 0, width, height);
}

interface SlideProps {
  item: MediaNode;
  /** Screens from the centre; null holds it out of sight. */
  slot: StripSlot | null;
  current: boolean;
  frameRef?: Ref<HTMLDivElement>;
  zoomRef?: Ref<HTMLDivElement>;
  source: HTMLElement | null;
  measured: MediaShape | undefined;
  onMeasure: (width: number, height: number) => void;
}

/** One item, mounted while it neighbours the current one, so it arrives loaded. */
function LightboxSlide({
  item,
  slot,
  current,
  frameRef,
  zoomRef,
  source,
  measured,
  onMeasure,
}: SlideProps) {
  const [standIns] = useState(() => standInsFrom(item, source));
  const [live, setLive] = useState(false);
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);
  const groundRef = useRef<HTMLCanvasElement>(null);
  const pictureRef = useRef<HTMLCanvasElement>(null);
  const detach = useRef<(() => void) | null>(null);

  // Before the first paint, so the frame never shows empty.
  useLayoutEffect(() => {
    const { ground, picture } = standIns;
    if (ground) copyInto(groundRef.current, ground, ground);
    if (picture) copyInto(pictureRef.current, picture, pixelSize(picture));
  }, [standIns]);

  // The copy comes off once the element underneath shows the same thing; a clip carries on
  // from where the opener's was.
  const hold = useCallback(
    (node: HTMLElement | null) => {
      detach.current?.();
      detach.current = null;
      setClip(node instanceof HTMLVideoElement ? node : null);
      const origin = standIns.picture;
      if (!node || !origin) return;

      const show = () => setLive(true);
      if (node instanceof HTMLVideoElement) {
        const at = origin instanceof HTMLVideoElement ? origin.currentTime : 0;
        const seek = () => {
          if (at > 0) node.currentTime = at;
        };
        const ready = () => {
          if (canShow(node) && !node.seeking) whenDrawn(node, show);
        };
        if (node.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
        ready();
        node.addEventListener("loadedmetadata", seek);
        node.addEventListener("loadeddata", ready);
        node.addEventListener("seeked", ready);
        node.addEventListener("error", show);
        detach.current = () => {
          node.removeEventListener("loadedmetadata", seek);
          node.removeEventListener("loadeddata", ready);
          node.removeEventListener("seeked", ready);
          node.removeEventListener("error", show);
        };
        return;
      }
      if (node instanceof HTMLImageElement) {
        // Loaded is not yet decoded, and an undecoded picture can paint blank.
        const decoded = () => {
          if (typeof node.decode !== "function") return show();
          node.decode().then(show, show);
        };
        if (canShow(node)) return decoded();
        node.addEventListener("load", decoded);
        node.addEventListener("error", show);
        detach.current = () => {
          node.removeEventListener("load", decoded);
          node.removeEventListener("error", show);
        };
      }
    },
    [standIns],
  );

  const shape = item.width && item.height ? item : measured ?? {};
  const frameShape = lightboxFrameShape(shape, item);
  const frameVars = {
    "--frame-aspect": String(frameShape.aspect),
    ...(frameShape.maxWidth ? { "--frame-max": `${frameShape.maxWidth}px` } : {}),
  } as CSSProperties;

  return (
    <figure
      data-lightbox-slide=""
      inert={!current}
      className={figureStyle}
      style={
        {
          "--slot": slot === "toward" ? "var(--toward, 1)" : (slot ?? 0),
          visibility: slot === null ? "hidden" : undefined,
        } as CSSProperties
      }
    >
      <div
        ref={frameRef}
        data-lightbox-frame=""
        // The box a clip's transport pins to.
        data-media-surface=""
        className={cx(cell.cell, frameStyle)}
        style={frameVars}
      >
        <div ref={zoomRef} data-lightbox-zoom="" className={zoomStyle}>
          {item.backgroundEffect &&
            (standIns.ground ? (
              <canvas
                ref={groundRef}
                aria-hidden
                data-background-effect=""
                className={cx(cell.backgroundEffect, groundCopyStyle)}
              />
            ) : (
              <BackgroundEffectLayer
                effect={item.backgroundEffect}
                className={cell.backgroundEffect}
              />
            ))}
          <Media
            src={item.src}
            kind={item.kind}
            alt={collectionItemAlt(item)}
            className={cell.image}
            layout={item}
            width={item.width}
            height={item.height}
            loading="eager"
            elementRef={hold}
            onMeasure={onMeasure}
            style={
              standIns.picture && !live && item.kind !== "video"
                ? UNDER_COPY
                : undefined
            }
          />
          {standIns.picture && !live && (
            // Laid out exactly as `Media` lays out the picture it covers.
            <span data-lightbox-stand-in="" aria-hidden className={standInStyle}>
              <span style={mediaFrameStyle(item)}>
                <span style={mediaBoxStyle(item)}>
                  <canvas
                    ref={pictureRef}
                    className={cell.image}
                    style={mediaObjectStyle(item)}
                  />
                </span>
              </span>
            </span>
          )}
        </div>
        <MediaTransport clip={clip} />
      </div>
      {item.caption && (
        <Typography
          tag="figcaption"
          type="caption"
          className={cx(captionStyle, chromeStyle)}
          data-lightbox-chrome=""
        >
          {item.caption}
        </Typography>
      )}
    </figure>
  );
}

export interface MediaLightboxHandle {
  /** A pinch that began on the page: `begin` as it opens the lightbox, then its moves and end. */
  pinch: {
    begin: (frame: GestureFrame) => void;
    move: (frame: GestureFrame) => void;
    end: (frame: GestureFrame) => void;
  };
}

export interface MediaLightboxProps {
  ref?: Ref<MediaLightboxHandle>;
  items: readonly MediaNode[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** The element showing each item on the page, which the frame zooms out of and back into. */
  sourceFor?: (index: number) => HTMLElement | null;
}

export function MediaLightbox({
  ref,
  items,
  index,
  onIndexChange,
  onClose,
  sourceFor,
}: MediaLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // A pinch from the page that is opening the lightbox, until the frame is there to take it.
  const handoff = useRef<GestureFrame | null>(null);
  // The way the strip glides once a step has placed the items.
  const heading = useRef<1 | -1 | null>(null);
  const [transit, setTransit] = useState<Transit | null>(OPENING);
  const concealed = useRef<HTMLElement | null>(null);
  const closing = useRef(false);
  const [measured, setMeasured] = useState<Record<string, MediaShape>>({});
  const item = index === null ? null : items[index];

  const reveal = () => {
    if (concealed.current) concealed.current.style.visibility = "";
    concealed.current = null;
  };

  const conceal = (source: HTMLElement | null) => {
    if (concealed.current === source) return;
    reveal();
    if (!source) return;
    source.style.visibility = "hidden";
    concealed.current = source;
  };

  const gestures = useLightboxGestures({
    dialogRef,
    shown: index,
    count: items.length,
    naturalWidth: item ? (item.width ?? measured[item.src]?.width) : undefined,
    band: (item?.padding ?? 0) / MEDIA_PADDING_REFERENCE,
    source: () => (index === null ? null : sourceFor?.(index) ?? null),
    onStep: (step) => {
      if (index !== null) go(index + step, step);
    },
    onRest: () => setTransit(null),
    onClose: () => requestClose(),
    closing: () => closing.current,
  });
  const { stripRef, frameRef, zoomRef } = gestures;

  useImperativeHandle(ref, () => ({
    pinch: {
      begin: (frame) => {
        handoff.current = frame;
      },
      move: (frame) => {
        if (handoff.current) handoff.current = frame;
        else gestures.move(frame);
      },
      // Ending before the frame took it over leaves the plain opening zoom to finish.
      end: (frame) => {
        if (handoff.current) handoff.current = null;
        else gestures.end(frame);
      },
    },
  }));

  // A step taken while it opened leaves the neighbours to its glide's rest.
  const opened = () =>
    setTransit((was) => (was?.leaving.length ? was : null));

  const show = useEffectEvent((shown: number | null) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (shown === null) {
      if (dialog.open) dialog.close();
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;

    const source = sourceFor?.(shown) ?? null;
    const pinch = handoff.current;
    handoff.current = null;
    conceal(source);
    if (dialog.open) {
      const step = heading.current;
      heading.current = null;
      if (step) gestures.glide(step);
      return;
    }

    const from = source?.getBoundingClientRect();
    dialog.showModal();
    settle(frame);
    clearBox(frame);
    const rest = frame.getBoundingClientRect();
    const radius = cornerRadius(frame);
    dialog
      .querySelectorAll<HTMLElement>("[data-lightbox-chrome]")
      .forEach((chrome) =>
        animate(chrome, [{ opacity: 0 }, { opacity: 1 }], { afterPaint: true }),
      );
    // Its rest is reported by the gestures once the pinch ends.
    if (pinch) return gestures.adopt(pinch);

    const growing =
      from && rest.width && !sameBox(from, rest)
        ? animateBox(
            frame,
            [
              boxKeyframe(from, rest, cornerRadius(source!)),
              boxKeyframe(rest, rest, radius),
            ],
            { afterPaint: true },
          )
        : !from
          ? animate(
              frame,
              [
                { opacity: 0, scale: "0.95" },
                { opacity: 1, scale: "1" },
              ],
              { afterPaint: true },
            )
          : null;
    if (growing) growing.finished.then(opened, () => {});
    else opened();
  });


  // Must stay driven by `index` with no cleanup: a cleanup calling close() fires onClose,
  // which dismisses the lightbox under React's dev double-run.
  useLayoutEffect(() => show(index), [index]);

  const go = (next: number, step: 1 | -1) => {
    if (index === null || closing.current) return;
    const target = (next + items.length) % items.length;
    if (target === index) return;
    heading.current = step;
    gestures.resetZoom();
    setTransit((was) => stepTransit(was, index, target, step));
    onIndexChange(target);
  };

  const requestClose = () => {
    const dialog = dialogRef.current;
    const frame = frameRef.current;
    if (!dialog || closing.current) return;
    const source = index === null ? null : sourceFor?.(index) ?? null;
    closing.current = true;
    dialog.setAttribute("data-closing", "");
    gestures.resetZoom();

    let animation: Animation | null = null;
    if (frame) {
      const from = frame.getBoundingClientRect();
      const strip = stripRef.current;
      if (strip) {
        settle(strip);
        clearBox(strip);
      }
      settle(frame);
      clearBox(frame);
      const rest = frame.getBoundingClientRect();
      if (source && rest.width) {
        // The page's copy picks up where the lightbox's left off.
        const live = frame.querySelector("video");
        const origin = source.querySelector("video");
        if (live && origin) origin.currentTime = live.currentTime;
        animation = animateBox(
          frame,
          [
            boxKeyframe(from, rest, cornerRadius(frame)),
            boxKeyframe(
              source.getBoundingClientRect(),
              rest,
              cornerRadius(source),
            ),
          ],
          { fill: "forwards" },
        );
      } else if (!source) {
        animation = animate(
          frame,
          [
            { opacity: 1, scale: "1" },
            { opacity: 0, scale: "0.95" },
          ],
          { fill: "forwards" },
        );
      }
    }

    // Revealed before close(), whose `close` event only arrives a frame later; the frame covers
    // the source until it draws.
    const finish = () => {
      reveal();
      whenDrawn(source?.querySelector("video"), () => dialog.close());
    };
    if (animation) animation.finished.then(finish, () => {});
    else finish();
  };

  const handleClosed = () => {
    closing.current = false;
    dialogRef.current?.removeAttribute("data-closing");
    setTransit(OPENING);
    reveal();
    onClose();
  };

  return (
    <Dialog
      ref={dialogRef}
      motion="zoom"
      align="center"
      justify="center"
      aria-label={
        item ? collectionItemAlt(item) || `Image ${index! + 1}` : "Image viewer"
      }
      className={panelStyle}
      onClose={handleClosed}
      onRequestClose={requestClose}
      onKeyDown={(event) => {
        if (index === null) return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        go(index + step, step);
      }}
    >
      {item && index !== null && (
        <>
          <div ref={stripRef} data-lightbox-strip="" className={stripStyle}>
            {stripSlots(index, items.length, transit).map(({ index: at, slot }) => {
              const shown = items[at];
              return (
                <LightboxSlide
                  key={at}
                  item={shown}
                  slot={slot}
                  current={at === index}
                  frameRef={at === index ? frameRef : undefined}
                  zoomRef={at === index ? zoomRef : undefined}
                  source={sourceFor?.(at) ?? null}
                  measured={measured[shown.src]}
                  onMeasure={(width, height) =>
                    setMeasured((was) => ({ ...was, [shown.src]: { width, height } }))
                  }
                />
              );
            })}
          </div>

          {items.length > 1 && (
            <>
              <div
                data-lightbox-chrome=""
                className={cx(navStyle, chromeStyle)}
              >
                <Button
                  variant="icon"
                  emphasis="secondary"
                  aria-label="Previous"
                  className={cx(navButtonStyle, previousStyle)}
                  onClick={() => go(index - 1, -1)}
                >
                  <ChevronLeftIcon aria-hidden />
                  <Button.Tooltip>
                    <Tooltip.Text>Previous</Tooltip.Text>
                  </Button.Tooltip>
                </Button>
                <Button
                  variant="icon"
                  emphasis="secondary"
                  aria-label="Next"
                  className={cx(navButtonStyle, nextStyle)}
                  onClick={() => go(index + 1, 1)}
                >
                  <ChevronRightIcon aria-hidden />
                  <Button.Tooltip>
                    <Tooltip.Text>Next</Tooltip.Text>
                  </Button.Tooltip>
                </Button>
              </div>
              <div
                data-lightbox-chrome=""
                className={cx(dotsStyle, chromeStyle)}
              >
                {items.map((_, dot) => (
                  <button
                    key={dot}
                    type="button"
                    className={dotStyle}
                    aria-label={`Show image ${dot + 1}`}
                    aria-current={dot === index || undefined}
                    onClick={() => go(dot, dot > index ? 1 : -1)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
