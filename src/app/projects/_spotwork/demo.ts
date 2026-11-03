"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { travelDurationMs, type DemoCursorTourState } from "@/hooks/use-demo-cursor-tour";
import { isSyntheticPointer, markSyntheticPointer } from "@/utils/synthetic-pointer";

// Play's demo. A stand-in cursor, the site's `DemoCursor`, operates the live app: it presses targets in
// turn, focusing a field so it types itself in, drags for the date strip and the geofence's corners, pinches to zoom a
// map, and points at what lights up on hover. It scrolls each target into view first, its card whole where that fits,
// clear of a snackbar. A real press or key inside the stage ends it, the work done so far kept.

/** Resolved as the cursor sets off, so earlier presses can create later targets. */
export type Target = () => HTMLElement | null;

/**
 * A pause in ms, or a press on `at`, or a drag from `at` to `to`, an element or a point, lasting `ms`, and on through `then`'s
 * legs before it lets go, or with `hover`, a point at `at`
 * until the cursor moves on. `on` is the spot on `at` the cursor goes to, pointed at before it's pressed, where it isn't
 * `at`'s centre. With `pinch`, a trackpad's pinch there instead of a press, its wheel's travel: less than 0 zooms in. A
 * field pressed takes `type`, a character at a time, read as it's pressed. A target not there yet is waited for, unless it's `optional`;
 * `hold` is the pause after it.
 */
export type Step =
  | number
  | {
      at: Target;
      on?: (target: HTMLElement) => Point | null;
      to?: Leg["to"];
      ms?: number;
      then?: Leg[];
      type?: string | (() => string);
      hover?: boolean;
      pinch?: number;
      optional?: boolean;
      hold?: number;
    };

/** A drag's way on to `to`, resolved as it sets off, lasting `ms`. */
type Leg = { to: () => Element | Point | null; ms?: number };

const IDLE: DemoCursorTourState = { point: null, moveMs: 0, pressed: false, taps: 0, visible: false };

const OPENING_MS = 500;
const ENTER_MS = 260;
const SETTLE_MS = 140;
const PRESS_MS = 130;
const HOLD_MS = 340;
const EXIT_MS = 260;
const FINALE_MS = 1200;
const WAIT_MS = 2000;
const POLL_MS = 50;
const SCROLL_MS = 400;
// Kept between what's pressed, or its card, and the edge of the view or a snackbar, where there's room.
const CLEARANCE = 16;
const SWEEP_MS = 900;
const SWEEP_STEP_MS = 32;
const PINCH_MS = 600;
// A drag shorter than this goes past its drop and back, as a hand's does, so an app doesn't take it for a click.
const OVERSHOOT = 8;
const KEY_MS = 40;
const ENTRY_OFFSET = { x: -64, y: 72 };

/** In the window's client pixels. */
export type Point = { x: number; y: number };

const easeInOut = (t: number) => t * t * (3 - 2 * t);

const centreOf = (element: Element): Point => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const typesIn = (element: Element) =>
  element.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]");

/** Whether `node` scrolls what's in it, as it still does where `stillScrollers` clipped it. */
const scrolls = (node: Element) => /auto|scroll/.test(getComputedStyle(node).overflowY) || node.hasAttribute("data-still-scroll");

/**
 * Clips each box in `root` that scrolls, which the demo goes on scrolling: a box that scrolls is a layer of its own, which
 * Safari draws at its full size however small a transform round it shows it.
 */
export function stillScrollers(root: Element) {
  const boxes = [root, ...root.querySelectorAll("*")].filter((box) => {
    const style = getComputedStyle(box);
    return /auto|scroll/.test(style.overflowX + style.overflowY);
  });
  for (const box of boxes) {
    Object.assign((box as HTMLElement).style, { overflowX: "hidden", overflowY: "hidden" });
    box.setAttribute("data-still-scroll", "");
  }
}

/**
 * The band it shows in: inside every box of the stage's that clips it, and above a snackbar over it. Not the page's:
 * a stage partly off screen (a landing card's) mustn't scroll its app, or the page, to show what's past its fold.
 */
function roomOf(element: Element, stage: Element) {
  const box = element.getBoundingClientRect();
  let top = -Infinity;
  let bottom = Infinity;
  // A box that clips it below every scroller round it, as its dialog does, moves with it, so no scroll shows more of it.
  let scrolled = false;
  for (let node = element.parentElement; node; node = node === stage ? null : node.parentElement) {
    if (scrolls(node)) scrolled = true;
    else if (getComputedStyle(node).overflowY === "visible" || !scrolled) continue;
    const clip = node.getBoundingClientRect();
    top = Math.max(top, clip.top);
    bottom = Math.min(bottom, clip.bottom);
  }
  for (const snackbar of element.ownerDocument.querySelectorAll("[role=status]")) {
    const over = snackbar.getBoundingClientRect();
    if (!snackbar.contains(element) && over.left < box.right && over.right > box.left && over.bottom > top) {
      bottom = Math.min(bottom, over.top);
    }
  }
  return { top, bottom };
}

