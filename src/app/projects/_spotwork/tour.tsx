"use client";

import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { dialogPanel } from "../../../../styled-system/recipes";
import { AUTHOR } from "@/data/site";
import { NO_EDITS, advance, fromValues, shownStep, toValues, type Edits, type Spot } from "./comment-edits";
import { covered, pointOf, spotAt } from "./comment-spot";
import { TOUR } from "./copy";
import { FROSTED, cardGroundStyle, cardVars, useSheetTuning } from "./sheet-tuning";

// The walk-through: one step at a time, left as a comment pinned to the control it's about, each moved on by doing
// what it asks. The comment sits collapsed to Kartik's avatar until it's hovered, clicked or reached by keyboard.
// Kartik's edits to the comments (comment-editor) apply live and stay in this browser.

export type StepId = (typeof TOUR.steps)[number]["id"];

// Where on its control a step's comment points, as fractions of its box; the top-right corner unless set.
const POINTS: Partial<Record<StepId, { x: number; y: number }>> = { "excuse-late": { x: 0.48, y: 0.77 } };

interface TourState {
  step: StepId;
  done: (step: StepId) => void;
  backTo: (step: StepId) => void;
}

const TourContext = createContext<TourState>({ step: TOUR.steps[0].id, done() {}, backTo() {} });

export function useTour() {
  return useContext(TourContext);
}

interface EditorState {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  edits: Edits;
  setEdits: (update: (edits: Edits) => Edits) => void;
  /** The step the walk-through is at, which an added comment shows with. */
  at: number;
  /** The step whose comment shows. */
  shown: number | null;
  /** Waiting for a press on the app to pin a new comment. */
  placing: boolean;
  setPlacing: (placing: boolean) => void;
  /** The comment added last, for the editor to focus. */
  added: string | null;
}

const EditorContext = createContext<EditorState | null>(null);

export function useCommentEditor() {
  const state = useContext(EditorContext);
  if (!state) throw new Error("useCommentEditor must be used within <TourProvider>.");
  return state;
}

const STORE = "check-ins-prototype:comment-edits";

function stored(): Edits {
  try {
    return fromValues(JSON.parse(localStorage.getItem(STORE) ?? "null")) ?? NO_EDITS;
  } catch {
    return NO_EDITS;
  }
}

const appOf = (root: RefObject<HTMLElement | null>) => root.current?.querySelector("[data-check-ins-app]") ?? null;

