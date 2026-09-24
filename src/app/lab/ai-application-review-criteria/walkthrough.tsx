"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { accentButtonLabelStyle, primaryButtonStyle } from "./parts";
import { ThanksCard } from "./thanks-card";

// ---------------------------------------------------------------------------
// The walkthrough the intro's Start walkthrough begins: the steps of trying the
// prototype, one at a time, each a tip pointing at the control to press next.
// A step is done by doing it, pressing what the tip points at. Each tip counts
// the steps over its title, "1 of 7", and its footer (Figma 154:9031) offers
// Skip, which ends the walkthrough; the last offers Finish instead (155:9063),
// which does what its step asks where there is nothing on the page to press.
// Undoing what a step did goes back to it: closing the drawer goes back to
// opening it. Finished, not skipped, it says thanks (see `ThanksCard`).
//
// A tip is a popover, so it sits in the top layer above every box that clips
// what it points at, and above the drawer once it is written inside it. It is
// placed from where that control is, under it and flush with its end, over
// it where there is no room under it, or beside it where under it would cover
// what the step has just done; and it follows it as the window scrolls or
// resizes.
// ---------------------------------------------------------------------------

export const STEPS = [
  {
    id: "edit-criteria",
    title: "Edit the AI review criteria",
    body: "Open the application criteria form to add a custom review criterion.",
  },
  {
    id: "add-custom",
    title: "Add a custom criterion",
    body: "Select Add criteria > Add custom. The custom prompt will be auto-filled for you.",
  },
  {
    id: "test-criteria",
    title: "Test your criteria",
    body: "Test your criteria on 12 benchmark profiles of your choice with known outcomes. Each test costs 12 credits.",
  },
  {
    id: "review-rewrites",
    title: "Criterion excludes a past hire",
    body: "The test flags a mismatch as the New Logo Acquisition criterion excludes Dana, a past hire, even though her resume reports 42 new accounts won. Select Review suggested rewrites to see reworded alternatives.",
  },
  {
    id: "apply-rewrite",
    title: "Apply the suggested rewrite",
    body: "It refines the criterion to accept a resume that reports new-logo wins in numbers. Applying a rewrite is free.",
  },
  {
    id: "retest-criteria",
    title: "Test the criteria again",
    body: "Retest to confirm the rewrite resolves the mismatches.",
  },
  {
    id: "results-match",
    title: "All results match",
    body: "With the rewrite applied, all 12 results match their known outcomes. These criteria are now ready to evaluate active candidates.",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface WalkthroughState {
  /** The step on screen, if the walkthrough is running. */
  step: StepId | null;
  start: () => void;
  /** The step is done: go on to the next, or finish after the last. */
  done: (step: StepId) => void;
  /** What was done since `step` has been undone: go back to it. */
  backTo: (step: StepId) => void;
  /** The last step is done: the walkthrough ends, and says thanks. */
  complete: () => void;
  /** Skipped: it ends, and that is all. */
  end: () => void;
}

const NOT_RUNNING: WalkthroughState = {
  step: null,
  start() {},
  done() {},
  backTo() {},
  complete() {},
  end() {},
};

// Without a walkthrough around it, a page simply has none running.
const WalkthroughContext = createContext<WalkthroughState>(NOT_RUNNING);

export function Walkthrough({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const [thanking, setThanking] = useState(false);

  function complete() {
    setAt(null);
    setThanking(true);
  }

  const state: WalkthroughState = {
    step: at === null ? null : STEPS[at].id,
    start: () => setAt(0),
    done: (step) => {
      if (at === null || STEPS[at].id !== step) return;
      if (at + 1 < STEPS.length) setAt(at + 1);
      else complete();
    },
    backTo: (step) =>
      setAt((now) => {
        const to = STEPS.findIndex(({ id }) => id === step);
        return now !== null && now > to ? to : now;
      }),
    complete,
    end: () => setAt(null),
  };

  return (
    <WalkthroughContext value={state}>
      {children}
      {thanking && <ThanksCard onClose={() => setThanking(false)} />}
    </WalkthroughContext>
  );
}

/** A picture of the product: whatever controls it draws, no tip points at them. */
export function NoWalkthrough({ children }: { children: ReactNode }) {
  return (
    <WalkthroughContext value={NOT_RUNNING}>{children}</WalkthroughContext>
  );
}

export function useWalkthrough() {
  const walkthrough = useContext(WalkthroughContext);
  return {
    ...walkthrough,
    /** What describes the control a step points at, while the step is on. */
    describe: (step: StepId) =>
      walkthrough.step === step
        ? `${tipId(step)}-heading ${tipId(step)}-body`
        : undefined,
  };
}

function tipId(step: StepId) {
  return `walkthrough-${step}`;
}

// Clear of the window's edges, and of the control it points at.
const EDGE = 16;
const GAP = 12;
// The caret keeps this far from the tip's ends, clear of its rounded corners.
const CARET_INSET = 24;

const tipStyle = css({
  position: "fixed",
  inset: "auto",
  margin: 0,
  overflow: "visible",
  width: "320px",
  maxWidth: "calc(100vw - 32px)",
  padding: 0,
  borderRadius: "12px",
  borderWidth: "var(--cashby-rule)",
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  // A filter rather than a box shadow, so the caret casts one too.
  filter: "drop-shadow(0 0 10px var(--cashby-border))",
  color: "var(--cashby-ink)",
  font: "var(--cashby-text-body)",
  opacity: 0,
  transform: "translateY(4px)",
  transition:
    "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&:popover-open": { opacity: 1, transform: "none" },
  _starting: { "&:popover-open": { opacity: 0, transform: "translateY(4px)" } },
  // Out with the dialog it is written in, as that closes.
  "[data-closing] &": {
    "&:popover-open": {
      opacity: 0,
      transition: "opacity 150ms cubic-bezier(0.64, 0, 0.78, 0)",
    },
  },
});

// A square turned to a point, its centre on the edge facing the control: the
// two sides outlined are the two outside the tip, and the rest covers the
// tip's own outline.
const caretStyle = css({
  position: "absolute",
  width: "12px",
  height: "12px",
  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  transform: "rotate(45deg)",
  "[data-side=below] &": {
    insetBlockStart: "calc(-6px - var(--cashby-rule) / 2)",
    insetInlineStart: "calc(var(--walkthrough-caret) - 6px)",
    borderBlockStartWidth: "var(--cashby-rule)",
    borderInlineStartWidth: "var(--cashby-rule)",
  },
  "[data-side=above] &": {
    insetBlockEnd: "calc(-6px - var(--cashby-rule) / 2)",
    insetInlineStart: "calc(var(--walkthrough-caret) - 6px)",
    borderBlockEndWidth: "var(--cashby-rule)",
    borderInlineEndWidth: "var(--cashby-rule)",
  },
  "[data-side=start] &": {
    insetInlineEnd: "calc(-6px - var(--cashby-rule) / 2)",
    insetBlockStart: "calc(var(--walkthrough-caret) - 6px)",
    borderBlockStartWidth: "var(--cashby-rule)",
    borderInlineEndWidth: "var(--cashby-rule)",
  },
});

const textStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "16px",
});

// The count over the title.
const headingStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const countStyle = css({
  font: "var(--cashby-text-small)",
  color: "var(--cashby-accent)",
});

const titleStyle = css({ font: "var(--cashby-text-card-title)" });

// Skip at its start, or on the last step Finish at its end (Figma 154:9031
// and 155:9063).
const footerStyle = css({
  display: "flex",
  alignItems: "center",
  padding: "12px",
});

const finishStyle = css({ marginInlineStart: "auto" });

// The accent, in no box of its own (Figma 154:9043), and its word in line
// with the tip's: the box reaches out past them into the footer's inset.
const skipStyle = css({
  display: "flex",
  alignItems: "center",
  height: "32px",
  marginInlineStart: "-4px",
  paddingInline: "8px",
  borderRadius: "8px",
  color: "var(--cashby-accent)",
  font: "var(--cashby-text-body-strong)",
  whiteSpace: "nowrap",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
});

// Once nothing that carries the control is moving: the element itself, or any
// box it is in. Only what will finish is waited for.
function settled(control: Element) {
  const moving: Animation[] = [];
  for (let box: Element | null = control; box; box = box.parentElement)
    for (const animation of box.getAnimations?.() ?? [])
      if (Number.isFinite(animation.effect?.getComputedTiming().endTime))
        moving.push(animation);
  return Promise.allSettled(moving.map((animation) => animation.finished));
}

type Side = "below" | "above" | "start";

interface TipProps {
  step: StepId;
  /** What the tip points at: the control the step is done by pressing, unless
   * that is given apart. */
  anchor: RefObject<HTMLElement | null>;
  /** The control the step is done by pressing, where the tip points elsewhere. */
  control?: RefObject<HTMLElement | null>;
  /** Under the control, over it, or before it: where there is room. Under by default. */
  side?: Side;
  /** For a last step with nothing on the page to press: what its Finish does,
   * besides completing the walkthrough. */
  finish?: () => void;
}

export function WalkthroughTip(props: TipProps) {
  const { step: on } = useContext(WalkthroughContext);
  return on === props.step ? <Tip {...props} /> : null;
}

function Tip({
  step,
  anchor,
  control = anchor,
  side = "below",
  finish,
}: TipProps) {
  const { end, complete } = useContext(WalkthroughContext);
  const ref = useRef<HTMLDivElement>(null);
  const finishRef = useRef<HTMLButtonElement>(null);
  // With nothing to press, Finish is what the step asks for.
  const finishes = finish !== undefined;
  const at = STEPS.findIndex(({ id }) => id === step);
  const last = at === STEPS.length - 1;
  const { title, body } = STEPS[at];
  const id = tipId(step);

  // Shown once the control has come to rest (the drawer slides in with it),
  // and placed before it is painted. The control takes the focus, as what the
  // step asks for, unless the caret is in a field: whatever was typed there is
  // the recruiter's to read. While the control has opened what it controls (a
  // menu under it), a dialog is open over it, or the dialog it is in is shut,
  // the tip is out of the way, and back when that changes with the step not
  // done.
  useLayoutEffect(() => {
    const tip = ref.current;
    const target = anchor.current;
    if (!tip || !target) return;
    let live = true;
    let showing = false;

    function update() {
      if (!tip || !target) return;
      // Every dialog here is modal, and one opened from another is inside it,
      // so the last open is the one on top.
      const top = [...document.querySelectorAll("dialog[open]")].at(-1);
      const aside =
        target.getAttribute("aria-expanded") === "true" ||
        (top !== undefined && !top.contains(target)) ||
        target.closest("dialog:not([open])") !== null;
      if (showing === !aside) return;
      showing = !aside;
      if (showing) {
        tip.showPopover();
        place();
      } else tip.hidePopover();
    }

    function place() {
      if (!tip || !target || !showing) return;
      const box = target.getBoundingClientRect();
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      const room = document.documentElement.clientWidth;
      const clamp = (value: number, least: number, most: number) =>
        Math.max(least, Math.min(value, most));
      let left, top, caret;
      if (side === "start" && box.left - GAP - width >= EDGE) {
        // Centred on the control, as far as the top of the window allows.
        const middle = box.top + box.height / 2;
        left = box.left - GAP - width;
        top = Math.max(EDGE, middle - height / 2);
        caret = clamp(middle - top, CARET_INSET, height - CARET_INSET);
        tip.dataset.side = "start";
      } else {
        const over = side === "above" && box.top - GAP - height >= EDGE;
        left = clamp(box.right - width, EDGE, room - EDGE - width);
        top = over ? box.top - GAP - height : box.bottom + GAP;
        caret = clamp(
          box.left + box.width / 2 - left,
          CARET_INSET,
          width - CARET_INSET,
        );
        tip.dataset.side = over ? "above" : "below";
      }
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.setProperty("--walkthrough-caret", `${caret}px`);
    }

    const opened = new MutationObserver(update);
    const moved = new ResizeObserver(place);
    // A frame on, so a dialog opened in the same commit has begun to move.
    const frame = requestAnimationFrame(() => {
      void settled(target).then(() => {
        if (!live) return;
        update();
        if (!document.activeElement?.matches("input, textarea"))
          (finishes ? finishRef : control).current?.focus();
        opened.observe(document.body, {
          subtree: true,
          attributeFilter: ["aria-expanded", "open"],
        });
        moved.observe(document.body);
      });
    });
    addEventListener("resize", place);
    // Whatever scrolls, the control may have gone with it.
    addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      opened.disconnect();
      moved.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, { capture: true });
    };
  }, [anchor, control, side, finishes]);

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-labelledby={`${id}-title`}
      className={tipStyle}
    >
      <div className={textStyle}>
        <hgroup id={`${id}-heading`} className={headingStyle}>
          <p className={countStyle}>
            {at + 1} of {STEPS.length}
          </p>
          <h2 id={`${id}-title`} className={titleStyle}>
            {title}
          </h2>
        </hgroup>
        <p id={`${id}-body`}>{body}</p>
      </div>
      <div className={footerStyle}>
        {!last && (
          <button type="button" className={skipStyle} onClick={end}>
            <span className={accentButtonLabelStyle}>Skip</span>
          </button>
        )}
        {last && (
          <button
            ref={finishRef}
            type="button"
            className={cx(primaryButtonStyle, finishStyle)}
            onClick={() => {
              finish?.();
              complete();
            }}
          >
            Finish
          </button>
        )}
      </div>
      <span aria-hidden className={caretStyle} />
    </div>
  );
}
