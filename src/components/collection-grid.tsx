"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { css } from "../../styled-system/css";
import { collectionGrid } from "../../styled-system/recipes";
import { MediaObject } from "@/components/media-object";
import { MediaPropertiesPanel } from "@/components/media-properties-panel";
import { useMediaProperties } from "@/hooks/use-media-properties";
import {
  COLLECTION_MAX_ITEMS,
  mediaRadiusPx,
  type CollectionItem,
  type MediaNode,
} from "@/domain/nodes";
import { useImageTransparency } from "@/hooks/use-image-transparency";
import AddIcon from "@/assets/icons/add.svg";

const gridStyles = collectionGrid({ layout: "uniform" });
const emptyCellStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "sm",
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  borderRadius: "xl",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  backgroundColor: "bg.itemHover",
  appearance: "none",
  color: "field.text.default",
  textStyle: "bodySmall",
  cursor: "pointer",
  userSelect: "none",
  transition:
    "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
  "& svg": {
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
    flexShrink: 0,
    display: "block",
  },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]": { fill: "currentColor" },
  "&:hover": { backgroundColor: "bg.button.secondary.hover" },
  "&:active": {
    backgroundColor: "field.bg.active",
    color: "field.text.active",
  },
  "html[data-keyboard-focus] &": {
    "&:focus-visible": {
      boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
    },
  },
});

/** Pixels a press must travel to count as a drag. */
const DRAG_THRESHOLD = 4;

const MEDIA_TAGS = "img, video";

/** Must match the `collectionArrive` keyframe's duration in panda.config.ts. */
const LANDING_MS = 100;

const LANDING_EASE = "ease-out";

// Horizontal travel only, since it overshoots past 1. The stops are the source curve's rescaled by
// 1/0.576 to drop its flat tail, so retime at LANDING_MS, never here.
const LANDING_TRANSLATE_EASE_X =
  "linear(0, 0.029 2.26%, 0.119 4.86%, 0.659 15.1%, 0.871 20.14%, 1.009 25.35%, 1.052 28.13%, 1.078 31.08%, 1.088 34.2%, 1.085 37.67%, 1.014 54.51%, 0.993 65.97%, 1)";

// Vertical travel leads the horizontal, bending the drop into an arc; only the horizontal overshoots.
const LANDING_TRANSLATE_EASE_Y = "cubic-bezier(0.05, 0.7, 0.1, 1)";

export interface CollectionGridProps {
  items: CollectionItem[];
  /** The editor's showcase-media contract, so a collection navigates like an image block. */
  rootProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  onFeature: (index: number) => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAddImage: () => void;
  /** Swaps two slots. */
  onReorder: (from: number, to: number) => void;
  /** Panel edits, which ride the debounce; the intents above are each one undo step. */
  onItemsChange: (items: MediaNode[]) => void;
}