/** While `hidden` (Play's demo running), its comments fade out of reach. `comments`: false leaves them out. */
export function TourProvider({
  root,
  hidden = false,
  comments = true,
  children,
}: {
  root: RefObject<HTMLElement | null>;
  hidden?: boolean;
  comments?: boolean;
  children: ReactNode;
}) {
  const [at, setAt] = useState(0);
  const [edits, setEditsState] = useState(stored);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const steps = TOUR.steps;
  const deleted = useMemo(() => (index: number) => !!edits.steps[steps[index].id]?.deleted, [edits, steps]);
  const shown = shownStep(at, steps.length, deleted);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(toValues(edits)));
    } catch {}
  }, [edits]);

  const state = useMemo<TourState>(
    () => ({
      step: steps[at].id,
      done: (step) => setAt((now) => advance(now, steps.findIndex(({ id }) => id === step), steps.length, deleted)),
      backTo: (step) => setAt((now) => Math.min(now, steps.findIndex(({ id }) => id === step))),
    }),
    [at, steps, deleted],
  );

  const editor = useMemo<EditorState>(
    () => ({ editing, setEditing, edits, setEdits: setEditsState, at, shown, placing, setPlacing, added }),
    [editing, edits, at, shown, placing, added],
  );

  // The next press on the app pins a new comment there instead of reaching the app.
  useEffect(() => {
    const dialog = root.current;
    const app = appOf(root);
    if (!placing || !dialog || !app) return;
    dialog.setAttribute("data-placing", "");
    const swallow = (event: Event) => {
      if (!app.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const press = (event: PointerEvent) => {
      if (!app.contains(event.target as Node)) return;
      swallow(event);
      for (const type of ["mousedown", "click"]) document.addEventListener(type, swallow, { capture: true, once: true });
      const spot = spotAt(event.target as Element, event.clientX, event.clientY, app);
      if (spot) {
        const id = `added-${Date.now().toString(36)}`;
        setEditsState((now) => ({ ...now, added: [...now.added, { id, step: steps[at].id, text: "", spot }] }));
        setAdded(id);
      }
      setPlacing(false);
    };
    document.addEventListener("pointerdown", press, true);
    return () => {
      dialog.removeAttribute("data-placing");
      document.removeEventListener("pointerdown", press, true);
    };
  }, [placing, root, at, steps]);

  const spotLocate = (spot: Spot) => () => {
    const app = appOf(root);
    const point = app && pointOf(spot, app);
    return point ? { box: new DOMRect(point.x, point.y, 0, 0), target: point.target } : null;
  };
  const moveStep = (id: StepId) => (spot: Spot) =>
    setEditsState((now) => ({ ...now, steps: { ...now.steps, [id]: { ...now.steps[id], spot } } }));
  const moveAdded = (id: string) => (spot: Spot) =>
    setEditsState((now) => ({ ...now, added: now.added.map((comment) => (comment.id === id ? { ...comment, spot } : comment)) }));

  const step = shown === null ? null : steps[shown];
  const stepSpot = step && edits.steps[step.id]?.spot;
  const stepLocate = (id: StepId) => () => {
    const target = root.current?.querySelector(`[data-tour="${id}"]`);
    if (!target) return null;
    const box = target.getBoundingClientRect();
    const point = POINTS[id];
    return { box: point ? new DOMRect(box.left + point.x * box.width, box.top + point.y * box.height, 0, 0) : box, target };
  };

  return (
    <TourContext value={state}>
      <EditorContext value={editor}>
        {children}
        {comments && step && (
          <Comment
            key={step.id}
            root={root}
            text={edits.steps[step.id]?.text ?? step.body}
            locate={stepSpot ? spotLocate(stepSpot) : stepLocate(step.id)}
            draggable={editing}
            hidden={hidden}
            onMove={moveStep(step.id)}
          />
        )}
        {comments &&
          edits.added
            .filter((comment) => comment.step === steps[at].id)
            .map((comment) => (
              <Comment
                key={comment.id}
                root={root}
                text={comment.text}
                locate={spotLocate(comment.spot)}
                draggable={editing}
                hidden={hidden}
                onMove={moveAdded(comment.id)}
              />
            ))}
      </EditorContext>
    </TourContext>
  );
}

const EDGE = 16;
// Long enough to cross from the pin to the expanded comment.
const LEAVE = 150;

type Across = "right" | "left";
type Along = "up" | "down";
interface Size {
  width: number;
  height: number;
}

/**
 * Where a comment points at `control`, and which way its pin and its expanded card grow from there inside `bounds`.
 * It points at the control's top-right corner, or its bottom-right when the pin has no room above inside `view`, the
 * app's. A card that fits neither way grows toward the larger room and shifts back inside by `dx` and `dy`.
 */
export function aim(control: DOMRect, pin: Size, card: Size, bounds: DOMRect, view = bounds) {
  const top = bounds.top + EDGE;
  const pinAlong: Along = control.top - pin.height >= Math.max(top, view.top) ? "up" : "down";
  const x = control.right;
  const y = pinAlong === "up" ? control.top : control.bottom;
  const right = bounds.right - EDGE - x;
  const left = x - bounds.left - EDGE;
  const up = y - top;
  const down = bounds.bottom - EDGE - y;
  const across: Across = card.width <= right ? "right" : card.width <= left || left > right ? "left" : "right";
  const along: Along = card.height <= up ? "up" : card.height <= down || down > up ? "down" : "up";
  return {
    x,
    y,
    pin: { across: (pin.width <= right ? "right" : "left") as Across, along: pinAlong },
    card: {
      across,
      along,
      dx: across === "right" ? Math.min(0, right - card.width) : Math.max(0, card.width - left),
      dy: along === "up" ? Math.max(0, card.height - up) : Math.min(0, down - card.height),
    },
  };
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// A zero-size box on the point the comment aims at; the pin and the card hang from it. Its pin goes under the About
// sheet's 11, which is in use whenever it covers the pin; open or dragged, it's the one in use and goes over.
const commentStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  zIndex: 10,
  width: 0,
  height: 0,
  "&[data-open], &[data-dragging]": { zIndex: 12 },
});