/** What has to show before it's pressed: its card, where the card fits its room, or else itself. */
function frameOf(target: Element, stage: Element) {
  const card = target.closest("[data-card]");
  if (!card) return target;
  const { top, bottom } = roomOf(card, stage);
  return card.getBoundingClientRect().height + 2 * CLEARANCE <= bottom - top ? card : target;
}

/** Scrolls the stage's boxes round it till it shows whole in its room, its top first; whether any moved. */
function scrollIn(element: Element, stage: Element) {
  const room = roomOf(element, stage);
  const box = element.getBoundingClientRect();
  const clearance = Math.min(CLEARANCE, Math.max(0, (room.bottom - room.top - box.height) / 2));
  const headroom = box.top - clearance - room.top;
  let by = headroom < 0 ? headroom : Math.max(0, Math.min(box.bottom + clearance - room.bottom, headroom));
  let moved = false;
  for (let node = element.parentElement; node && Math.abs(by) >= 1; node = node === stage ? null : node.parentElement) {
    if (!scrolls(node)) continue;
    // Its scrollTop is in its own pixels, which a transform round it scales.
    const scale = node.getBoundingClientRect().height / node.offsetHeight || 1;
    const from = node.scrollTop;
    const to = Math.min(Math.max(from + by / scale, 0), node.scrollHeight - node.clientHeight);
    if (Math.abs(to - from) < 1) continue;
    node.scrollTo({ top: to, behavior: "smooth" });
    by -= (to - from) * scale;
    moved = true;
  }
  return moved;
}

// Through the value's own setter, so React hears the input as typed.
function typeInto(field: HTMLElement, text: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

// Mouse pointer 1, so `setPointerCapture` takes it.
function pointer(type: string, at: Point, relatedTarget: Element | null = null, buttons = type === "pointerdown" || type === "pointermove" ? 1 : 0) {
  const init = { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, button: 0, buttons, relatedTarget };
  const event =
    typeof PointerEvent === "function"
      ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true })
      : new MouseEvent(type, init);
  return markSyntheticPointer(event);
}