export function CollectionGrid({
  items,
  rootProps,
  onFeature,
  onReplace,
  onRemove,
  onAddImage,
  onReorder,
  onItemsChange,
}: CollectionGridProps) {
  const properties = useMediaProperties(items, onItemsChange);

  // Pictures only: the scan decodes with `new Image()`, which a clip would fail.
  const transparentSrcs = useImageTransparency(
    items.filter((item) => item.kind === "image").map((item) => item.src),
  );

  // Pointer events, not HTML5 drag-and-drop, whose bitmap and fly-back can't be controlled.
  // The source index is in a ref too: handlers can't rely on React committing between events.
  const dragIndexRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState<{
    index: number;
    origin: string;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  /** The pointer hasn't moved since a drag ended, so the overlay stays down until it does. */
  const [pointerIdle, setPointerIdle] = useState(false);
  /** Where the pointer came to rest, so a pointermove at the same spot doesn't count as a move. */
  const restPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPoint = useRef({ x: 0, y: 0 });
  const [arrivingIndex, setArrivingIndex] = useState<number | null>(null);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // State is swapped at once, so during the flight `target` keeps showing its old photo (`cover`)
  // and `vacated` stays empty until the clone lands.
  const [landing, setLanding] = useState<{
    target: number;
    cover: CollectionItem;
    vacated: number;
  } | null>(null);

  const pending = useRef<{
    index: number;
    pointerId: number;
    originX: number;
    originY: number;
    media: HTMLElement;
    cell: HTMLElement;
    /** Measured at the press, before its scale; measuring later would shrink the clone twice. */
    rect: DOMRect;
  } | null>(null);
  const preview = useRef<HTMLElement | null>(null);
  const settling = useRef<HTMLElement | null>(null);
  const grab = useRef({ x: 0, y: 0 });

  // Hit-tested by rect, not `elementFromPoint`: the preview sits under the cursor and capture retargets events.
  const cellNodes = useRef(new Map<number, HTMLElement>());

  const cellIndexAt = (x: number, y: number) => {
    for (const [index, node] of cellNodes.current) {
      const r = node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return index;
      }
    }
    return null;
  };

  const translateFor = (clientX: number, clientY: number) =>
    `${clientX - grab.current.x}px ${clientY - grab.current.y}px`;

  const beginDrag = (clientX: number, clientY: number) => {
    const held = pending.current;
    if (!held) return;

    const rect = held.rect;
    grab.current = { x: held.originX - rect.left, y: held.originY - rect.top };

    const node = held.media.cloneNode(true) as HTMLElement;
    node.className = gridStyles.dragPreview;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    // The inline `cqw` corner would resolve against the viewport once on <body>: an inset picture
    // gets it in pixels, and a filling one has it cleared so the `dragPreview` class applies.
    const carried = items[held.index];
    node.style.borderRadius = carried?.padding
      ? `${mediaRadiusPx(carried, rect.width)}px`
      : "";
    // A cloned <video> isn't muted (React never writes the attribute), so mute it and match the playhead.
    if (node instanceof HTMLVideoElement && held.media instanceof HTMLVideoElement) {
      node.muted = true;
      node.currentTime = held.media.currentTime;
      void node.play()?.catch(() => {});
    }
    // `cloneNode` doesn't copy a canvas's buffer, so the shader rides along as a still background,
    // snapshotted before `setDragIndex` hides the cell; a lost context reads back nothing.
    const gradient = held.cell.querySelector<HTMLCanvasElement>(
      "[data-background-effect] canvas",
    );
    if (gradient) {
      try {
        node.style.backgroundImage = `url("${gradient.toDataURL()}")`;
        node.style.backgroundSize = "100% 100%";
      } catch {
        // Nothing to carry — the photo travels on its own.
      }
    }
    node.style.translate = translateFor(clientX, clientY);
    node.style.transformOrigin = `${grab.current.x}px ${grab.current.y}px`;
    // Marked before insertion, so it's born mid-press with no transition to play.
    node.dataset.carried = "";
    // On <body>, so no ancestor clips it.
    document.body.appendChild(node);
    preview.current = node;

    dragIndexRef.current = held.index;
    setDragIndex(held.index);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    lastPoint.current = { x: clientX, y: clientY };
    if (preview.current) {
      preview.current.style.translate = translateFor(clientX, clientY);
    }
    const over = cellIndexAt(clientX, clientY);
    setDropIndex(over === dragIndexRef.current ? null : over);
  };

  /** Flies the carried photo into its target cell before handing back to the grid; returns whether it flew. */
  const settleInto = (
    target: number,
    cover: CollectionItem,
    vacated: number,
  ) => {
    const node = preview.current;
    if (!node) return false;
    // Detached first: whatever ends the drag must not yank it mid-flight.
    preview.current = null;

    const cell = cellNodes.current.get(target);
    const to = (cell?.querySelector(MEDIA_TAGS) ?? cell)?.getBoundingClientRect();
    if (!to || typeof node.animate !== "function") {
      node.remove();
      return false;
    }

    settling.current?.remove();
    settling.current = node;
    setLanding({ target, cover, vacated });

    // Read BEFORE either animation starts — once one is running with
    // `fill: forwards`, the computed values are the animation's own.
    const held = getComputedStyle(node);
    const from = {
      translate: node.style.translate,
      scale: held.scale || "1",
      rotate: held.rotate || "0deg",
    };

    // Each axis animates separately with `composite: "add"`, summing deltas onto the inline translate,
    // so the two easings bend the path; a third animation settles everything else.
    const [fromX, fromY] = from.translate
      .split(" ")
      .map((value) => parseFloat(value) || 0);
    const travel = (dx: number, dy: number, easing: string) =>
      node.animate([{ translate: "0px 0px" }, { translate: `${dx}px ${dy}px` }], {
        duration: LANDING_MS,
        easing,
        fill: "forwards",
        composite: "add",
      });

    const flight = travel(to.left - fromX, 0, LANDING_TRANSLATE_EASE_X);
    travel(0, to.top - fromY, LANDING_TRANSLATE_EASE_Y);
    node.animate(
      [
        {
          scale: from.scale,
          rotate: from.rotate,
          width: node.style.width,
          height: node.style.height,
        },
        {
          scale: "1",
          rotate: "0deg",
          width: `${to.width}px`,
          height: `${to.height}px`,
          boxShadow: "none",
        },
      ],
      { duration: LANDING_MS, easing: LANDING_EASE, fill: "forwards" },
    );
    let timer: ReturnType<typeof setTimeout> | null = null;
    const land = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      // Commit the swap synchronously before removing the clone, or a frame paints between and both photos flash.
      // Guarded because a second drag may own the state by now.
      flushSync(() => {
        setLanding((current) => (current?.target === target ? null : current));
        markArriving(vacated);
      });
      node.remove();
      if (settling.current === node) settling.current = null;
    };
    flight.onfinish = land;
    flight.oncancel = land;
    // Backstop: `onfinish` may never fire for an animation that finishes in a hidden tab.
    timer = setTimeout(land, LANDING_MS + 60);
  };

  /** Marks the slot the dragged photo left; cleared again, since the CSS animation only replays on re-adding. */
  const markArriving = (index: number) => {
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    setArrivingIndex(index);
    arriveTimer.current = setTimeout(() => {
      setArrivingIndex(null);
      arriveTimer.current = null;
    }, LANDING_MS + 60);
  };

  const endDrag = () => {
    // Only a real drag parks the cursor; a bare press keeps the hover it asked for.
    if (dragIndexRef.current !== null) {
      restPoint.current = { ...lastPoint.current };
      setPointerIdle(true);
    }
    pending.current = null;
    dragIndexRef.current = null;
    preview.current?.remove();
    preview.current = null;
    setPressed(null);
    setDragIndex(null);
    setDropIndex(null);
  };

  useEffect(() => {
    if (dragIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") endDrag();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragIndex]);

  // On the document: leaving the grid is a move too.
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

  // Unmounting mid-gesture must not leave a photo parented to <body>.
  useEffect(
    () => () => {
      preview.current?.remove();
      settling.current?.remove();
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
    },
    [],
  );

  const slots = Array.from({ length: COLLECTION_MAX_ITEMS }, (_, index) =>
    landing?.target === index ? landing.cover : (items[index] ?? null),
  );

  return (
    <>
    <div
      {...rootProps}
      className={gridStyles.root}
      data-collection-grid=""
      data-reordering={
        pressed !== null || dragIndex !== null ? "" : undefined
      }
      data-pointer-idle={pointerIdle ? "" : undefined}
    >
      {slots.map((item, index) =>
        item ? (
          // Keyed by slot, not photo, so a swap never rebuilds the cells mid-gesture.
          <MediaObject
            key={index}
            item={item}
            classes={{
              root: gridStyles.slot,
              frame: gridStyles.cell,
              image: gridStyles.image,
              backgroundEffect: gridStyles.backgroundEffect,
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
            mediaProps={{
              // Native image drag would hijack the pointer gesture.
              draggable: false,
            }}
            frameProps={{
              ref: (node: HTMLDivElement | null) => {
                if (node) cellNodes.current.set(index, node);
                else cellNodes.current.delete(index);
              },
              "data-pressed": pressed?.index === index ? "" : undefined,
              style:
                pressed?.index === index
                  ? ({ "--press-origin": pressed.origin } as CSSProperties)
                  : undefined,
              "data-dragging":
                dragIndex === index || landing?.vacated === index ? "" : undefined,
              "data-drop-target": dropIndex === index ? "" : undefined,
              "data-arriving": arrivingIndex === index ? "" : undefined,
              "data-landing": landing?.target === index ? "" : undefined,
              "data-properties-open": properties.isOpen(index) ? "" : undefined,
              onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
                if (event.button !== 0) return;
                const media = (event.target as HTMLElement).closest(MEDIA_TAGS);
                if (!media) return;
                // Measured before the press scales it.
                const rect = media.getBoundingClientRect();
                pending.current = {
                  index,
                  pointerId: event.pointerId,
                  originX: event.clientX,
                  originY: event.clientY,
                  media: media as HTMLElement,
                  cell: event.currentTarget,
                  rect,
                };
                setPressed({
                  index,
                  origin: `${event.clientX - rect.left}px ${event.clientY - rect.top}px`,
                });
                // After recording the grab: this throws for a pointer that isn't live (synthetic events).
                event.currentTarget.setPointerCapture?.(event.pointerId);
              },
              onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
                const held = pending.current;
                if (!held || held.pointerId !== event.pointerId) return;
                if (dragIndexRef.current === null) {
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
                const held = pending.current;
                if (!held || held.pointerId !== event.pointerId) return;
                if (dragIndexRef.current !== null) {
                  const to = cellIndexAt(event.clientX, event.clientY);
                  if (to !== null && to !== held.index) {
                    // Order matters: fly before `endDrag` clears the preview, and read `items[to]` before `onReorder` swaps it.
                    const flew = settleInto(to, items[to], held.index);
                    onReorder(held.index, to);
                    if (!flew) markArriving(held.index);
                  }
                }
                endDrag();
              },
              onPointerCancel: endDrag,
            }}
          />
        ) : (
          <button
            key={index}
            type="button"
            className={emptyCellStyle}
            onClick={onAddImage}
          >
            <AddIcon aria-hidden />
            Add Media
          </button>
        ),
      )}
    </div>

    {/* Outside the grid root, whose caret-key handler would otherwise take the panel's keystrokes. */}
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