const DROP = "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)";

// The corner on the point is square, as on a Figma comment, and both grow out of it.
const anchoredStyle = css({
  position: "absolute",
  "&[data-across=right]": { insetInlineStart: 0 },
  "&[data-across=left]": { insetInlineEnd: 0 },
  "&[data-along=up]": { insetBlockEnd: 0 },
  "&[data-along=down]": { insetBlockStart: 0 },
  "&[data-across=right][data-along=up]": { borderEndStartRadius: 0, transformOrigin: "bottom left" },
  "&[data-across=right][data-along=down]": { borderStartStartRadius: 0, transformOrigin: "top left" },
  "&[data-across=left][data-along=up]": { borderEndEndRadius: 0, transformOrigin: "bottom right" },
  "&[data-across=left][data-along=down]": { borderStartEndRadius: 0, transformOrigin: "top right" },
});

// Preflight's `max-width: 100%` resolves against the zero-width point in WebKit and collapses the image.
const avatarStyle = css({
  flexShrink: 0,
  width: "commentAvatar",
  maxWidth: "none",
  height: "commentAvatar",
  borderRadius: "full",
});

// Collapsed, it's in the brand colour.
const pinStyle = css({
  display: "flex",
  padding: "sm",
  borderRadius: "full",
  backgroundColor: "text.highlight",
  boxShadow: DROP,
  cursor: "pointer",
  touchAction: "none",
  opacity: 0,
  transform: "scale(0.5)",
  transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}`,
  "&[data-draggable]": { cursor: "grab" },
  "[data-dragging] > &": { cursor: "grabbing" },
  "[data-placed] > &": { opacity: 1, transform: "none" },
  "[data-placed][data-open] > &": { opacity: 0 },
  _motionReduce: { transition: "none" },
});

const cardStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "md",
  width: "listingColumn",
  padding: "xl",
  visibility: "hidden",
  opacity: 0,
  transform: "scale(0.96)",
  transition: `opacity 150ms ${EASE}, transform 150ms ${EASE}, visibility 150ms`,
  "[data-open] > &": { visibility: "visible", opacity: 1, transform: "none" },
  _motionReduce: { transition: "none" },
});

const bodyStyle = css({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "md",
  minWidth: 0,
  textStyle: "bodySmall",
  color: "text.body",
});

interface Drag {
  fromX: number;
  fromY: number;
  /** The pointer's offset from the comment's point. */
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  moved: boolean;
}

function Comment({
  root,
  text,
  locate,
  draggable,
  hidden,
  onMove,
}: {
  root: RefObject<HTMLElement | null>;
  text: string;
  /** The control's box, or a spot's zero-size box, and the element it's on; null when it isn't on the page. */
  locate: () => { box: DOMRect; target: Element } | null;
  /** Its pin can be dragged to another spot on the app. */
  draggable: boolean;
  hidden: boolean;
  onMove: (spot: Spot) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Opened by a click, until a press elsewhere; or by keyboard focus, until focus leaves.
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pressing = useRef(false);
  const drag = useRef<Drag | null>(null);
  const dropped = useRef(false);
  const point = useRef({ x: 0, y: 0 });
  const locator = useRef(locate);
  const timer = useRef<number>(undefined);
  const id = useId();
  const [tuning] = useSheetTuning();
  const open = !hidden && !dragging && (hovered || held || focused);
  if (hidden && (hovered || held || focused)) {
    setHovered(false);
    setHeld(false);
    setFocused(false);
  }

  useLayoutEffect(() => {
    locator.current = locate;
  });

  // Follows its spot every frame: the app scrolls, overlays ease open and the stage rescales. Hidden while the spot
  // is off the page, scrolled out of the app's view, or under a dialog it isn't in.
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      const node = ref.current;
      const app = appOf(root);
      const bounds = root.current?.querySelector("[data-tour-bounds]")?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
      const moving = drag.current?.moved ? drag.current : null;
      const located = moving ? null : locator.current();
      const control = moving ? new DOMRect(moving.x, moving.y, 0, 0) : located?.box;
      if (node && pin.current && card.current) {
        const view = app?.getBoundingClientRect() ?? bounds;
        const inView =
          !!control &&
          (!!moving ||
            (control.bottom >= view.top &&
              control.top <= view.bottom &&
              control.right >= view.left &&
              control.left <= view.right &&
              !covered(located!.target, control.x + control.width / 2, control.y + control.height / 2)));
        if (control && inView) {
          const size = (element: HTMLElement) => ({ width: element.offsetWidth, height: element.offsetHeight });
          const at = aim(control, size(pin.current), size(card.current), bounds, view);
          point.current = { x: at.x, y: at.y };
          node.style.translate = `${Math.round(at.x)}px ${Math.round(at.y)}px`;
          Object.assign(pin.current.dataset, at.pin);
          Object.assign(card.current.dataset, { across: at.card.across, along: at.card.along });
          card.current.style.translate = `${Math.round(at.card.dx)}px ${Math.round(at.card.dy)}px`;
          node.style.visibility = "";
        } else {
          node.style.visibility = "hidden";
        }
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [root]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!held) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setHeld(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [held]);

  // The overlay's dialog takes Escape first and passes it on as this event (prototype-overlay).
  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const collapse = () => {
      window.clearTimeout(timer.current);
      setHovered(false);
      setHeld(false);
      setFocused(false);
    };
    node.addEventListener("escape-layer", collapse);
    return () => node.removeEventListener("escape-layer", collapse);
  }, [open]);

  // A drag drops the comment on the element under its point; a drop off the app puts it back.
  const release = () => {
    const moving = drag.current;
    drag.current = null;
    setDragging(false);
    if (!moving?.moved) return;
    dropped.current = true;
    const app = appOf(root);
    const target = document.elementsFromPoint(moving.x, moving.y).find((element) => !element.closest("[data-comment]"));
    const spot = app && target ? spotAt(target, moving.x, moving.y, app) : null;
    if (spot) onMove(spot);
  };

  return (
    <div
      ref={ref}
      className={commentStyle}
      data-comment=""
      data-placed={placed && !hidden ? "" : undefined}
      data-open={open ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-escape-layer={open ? "" : undefined}
      inert={hidden}
      onPointerEnter={() => {
        window.clearTimeout(timer.current);
        setHovered(true);
      }}
      onPointerLeave={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHovered(false), LEAVE);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <button
        ref={pin}
        type="button"
        className={cx(anchoredStyle, pinStyle)}
        aria-expanded={open}
        aria-controls={`${id}-comment`}
        aria-labelledby={`${id}-author ${id}-body`}
        data-draggable={draggable ? "" : undefined}
        onPointerDown={(event) => {
          pressing.current = true;
          if (!draggable) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const { x, y } = point.current;
          drag.current = {
            fromX: event.clientX,
            fromY: event.clientY,
            grabX: event.clientX - x,
            grabY: event.clientY - y,
            x,
            y,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const moving = drag.current;
          if (!moving) return;
          if (!moving.moved && Math.hypot(event.clientX - moving.fromX, event.clientY - moving.fromY) < 4) return;
          if (!moving.moved) setDragging(true);
          moving.moved = true;
          moving.x = event.clientX - moving.grabX;
          moving.y = event.clientY - moving.grabY;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onFocus={() => {
          if (!pressing.current) setFocused(true);
        }}
        onClick={() => {
          pressing.current = false;
          if (dropped.current) {
            dropped.current = false;
            return;
          }
          setHeld(true);
        }}
      >
        <Image src={AUTHOR.avatar} alt="" width={24} height={24} className={avatarStyle} />
      </button>
      <div
        ref={card}
        id={`${id}-comment`}
        // The dialog panel's border on the sheets' ground, whose utilities outrank the recipe's fill and corners.
        className={cx(dialogPanel(), cardGroundStyle, anchoredStyle, cardStyle)}
        style={{ ...cardVars(tuning.cards), ...FROSTED } as CSSProperties}
        role="note"
      >
        <Image id={`${id}-author`} src={AUTHOR.avatar} alt={AUTHOR.name} width={24} height={24} className={avatarStyle} />
        {/* Each return in the text starts a paragraph. */}
        <div id={`${id}-body`} className={bodyStyle}>
          {text
            .split(/\n+/)
            .filter((paragraph) => paragraph.trim())
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </div>
    </div>
  );
}