export function useDemo(stage: RefObject<HTMLElement | null>) {
  const [cursor, setCursor] = useState<DemoCursorTourState>(IDLE);
  const [playing, setPlaying] = useState(false);
  const quit = useRef<(() => void) | null>(null);

  const stop = useCallback(() => quit.current?.(), []);
  useEffect(() => stop, [stop]);

  // `before`, awaited as the cursor reaches each target and before it acts there.
  const play = useCallback(
    (steps: Step[], before?: () => Promise<void>) => {
      quit.current?.();
      const node = stage.current;
      if (!node) return;

      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let held: { target: Element; at: Point } | null = null;
      let pointed: { target: Element; at: Point } | null = null;
      const pointing = (target: Element) => pointed?.target === target;
      const wait = (ms: number) => new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)));

      const release = () => {
        if (held) held.target.dispatchEvent(pointer("pointerup", held.at));
        held = null;
      };
      // Over from its parent and out to it again, as React's enter and leave read a pointer's moves, and moved over it.
      const point = (target: Element, at: Point) => {
        if (!pointing(target)) {
          unpoint();
          const from = target.parentElement;
          from?.dispatchEvent(pointer("pointerout", at, target));
          target.dispatchEvent(pointer("pointerover", at, from));
        }
        target.dispatchEvent(pointer("pointermove", at, null, 0));
        pointed = { target, at };
      };
      const unpoint = () => {
        if (!pointed) return;
        const { target, at } = pointed;
        const to = target.parentElement;
        target.dispatchEvent(pointer("pointerout", at, to));
        to?.dispatchEvent(pointer("pointerover", at, target));
        pointed = null;
      };
      const end = (event?: Event) => {
        if (event && isSyntheticPointer(event)) return;
        cancelled = true;
        clearTimeout(timer);
        release();
        unpoint();
        node.removeEventListener("pointerdown", end);
        node.removeEventListener("keydown", end);
        if (quit.current === end) {
          quit.current = null;
          setPlaying(false);
        }
        setCursor((now) => ({ ...now, pressed: false, visible: false }));
      };
      quit.current = end;
      setPlaying(true);
      node.addEventListener("pointerdown", end);
      node.addEventListener("keydown", end);

      const toStage = (at: Point): Point => {
        const box = node.getBoundingClientRect();
        return { x: at.x - box.left, y: at.y - box.top };
      };

      const find = async <T>(target: () => T | null, optional?: boolean) => {
        for (let waited = 0; ; waited += POLL_MS) {
          const found = target();
          if (found || optional || waited >= WAIT_MS || cancelled) return found;
          await wait(POLL_MS);
        }
      };

      // Steps its own positions: the strip's marquee reads the pointer as it goes. Held down through every leg.
      const sweep = async (from: Element, origin: Point, legs: Leg[]) => {
        held = { target: from, at: origin };
        from.dispatchEvent(pointer("pointerdown", origin));
        let start = origin;
        for (const leg of legs) {
          const to = leg.to();
          if (!to || cancelled) continue;
          const finish = to instanceof Element ? centreOf(to) : to;
          const count = Math.max(1, Math.round((leg.ms ?? SWEEP_MS) / SWEEP_STEP_MS));
          const distance = Math.hypot(finish.x - start.x, finish.y - start.y);
          const way = distance ? { x: (finish.x - start.x) / distance, y: (finish.y - start.y) / distance } : { x: 1, y: 0 };
          const past = Math.max(0, OVERSHOOT - distance);
          for (let step = 1; step <= count && !cancelled; step++) {
            const along = distance * easeInOut(step / count) + past * Math.sin((Math.PI * step) / count);
            const at = step === count ? finish : { x: start.x + way.x * along, y: start.y + way.y * along };
            held = { target: from, at };
            from.dispatchEvent(pointer("pointermove", at));
            setCursor((now) => ({ ...now, point: toStage(at), moveMs: SWEEP_STEP_MS }));
            await wait(SWEEP_STEP_MS);
          }
          start = finish;
        }
        release();
        return start;
      };

      // As Chrome and Firefox send a trackpad's pinch: ctrl held on a wheel, to what's under the pointer.
      const pinch = async (target: Element, at: Point, travel: number) => {
        // An inert stage (a landing card's) isn't hit, so the point can find what's over it: the wheel stays inside.
        const hit = node.ownerDocument.elementFromPoint?.(at.x, at.y);
        const under = hit && node.contains(hit) ? hit : target;
        const count = Math.max(1, Math.round(PINCH_MS / SWEEP_STEP_MS));
        for (let step = 0; step < count && !cancelled; step++) {
          const init = { bubbles: true, cancelable: true, ctrlKey: true, deltaY: travel / count, clientX: at.x, clientY: at.y };
          under.dispatchEvent(new WheelEvent("wheel", init));
          await wait(SWEEP_STEP_MS);
        }
      };

      void (async () => {
        let at: Point | null = null;
        await wait(OPENING_MS);
        for (const step of steps) {
          if (cancelled) return;
          if (typeof step === "number") {
            await wait(step);
            continue;
          }
          const target = await find(step.at, step.optional);
          const far = target && step.to ? await find(step.to) : null;
          if (cancelled) return;
          if (!target || (step.to && !far)) continue;

          const frame = frameOf(target, node);
          if (scrollIn(frame, node)) {
            // Till the scroll comes to rest.
            let last: number | undefined;
            for (let waited = 0; waited < WAIT_MS; waited += POLL_MS) {
              await wait(last === undefined ? SCROLL_MS : POLL_MS);
              if (cancelled) return;
              const { top } = frame.getBoundingClientRect();
              if (top === last) break;
              last = top;
            }
          }
          if (!pointing(target)) unpoint();
          const spot = step.on?.(target) ?? centreOf(target);
          const to = toStage(spot);
          if (!at) {
            at = { x: to.x + ENTRY_OFFSET.x, y: to.y + ENTRY_OFFSET.y };
            setCursor({ ...IDLE, point: at, visible: true });
            await wait(ENTER_MS);
            if (cancelled) return;
          }
          const moveMs = travelDurationMs(Math.hypot(to.x - at.x, to.y - at.y));
          at = to;
          setCursor((now) => ({ ...now, point: to, moveMs }));
          await wait(moveMs + SETTLE_MS);
          if (cancelled) return;
          await before?.();
          if (cancelled) return;
          if (step.hover || step.on) point(target, spot);
          if (step.pinch) await pinch(target, spot, step.pinch);
          if (step.hover || step.pinch) {
            if (cancelled) return;
            await wait(step.hold ?? HOLD_MS);
            continue;
          }

          setCursor((now) => ({ ...now, pressed: true }));
          await wait(PRESS_MS);
          if (cancelled) return;
          if (far) {
            at = toStage(await sweep(target, spot, [{ to: () => far, ms: step.ms }, ...(step.then ?? [])]));
          } else if (step.on) {
            target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: spot.x, clientY: spot.y }));
          } else {
            if (typesIn(target)) {
              target.focus();
              // An inert stage (a landing card's) takes no focus; its field still hears it, from a `focusin` as React does.
              if (document.activeElement !== target) target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
            }
            target.click();
          }
          if (cancelled) return;
          setCursor((now) => ({ ...now, pressed: false, taps: now.taps + 1 }));
          for (const character of (typeof step.type === "function" ? step.type() : step.type) ?? "") {
            await wait(KEY_MS);
            if (cancelled) return;
            typeInto(target, (target as HTMLInputElement).value + character);
          }
          await wait(step.hold ?? HOLD_MS);
        }
        if (cancelled || !at) return end();
        await wait(FINALE_MS);
        unpoint();
        if (cancelled) return;
        setCursor((now) => ({ ...now, visible: false }));
        await wait(EXIT_MS);
        if (!cancelled) end();
      })();
    },
    [stage],
  );

  return { cursor, playing, play, stop };
}
