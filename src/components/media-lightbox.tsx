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
  boxKeyframe,
  clearBox,
  sameBox,
  settle,
} from "@/utils/lightbox-motion";
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

const figureStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "md",
  margin: "none",
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

// Loads and plays underneath, and shows once it can take over from the copy.
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

interface StageProps {
  item: MediaNode;
  source: HTMLElement | null;
  onMeasure: (width: number, height: number) => void;
  /** Must be stable: it is a dependency of the element's ref. */
  onClip: (clip: HTMLVideoElement | null) => void;
}

/** One item's contents; keyed per item, so a step starts from fresh copies. */
function LightboxStage({ item, source, onMeasure, onClip }: StageProps) {
  const [standIns] = useState(() => standInsFrom(item, source));
  const [live, setLive] = useState(false);
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
      onClip(node instanceof HTMLVideoElement ? node : null);
      const origin = standIns.picture;
      if (!node || !origin) return;

      const show = () => setLive(true);
      if (node instanceof HTMLVideoElement) {
        const at = origin instanceof HTMLVideoElement ? origin.currentTime : 0;
        const seek = () => {
          if (at > 0) node.currentTime = at;
          else show();
        };
        const seeked = () => {
          if (canShow(node)) show();
        };
        if (node.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
        node.addEventListener("loadedmetadata", seek);
        node.addEventListener("seeked", seeked);
        node.addEventListener("error", show);
        detach.current = () => {
          node.removeEventListener("loadedmetadata", seek);
          node.removeEventListener("seeked", seeked);
          node.removeEventListener("error", show);
        };
        return;
      }
      if (node instanceof HTMLImageElement) {
        if (canShow(node)) return show();
        node.addEventListener("load", show);
        node.addEventListener("error", show);
        detach.current = () => {
          node.removeEventListener("load", show);
          node.removeEventListener("error", show);
        };
      }
    },
    [standIns, onClip],
  );

  return (
    <>
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
        elementRef={hold}
        onMeasure={onMeasure}
        style={standIns.picture && !live ? UNDER_COPY : undefined}
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
    </>
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
  const [clip, setClip] = useState<HTMLVideoElement | null>(null);
  // Where the frame stood when a step began, for the next item's frame to grow from.
  const stepFrom = useRef<DOMRect | null>(null);
  const concealed = useRef<HTMLElement | null>(null);
  const closing = useRef(false);
  const [measured, setMeasured] = useState<
    ({ index: number } & MediaShape) | null
  >(null);
  const item = index === null ? null : items[index];
  const measuredHere = measured?.index === index ? measured : null;

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
    naturalWidth: item?.width ?? measuredHere?.width,
    band: (item?.padding ?? 0) / MEDIA_PADDING_REFERENCE,
    source: () => (index === null ? null : sourceFor?.(index) ?? null),
    onStep: (step, enterFrom) => {
      if (index !== null) go(index + step, enterFrom);
    },
    onClose: () => requestClose(),
    closing: () => closing.current,
  });
  const { frameRef, zoomRef } = gestures;

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
    const opening = !dialog.open;
    const from = opening ? source?.getBoundingClientRect() : stepFrom.current;
    const pinch = opening ? handoff.current : null;
    stepFrom.current = null;
    handoff.current = null;
    conceal(source);
    if (opening) dialog.showModal();

    settle(frame);
    clearBox(frame);
    const rest = frame.getBoundingClientRect();
    if (pinch) {
      gestures.adopt(pinch);
    } else if (from && !sameBox(from, rest)) {
      animate(frame, [boxKeyframe(from, rest), boxKeyframe(rest, rest)]);
    } else if (!from && opening) {
      animate(frame, [
        { opacity: 0, scale: "0.95" },
        { opacity: 1, scale: "1" },
      ]);
    }
    if (opening) {
      dialog
        .querySelectorAll<HTMLElement>("[data-lightbox-chrome]")
        .forEach((chrome) => animate(chrome, [{ opacity: 0 }, { opacity: 1 }]));
    }
  });

  // Must stay driven by `index` with no cleanup: a cleanup calling close() fires onClose,
  // which dismisses the lightbox under React's dev double-run.
  useLayoutEffect(() => show(index), [index]);

  const go = (next: number, from?: DOMRect) => {
    if (index === null || closing.current) return;
    stepFrom.current =
      from ?? frameRef.current?.getBoundingClientRect() ?? null;
    onIndexChange((next + items.length) % items.length);
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
      settle(frame);
      clearBox(frame);
      const rest = frame.getBoundingClientRect();
      if (source) {
        // The page's copy picks up where the lightbox's left off.
        const live = frame.querySelector("video");
        const origin = source.querySelector("video");
        if (live && origin) origin.currentTime = live.currentTime;
        animation = animate(
          frame,
          [
            boxKeyframe(from, rest),
            boxKeyframe(source.getBoundingClientRect(), rest),
          ],
          { fill: "forwards" },
        );
      } else {
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

    // Revealed in the same task as close(), whose `close` event only arrives a frame later.
    const finish = () => {
      reveal();
      dialog.close();
    };
    if (animation) animation.finished.then(finish, () => {});
    else finish();
  };

  const handleClosed = () => {
    closing.current = false;
    dialogRef.current?.removeAttribute("data-closing");
    reveal();
    onClose();
  };

  const shape = item && (item.width && item.height ? item : measuredHere ?? {});
  const frameShape = item && shape ? lightboxFrameShape(shape, item) : null;
  const frameVars = frameShape
    ? ({
        "--frame-aspect": String(frameShape.aspect),
        ...(frameShape.maxWidth
          ? { "--frame-max": `${frameShape.maxWidth}px` }
          : {}),
      } as CSSProperties)
    : undefined;

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
        go(index + (event.key === "ArrowRight" ? 1 : -1));
      }}
    >
      {item && index !== null && (
        <>
          <figure className={figureStyle}>
            <div
              ref={frameRef}
              data-lightbox-frame=""
              // The box a clip's transport pins to.
              data-media-surface=""
              className={cx(cell.cell, frameStyle)}
              style={frameVars}
            >
              <div ref={zoomRef} data-lightbox-zoom="" className={zoomStyle}>
                <LightboxStage
                  key={index}
                  item={item}
                  source={sourceFor?.(index) ?? null}
                  onMeasure={(width, height) =>
                    setMeasured({ index, width, height })
                  }
                  onClip={setClip}
                />
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
                  onClick={() => go(index - 1)}
                >
                  <ChevronLeftIcon aria-hidden />
                </Button>
                <Button
                  variant="icon"
                  emphasis="secondary"
                  aria-label="Next"
                  className={cx(navButtonStyle, nextStyle)}
                  onClick={() => go(index + 1)}
                >
                  <ChevronRightIcon aria-hidden />
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
                    onClick={() => go(dot)}
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
