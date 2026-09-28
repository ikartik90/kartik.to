"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { css } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import {
  blockAt,
  dropSlot,
  slotIndex,
  slotLineY,
  type BlockBox,
} from "@/utils/block-reorder";
import { edgeScrollSpeed } from "@/utils/carousel-reorder";
import { moveItem } from "@/utils/collection-items";
import { beginControlDrag, endControlDrag } from "@/utils/control-drag";
import { animate } from "@/utils/lightbox-motion";
import ReorderIcon from "@/assets/icons/reorder.svg";

/** `sizes.toolbarButton`. */
const HANDLE_SIZE = 28;

/** The handle and its gap to the block (`spacing.lg`). */
const HANDLE_REACH = HANDLE_SIZE + 12;

const TEXT_HOST = '[contenteditable]:not([contenteditable="false"])';

/** Pixels a press must travel to count as a drag. */
const DRAG_THRESHOLD = 4;

const GLIDE_MS = 200;

const EDGE_ZONE = 80;

/** px/ms at the very edge. */
const EDGE_SPEED = 1.5;

const SOURCE_ATTR = "data-reorder-source";
const DRAGGING_ATTR = "data-block-dragging";

const layerStyle = css({
  position: "absolute",
  inset: 0,
  width: "full",
  pointerEvents: "none",
  zIndex: 1,
});

const handleStyle = css({
  position: "absolute",
  marginInlineStart:
    "calc(-1 * (token(sizes.toolbarButton) + token(spacing.lg)))",
  pointerEvents: "auto",
  touchAction: "none",
  color: "text.body",
  cursor: "grab",
  opacity: 0.5,
  transition: "opacity 150ms ease",
  _starting: { opacity: 0 },
  // Held: a carried handle's pointer is rarely over it.
  "&:is(:hover, :active)": { opacity: 1 },
});

const lineStyle = css({
  position: "absolute",
  height: "token(spacing.xs)",
  marginBlockStart: "calc(-1 * token(spacing.xxs))",
  borderRadius: "full",
  backgroundColor: "border.focusRing",
});

const iconStyle = menuIcon();

interface Gesture {
  from: number;
  pointerId: number;
  originX: number;
  originY: number;
  pointerY: number;
  dragging: boolean;
  slot: number | null;
  scroller: Element | null;
  scroll: number;
  frame: number | null;
  last: number | null;
}

function scrollParent(element: Element): Element | null {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if (/auto|scroll/.test(overflowY) && at.scrollHeight > at.clientHeight) {
      return at;
    }
  }
  return document.scrollingElement;
}

/** The middle of an element's first line: its first character's, or an empty field's placeholder's. */
function firstLineMiddle(element: HTMLElement): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent?.search(/\S/) ?? -1;
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + 1);
    // jsdom's Range has no rects.
    const [line] =
      typeof range.getClientRects === "function" ? range.getClientRects() : [];
    if (line) return (line.top + line.bottom) / 2;
  }
  const style = getComputedStyle(element);
  const px = (value: string) => parseFloat(value) || 0;
  const box = element.getBoundingClientRect();
  const top = box.top + px(style.borderTopWidth) + px(style.paddingTop);
  const bottom =
    box.bottom - px(style.borderBottomWidth) - px(style.paddingBottom);
  return (top + bottom) / 2;
}

/** Level with a block's first line of text, an eyebrow's where one sits above it; a figure's caption doesn't count. */
function handleTop(
  element: HTMLElement,
  outer: HTMLElement,
  box: BlockBox,
): number {
  const text = element.matches(TEXT_HOST)
    ? element
    : element.matches("figure")
      ? null
      : element.querySelector<HTMLElement>(TEXT_HOST);
  if (!text) return box.top;
  const line = outer.matches(TEXT_HOST)
    ? outer
    : outer.querySelector<HTMLElement>(TEXT_HOST) ?? text;
  return firstLineMiddle(line) - HANDLE_SIZE / 2;
}

export interface BlockReorderProps {
  /** The editor's block elements by index, each a child of the article or inside one. */
  blocks: () => readonly (HTMLElement | null)[];
  /** The furthest slot a block may drop into; slot `n` is past the last block. */
  lastSlot: number;
  onMove: (from: number, to: number) => void;
  /** A press on a block's handle that never became a drag. */
  onPress: (index: number, handle: HTMLElement) => void;
}

