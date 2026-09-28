"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { cx } from "../../styled-system/css";
import { carousel } from "../../styled-system/recipes";
import {
  Carousel,
  carouselSlides,
  restOffsets,
} from "@/components/carousel";
import { MediaCaption } from "@/components/media-caption";
import { MediaObject } from "@/components/media-object";
import { MediaPropertiesPanel } from "@/components/media-properties-panel";
import {
  mediaSurfaceAspect,
  type CollectionNode,
  type MediaNode,
} from "@/domain/nodes";
import { useImageTransparency } from "@/hooks/use-image-transparency";
import { useWholeSlides } from "@/hooks/use-whole-slides";
import { useMediaProperties } from "@/hooks/use-media-properties";
import {
  edgeScrollSpeed,
  reorderShifts,
  reorderTarget,
  scrollToKeep,
  settleOffset,
} from "@/utils/carousel-reorder";
import { itemKeys } from "@/utils/collection-items";
import { animate } from "@/utils/lightbox-motion";
import AddIcon from "@/assets/icons/add.svg";

const styles = carousel({ editing: true });

/** Pixels a press must travel to count as a drag. */
const DRAG_THRESHOLD = 4;

const MEDIA_TAGS = "img, video";

/** The shrink, the regrowth and the landing; matches the slides' `translate` transition. */
const REORDER_MS = 200;

// Horizontal travel only, since it overshoots past 1. The stops are the source curve's rescaled by
// 1/0.576 to drop its flat tail, so retime at REORDER_MS, never here.
const LANDING_EASE_X =
  "linear(0, 0.029 2.26%, 0.119 4.86%, 0.659 15.1%, 0.871 20.14%, 1.009 25.35%, 1.052 28.13%, 1.078 31.08%, 1.088 34.2%, 1.085 37.67%, 1.014 54.51%, 0.993 65.97%, 1)";

// Vertical travel leads the horizontal, bending the drop into an arc; only the horizontal overshoots.
const LANDING_EASE_Y = "cubic-bezier(0.05, 0.7, 0.1, 1)";

const LANDING_SETTLE_EASE = "ease-out";

// For a flight whose `onfinish` never comes (a hidden tab); long enough for a slow first frame,
// which in Chromium can hold the flight at its start for 200ms.
const LANDING_BACKSTOP_MS = 1000;

// Near an edge the strip scrolls, fastest at the edge itself; the zone is at least this wide and
// reaches in to the showcase column.
const EDGE_ZONE = 80;

/** px/ms at the very edge. */
const EDGE_SPEED = 1.5;

interface Press {
  index: number;
  pointerId: number;
  originX: number;
  originY: number;
  media: HTMLElement;
  cell: HTMLElement;
  /** The cell and its picture, measured at the press, before its scale; later would shrink the copy twice. */
  rect: DOMRect;
  picture: DOMRect;
  /** How far across its slide it was pressed, as a share of the slide's width. */
  share: number;
}

interface Reorder {
  from: number;
  to: number;
  widths: number[];
  gap: number;
  origin: number;
  zone: number;
  pointerX: number;
  /** Where its place sits from the pointer when the scroll can't keep it under it, at an end. */
  bias: number;
  /** Where the edge scroll has got to, in fractions of a pixel the scroller may round away. */
  scroll: number;
  frame: number | null;
  last: number | null;
}

const FILL = "position:absolute;inset:0;width:100%;height:100%";