/** A reorder handle beside each hovered or focused block, drawn over the article it sits in. */
export function BlockReorder({
  blocks,
  lastSlot,
  onMove,
  onPress,
}: BlockReorderProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    from: number;
    slot: number | null;
  } | null>(null);
  const [settling, setSettling] = useState(false);
  const handleRefs = useRef(new Map<number, HTMLButtonElement>());
  const lineRef = useRef<HTMLDivElement>(null);

  const article = () => layerRef.current?.parentElement ?? null;

  /** Each block's outermost element: the article's own child. */
  const outers = () => {
    const root = article();
    return blocks().map((element) => {
      let at = element;
      while (at && at.parentElement !== root) at = at.parentElement;
      return at;
    });
  };

  const boxes = (elements: (HTMLElement | null)[]): BlockBox[] =>
    elements.map((element) => {
      if (!element) return { top: 0, bottom: 0, left: 0, right: 0 };
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return { top, bottom, left, right };
    });

  const indexOf = (node: Node | null) => {
    if (!node) return null;
    const index = outers().findIndex((outer) => outer?.contains(node));
    return index < 0 ? null : index;
  };

  // None while the blocks glide: a handle measured mid-glide would be left where the block was.
  const visible = drag
    ? [drag.from]
    : settling
      ? []
      : [...new Set([hovered, focused])].filter(
          (index): index is number => index !== null,
        );

  /** Lays the handles and the drop line over the blocks they belong to, where they are now. */
  const place = () => {
    const root = article();
    if (!root) return;
    const frame = root.getBoundingClientRect();
    const own = blocks();
    const elements = outers();
    const all = boxes(elements);
    for (const [index, handle] of handleRefs.current) {
      const element = own[index];
      const outer = elements[index];
      const box = all[index];
      if (!element || !outer || !box) continue;
      handle.style.top = `${handleTop(element, outer, box) - frame.top}px`;
      handle.style.left = `${box.left - frame.left}px`;
    }
    const line = lineRef.current;
    const source = drag && all[drag.from];
    if (!line || !source || drag.slot === null) return;
    const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
    line.style.top = `${slotLineY(all, drag.slot, gap) - frame.top}px`;
    line.style.left = `${source.left - frame.left}px`;
    line.style.width = `${source.right - source.left}px`;
  };

  // Every render: an edit anywhere above a block moves it.
  useLayoutEffect(place);

  const replace = useEffectEvent(place);

  const hoverAtPointer = () => {
    const point = lastPointer.current;
    setHovered(
      point ? blockAt(boxes(outers()), point.x, point.y, HANDLE_REACH) : null,
    );
  };

  const rehover = useEffectEvent(() => {
    if (!gesture.current) hoverAtPointer();
  });

  const refocus = useEffectEvent((target: Node | null) =>
    setFocused(indexOf(target)),
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      rehover();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      lastPointer.current = null;
      if (!gesture.current) setHovered(null);
    };
    const onScroll = () => {
      rehover();
      replace();
    };
    const onFocusIn = (event: FocusEvent) => refocus(event.target as Node);
    const onFocusOut = (event: FocusEvent) => {
      if (!event.relatedTarget) refocus(null);
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Images loading and blocks growing move everything below them.
  useEffect(() => {
    const root = article();
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => replace());
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const retarget = () => {
    const held = gesture.current;
    if (!held?.dragging) return;
    const slot = Math.min(dropSlot(boxes(outers()), held.pointerY), lastSlot);
    const next = slotIndex(held.from, slot) === null ? null : slot;
    if (next === held.slot) return;
    held.slot = next;
    setDrag({ from: held.from, slot: next });
  };

  function edgeScroll(time: number) {
    const held = gesture.current;
    if (!held?.dragging) return;
    const speed = edgeScrollSpeed({
      at: held.pointerY,
      start: 0,
      end: window.innerHeight,
      zone: EDGE_ZONE,
      max: EDGE_SPEED,
    });
    const scroller = held.scroller;
    if (scroller && speed !== 0 && held.last !== null) {
      // Something else scrolled it: carry on from there.
      if (Math.abs(scroller.scrollTop - held.scroll) > 1) {
        held.scroll = scroller.scrollTop;
      }
      const max = scroller.scrollHeight - scroller.clientHeight;
      held.scroll = Math.max(
        Math.min(held.scroll + speed * (time - held.last), max),
        0,
      );
      scroller.scrollTop = held.scroll;
      retarget();
    }
    held.last = time;
    held.frame = requestAnimationFrame(edgeScroll);
  }

  const begin = (held: Gesture) => {
    held.dragging = true;
    outers()[held.from]?.setAttribute(SOURCE_ATTR, "");
    beginControlDrag(held.pointerId);
    document.documentElement.setAttribute(DRAGGING_ATTR, "");
    const root = article();
    held.scroller = root ? scrollParent(root) : null;
    held.scroll = held.scroller?.scrollTop ?? 0;
    setDrag({ from: held.from, slot: null });
    held.frame = requestAnimationFrame(edgeScroll);
  };

  /** Plays each block from where it was to where the move put it. */
  const glide = (before: BlockBox[], from: number, to: number) => {
    const elements = outers();
    const after = boxes(elements);
    const order = moveItem(
      elements.map((_, index) => index),
      from,
      to,
    );
    return elements.flatMap((element, index) => {
      const was = before[order[index]];
      const dy = was ? was.top - after[index].top : 0;
      if (!element || Math.abs(dy) < 0.5) return [];
      const flight = animate(
        element,
        [{ translate: `0 ${dy}px` }, { translate: "0 0" }],
        { duration: GLIDE_MS, afterPaint: true },
      );
      return flight ? [flight.finished] : [];
    });
  };

  /** Ends the gesture: a drop moves the block into the slot on show, a cancel leaves it. */
  const finish = (commit: boolean) => {
    const held = gesture.current;
    gesture.current = null;
    if (!held) return;
    if (held.frame !== null) cancelAnimationFrame(held.frame);
    if (!held.dragging) {
      const handle = handleRefs.current.get(held.from);
      if (commit && handle) onPress(held.from, handle);
      return;
    }

    endControlDrag(held.pointerId);
    document.documentElement.removeAttribute(DRAGGING_ATTR);
    const elements = outers();
    elements[held.from]?.removeAttribute(SOURCE_ATTR);

    const to =
      commit && held.slot !== null ? slotIndex(held.from, held.slot) : null;
    if (to === null) {
      setDrag(null);
      hoverAtPointer();
      return;
    }
    const before = boxes(elements);
    flushSync(() => {
      setDrag(null);
      setSettling(true);
      onMove(held.from, to);
    });
    void Promise.allSettled(glide(before, held.from, to)).then(() => {
      setSettling(false);
      hoverAtPointer();
    });
  };

  const cancel = useEffectEvent(() => finish(false));
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [dragging]);

  // Unmounting mid-gesture must not leave the page unselectable.
  useEffect(() => () => cancel(), []);

  return (
    <div ref={layerRef} className={layerStyle} data-block-reorder="">
      {visible.map((index) => (
        <Button
          key={index}
          ref={(handle) => {
            if (handle) handleRefs.current.set(index, handle);
            else handleRefs.current.delete(index);
          }}
          aria-label="Reorder block"
          tabIndex={-1}
          className={handleStyle}
          onPointerDown={(event) => {
            if (event.button !== 0 || gesture.current) return;
            // Keeps the caret where it is, and starts no text selection.
            event.preventDefault();
            gesture.current = {
              from: index,
              pointerId: event.pointerId,
              originX: event.clientX,
              originY: event.clientY,
              pointerY: event.clientY,
              dragging: false,
              slot: null,
              scroller: null,
              scroll: 0,
              frame: null,
              last: null,
            };
            // After recording the grab: this throws for a pointer that isn't live (synthetic events).
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const held = gesture.current;
            if (!held || held.pointerId !== event.pointerId) return;
            held.pointerY = event.clientY;
            if (!held.dragging) {
              const travelled = Math.hypot(
                event.clientX - held.originX,
                event.clientY - held.originY,
              );
              if (travelled < DRAG_THRESHOLD) return;
              begin(held);
            }
            retarget();
          }}
          onPointerUp={(event) => {
            if (gesture.current?.pointerId !== event.pointerId) return;
            finish(true);
          }}
          onPointerCancel={() => finish(false)}
        >
          <ReorderIcon className={iconStyle} aria-hidden />
        </Button>
      ))}
      {drag?.slot != null && (
        <div
          ref={lineRef}
          className={lineStyle}
          data-drop-line=""
          aria-hidden
        />
      )}
    </div>
  );
}