/** A still of `source` on a canvas: `cloneNode` doesn't copy a canvas's buffer. */
function still(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * The slide as it looks: its shader ground as a still, and its picture copied to where it sits.
 * A copied <video> shows nothing until it has loaded and seeked, so its frame on show is drawn
 * beneath it; nor is it muted, since React never writes the attribute.
 */
function slideCopy(held: Press) {
  const { cell, media, rect, picture } = held;
  const node = document.createElement("div");

  const ground = cell.querySelector<HTMLCanvasElement>(
    "[data-background-effect] canvas",
  );
  if (ground) {
    const layer = still(ground, ground.width, ground.height);
    layer.style.cssText = FILL;
    node.append(layer);
  }

  const shown = getComputedStyle(media);
  const box = document.createElement("div");
  box.style.cssText = `position:absolute;overflow:hidden;left:${picture.left - rect.left - cell.clientLeft}px;top:${picture.top - rect.top - cell.clientTop}px;width:${picture.width}px;height:${picture.height}px;border-radius:${shown.borderRadius}`;
  const layers: HTMLElement[] = [];
  const copy = media.cloneNode(true) as HTMLElement;
  if (media instanceof HTMLVideoElement && copy instanceof HTMLVideoElement) {
    layers.push(still(media, media.videoWidth, media.videoHeight));
    copy.muted = true;
    copy.currentTime = media.currentTime;
    void copy.play()?.catch(() => {});
  }
  layers.push(copy);
  for (const layer of layers) {
    layer.removeAttribute("class");
    layer.style.cssText = `${FILL};object-fit:${shown.objectFit}`;
    box.append(layer);
  }
  node.append(box);
  return node;
}

export interface EditableCarouselProps
  extends Pick<CollectionNode, "size" | "showCaptions" | "captionStyle"> {
  items: MediaNode[];
  /** The editor's showcase-media contract, so a collection navigates like an image block. */
  rootProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  onFeature: (index: number) => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAddImage: () => void;
  /** Moves one item to another place, the ones between shifting over. */
  onReorder: (from: number, to: number) => void;
  /** Panel edits, which ride the debounce; the intents above are each one undo step. */
  onItemsChange: (items: MediaNode[]) => void;
}

export function EditableCarousel({
  items,
  size,
  showCaptions = false,
  captionStyle,
  rootProps,
  onFeature,
  onReplace,
  onRemove,
  onAddImage,
  onReorder,
  onItemsChange,
}: EditableCarouselProps) {
  const properties = useMediaProperties(items, onItemsChange);
  const keys = itemKeys(items);

  // Pictures only: the scan decodes with `new Image()`, which a clip would fail.
  const transparentSrcs = useImageTransparency(
    items.filter((item) => item.kind === "image").map((item) => item.src),
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const whole = useWholeSlides(scrollerRef, items);
  const slideNodes = useRef(new Map<string, HTMLElement>());
  // Pointer events, not HTML5 drag-and-drop, whose bitmap and fly-back can't be controlled. The
  // gesture lives in refs: handlers can't rely on React committing between events.
  const press = useRef<Press | null>(null);
  const reorder = useRef<Reorder | null>(null);
  const preview = useRef<HTMLElement | null>(null);
  const settling = useRef<HTMLElement | null>(null);
  const grab = useRef({ x: 0, y: 0 });
  const lastPoint = useRef({ x: 0, y: 0 });
  /** Where the pointer came to rest, so a pointermove at the same spot doesn't count as a move. */
  const restPoint = useRef<{ x: number; y: number } | null>(null);

  const [pressed, setPressed] = useState<{
    index: number;
    origin: string;
  } | null>(null);
  const [drag, setDrag] = useState<{ from: number; shifts: number[] } | null>(
    null,
  );
  /** The dropped slide, empty under the carried picture until it lands. */
  const [landing, setLanding] = useState<string | null>(null);
  /** The pointer hasn't moved since a drag ended, so the controls stay down until it does. */
  const [pointerIdle, setPointerIdle] = useState(false);

  const slides = () =>
    scrollerRef.current ? carouselSlides(scrollerRef.current) : [];

  const measureSlides = () =>
    new Map(slides().map((slide) => [slide, slide.getBoundingClientRect()]));

  /** Plays each slide from where it was painted to where the layout now puts it. */
  const glide = (before: Map<HTMLElement, DOMRect>) => {
    for (const [slide, was] of before) {
      if (!slide.isConnected) continue;
      const now = slide.getBoundingClientRect();
      if (!now.width) continue;
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      const scale = was.width / now.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.001) {
        continue;
      }
      animate(
        slide,
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: REORDER_MS },
      );
    }
  };

  const translateFor = (clientX: number, clientY: number) =>
    `${clientX - grab.current.x}px ${clientY - grab.current.y}px`;

  const carry = (held: Press, clientX: number, clientY: number) => {
    const { rect } = held;
    grab.current = { x: held.originX - rect.left, y: held.originY - rect.top };

    // Copied before the slide empties.
    const node = slideCopy(held);
    node.className = styles.dragPreview;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    node.style.translate = translateFor(clientX, clientY);
    node.style.transformOrigin = `${grab.current.x}px ${grab.current.y}px`;
    // Marked before insertion, so it's born mid-press with no transition to play.
    node.dataset.carried = "";
    // On <body>, so no ancestor clips it.
    document.body.appendChild(node);
    preview.current = node;
  };

  const retarget = () => {
    const state = reorder.current;
    const scroller = scrollerRef.current;
    if (!state || !scroller) return;
    const x =
      state.pointerX -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft +
      state.bias;
    const to = reorderTarget({ ...state, x });
    if (to === state.to) return;
    state.to = to;
    setDrag({
      from: state.from,
      shifts: reorderShifts(state.widths, state.gap, state.from, to),
    });
  };

  function edgeScroll(time: number) {
    const state = reorder.current;
    const scroller = scrollerRef.current;
    if (!state || !scroller) return;
    const frame = scroller.getBoundingClientRect();
    const speed = edgeScrollSpeed({
      at: state.pointerX,
      start: Math.max(frame.left, 0),
      end: Math.min(frame.right, window.innerWidth),
      zone: state.zone,
      max: EDGE_SPEED,
    });
    if (speed !== 0 && state.last !== null) {
      // Something else scrolled it: carry on from there.
      if (Math.abs(scroller.scrollLeft - state.scroll) > 1) {
        state.scroll = scroller.scrollLeft;
      }
      const max = scroller.scrollWidth - scroller.clientWidth;
      state.scroll = Math.max(
        Math.min(state.scroll + speed * (time - state.last), max),
        0,
      );
      scroller.scrollLeft = state.scroll;
      retarget();
    }
    state.last = time;
    state.frame = requestAnimationFrame(edgeScroll);
  }

  const beginDrag = (clientX: number, clientY: number) => {
    const held = press.current;
    const scroller = scrollerRef.current;
    if (!held || !scroller) return;

    carry(held, clientX, clientY);
    const before = measureSlides();
    // Its captions go while the slides are halved; the page below mustn't rise into their place.
    const strip = scroller.firstElementChild as HTMLElement | null;
    if (strip) strip.style.minHeight = getComputedStyle(strip).height;
    flushSync(() => setDrag({ from: held.index, shifts: [] }));

    // Halved, the slides would slip out from under the pointer: keep the carried one's place there.
    const all = slides();
    const own = all[held.index];
    const pointer = clientX - scroller.getBoundingClientRect().left;
    const kept = own.offsetLeft + held.share * own.offsetWidth;
    scroller.scrollLeft = scrollToKeep({
      start: own.offsetLeft,
      width: own.offsetWidth,
      share: held.share,
      pointer,
      max: scroller.scrollWidth - scroller.clientWidth,
    });

    const pictures = all.slice(0, items.length);
    const track = getComputedStyle(scroller.firstElementChild ?? scroller);
    reorder.current = {
      from: held.index,
      to: held.index,
      widths: pictures.map((slide) => slide.offsetWidth),
      gap: parseFloat(track.columnGap) || 0,
      origin: pictures[0]?.offsetLeft ?? 0,
      zone: Math.max(EDGE_ZONE, parseFloat(track.paddingInlineStart) || 0),
      pointerX: clientX,
      bias: kept - (pointer + scroller.scrollLeft),
      scroll: scroller.scrollLeft,
      frame: null,
      last: null,
    };
    glide(before);
    reorder.current.frame = requestAnimationFrame(edgeScroll);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    lastPoint.current = { x: clientX, y: clientY };
    if (preview.current) {
      preview.current.style.translate = translateFor(clientX, clientY);
    }
    const state = reorder.current;
    if (!state) return;
    state.pointerX = clientX;
    retarget();
  };

  /** Flies the carried picture into its slide, which stays empty until it lands. */
  const land = (key: string, target: DOMRect | undefined) => {
    const node = preview.current;
    preview.current = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      // Uncovered before the clone leaves, or a frame paints with neither.
      flushSync(() =>
        setLanding((current) => (current === key ? null : current)),
      );
      node?.remove();
      if (settling.current === node) settling.current = null;
    };
    if (!node || !target || typeof node.animate !== "function") return done();

    settling.current?.remove();
    settling.current = node;

    // Read BEFORE any animation starts: once one runs with `fill: forwards`, the computed values are its own.
    const held = getComputedStyle(node);
    const [fromX, fromY] = node.style.translate
      .split(" ")
      .map((value) => parseFloat(value) || 0);
    // Each axis animates on its own with `composite: "add"`, summing onto the inline translate,
    // so the two easings bend the path; a third animation settles everything else.
    const travel = (dx: number, dy: number, easing: string) =>
      node.animate(
        [{ translate: "0px 0px" }, { translate: `${dx}px ${dy}px` }],
        { duration: REORDER_MS, easing, fill: "forwards", composite: "add" },
      );
    const flight = travel(target.left - fromX, 0, LANDING_EASE_X);
    travel(0, target.top - fromY, LANDING_EASE_Y);
    node.animate(
      [
        {
          scale: held.scale || "1",
          rotate: held.rotate || "0deg",
          width: node.style.width,
          height: node.style.height,
        },
        {
          scale: "1",
          rotate: "0deg",
          width: `${target.width}px`,
          height: `${target.height}px`,
          boxShadow: "none",
        },
      ],
      { duration: REORDER_MS, easing: LANDING_SETTLE_EASE, fill: "forwards" },
    );
    flight.onfinish = done;
    flight.oncancel = done;
    timer = setTimeout(done, LANDING_BACKSTOP_MS);
  };

  /** Ends the gesture: a drop moves the slide where its place was, a cancel puts it back. */
  const finish = (commit: boolean) => {
    const held = press.current;
    const state = reorder.current;
    press.current = null;
    reorder.current = null;
    const scroller = scrollerRef.current;
    if (!held || !state || !scroller) {
      setPressed(null);
      return;
    }
    if (state.frame !== null) cancelAnimationFrame(state.frame);

    const to = commit ? state.to : state.from;
    const key = keys[state.from];
    const before = measureSlides();
    const spot = slideNodes.current.get(key)?.getBoundingClientRect();
    restPoint.current = { ...lastPoint.current };
    flushSync(() => {
      if (to !== state.from) onReorder(state.from, to);
      setDrag(null);
      setPressed(null);
      setPointerIdle(true);
      setLanding(key);
    });
    (scroller.firstElementChild as HTMLElement | null)?.style.removeProperty(
      "min-height",
    );

    // Rest at the snap stop nearest where the drop left things, with the dropped slide in view.
    const dropped = slideNodes.current.get(key);
    if (dropped && spot) {
      const frame = scroller.getBoundingClientRect();
      const anchored = scrollToKeep({
        start: dropped.offsetLeft,
        width: dropped.offsetWidth,
        share: 0.5,
        pointer: spot.left + spot.width / 2 - frame.left,
        max: scroller.scrollWidth - scroller.clientWidth,
      });
      scroller.scrollLeft = settleOffset({
        offsets: restOffsets(scroller),
        anchored,
        start: dropped.offsetLeft,
        width: dropped.offsetWidth,
        viewport: scroller.clientWidth,
      });
    }
    // Before the glide starts, which would report the slide where it was.
    const target = dropped
      ?.querySelector<HTMLElement>("[data-media-cell]")
      ?.getBoundingClientRect();
    glide(before);
    land(key, target);
  };

  const cancel = useEffectEvent(() => finish(false));
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragging]);

  // On the document: leaving the carousel is a move too.
  useEffect(() => {
    if (!pointerIdle) return;
    const wake = () => setPointerIdle(false);
    const onPointerMove = (event: PointerEvent) => {
      const rest = restPoint.current;
      if (rest && event.clientX === rest.x && event.clientY === rest.y) return;
      wake();
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("focusin", wake);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("focusin", wake);
    };
  }, [pointerIdle]);

  // Unmounting mid-gesture must not leave a picture parented to <body>.
  useEffect(
    () => () => {
      preview.current?.remove();
      settling.current?.remove();
      const frame = reorder.current?.frame;
      if (frame != null) cancelAnimationFrame(frame);
    },
    [],
  );

  return (
    <>
      <Carousel
        scrollerRef={scrollerRef}
        editing
        size={size}
        rootProps={{
          ...rootProps,
          "data-reordering": dragging ? "" : undefined,
          "data-settling": landing !== null ? "" : undefined,
          "data-pointer-idle": pointerIdle ? "" : undefined,
        }}
      >
        {items.map((item, index) => {
          const key = keys[index];
          const shift = drag?.shifts[index];
          return (
            <figure
              key={key}
              ref={(node: HTMLElement | null) => {
                if (node) slideNodes.current.set(key, node);
                else slideNodes.current.delete(key);
              }}
              className={cx(styles.slide, styles.stack)}
              data-carousel-slide=""
              style={
                {
                  "--slide-aspect": String(mediaSurfaceAspect(item, item)),
                  translate: shift ? `${shift}px 0px` : undefined,
                } as CSSProperties
              }
            >
              <MediaObject
                item={item}
                classes={{
                  root: cx(styles.picture, styles.slot),
                  frame: styles.cell,
                  image: styles.image,
                  backgroundEffect: styles.backgroundEffect,
                }}
                label={`Image ${index + 1}`}
                featured={index === 0}
                onFeature={() => onFeature(index)}
                propertiesOpen={properties.isOpen(index)}
                onToggleProperties={() => properties.toggle(index)}
                onReplace={() => onReplace(index)}
                onRemove={() => onRemove(index)}
                checkered={
                  !item.backgroundEffect && transparentSrcs.has(item.src)
                }
                // Native image drag would hijack the pointer gesture.
                mediaProps={{ draggable: false, autoPlay: whole.has(index) }}
                frameProps={{
                  "data-pressed": pressed?.index === index ? "" : undefined,
                  style:
                    pressed?.index === index
                      ? ({ "--press-origin": pressed.origin } as CSSProperties)
                      : undefined,
                  "data-dragging": drag?.from === index ? "" : undefined,
                  "data-landing": landing === key ? "" : undefined,
                  "data-properties-open": properties.isOpen(index)
                    ? ""
                    : undefined,
                  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
                    if (event.button !== 0 || press.current) return;
                    const cell = event.currentTarget;
                    const media = cell.querySelector<HTMLElement>(MEDIA_TAGS);
                    const slide = slideNodes.current.get(key);
                    if (!media || !slide) return;
                    // Measured before the press scales it.
                    const rect = cell.getBoundingClientRect();
                    const box = slide.getBoundingClientRect();
                    press.current = {
                      index,
                      pointerId: event.pointerId,
                      originX: event.clientX,
                      originY: event.clientY,
                      media,
                      cell,
                      rect,
                      picture: media.getBoundingClientRect(),
                      share: box.width ? (event.clientX - box.left) / box.width : 0.5,
                    };
                    setPressed({
                      index,
                      origin: `${event.clientX - rect.left}px ${event.clientY - rect.top}px`,
                    });
                    // After recording the grab: this throws for a pointer that isn't live (synthetic events).
                    cell.setPointerCapture?.(event.pointerId);
                  },
                  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
                    const held = press.current;
                    if (!held || held.pointerId !== event.pointerId) return;
                    if (!reorder.current) {
                      const travelled = Math.hypot(
                        event.clientX - held.originX,
                        event.clientY - held.originY,
                      );
                      if (travelled < DRAG_THRESHOLD) return;
                      beginDrag(event.clientX, event.clientY);
                    }
                    moveDrag(event.clientX, event.clientY);
                  },
                  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
                    const held = press.current;
                    if (!held || held.pointerId !== event.pointerId) return;
                    finish(true);
                  },
                  onPointerCancel: () => finish(false),
                }}
              />
              {showCaptions && (
                <MediaCaption
                  caption={item.caption}
                  captionStyle={captionStyle}
                  className={styles.caption}
                />
              )}
            </figure>
          );
        })}
        <button
          type="button"
          className={cx(styles.slide, styles.add)}
          data-carousel-slide=""
          onClick={onAddImage}
        >
          <AddIcon aria-hidden />
          Add image
        </button>
      </Carousel>

      {/* Outside the carousel root, whose caret-key handler would otherwise take the panel's keystrokes. */}
      {properties.panel && (
        // Keyed per image, so a reopened panel starts from that picture's values.
        <MediaPropertiesPanel
          key={properties.panel.key}
          {...properties.panel.props}
        />
      )}
    </>
  );
}
