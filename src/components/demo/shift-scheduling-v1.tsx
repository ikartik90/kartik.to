"use client";

import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { ShiftFormShell } from "./shift-form-shell";
import { DemoCursor } from "./demo-cursor";
import { DemoControls } from "./demo-controls";
import { DemoInvitation } from "./demo-invitation";
import { Field } from "@/components/ui/input/field";
import { DatePicker } from "@/components/ui/input/datepicker";
import { Switch } from "@/components/ui/input/switch";
import { TextInput } from "@/components/ui/input/text-input";
import { Checkbox } from "@/components/ui/input/checkbox";
import { OptionList } from "@/components/ui/input/option-list";
import { Notice } from "@/components/ui/notice";
import { Wireframe } from "@/components/ui/wireframe";
import { useInView } from "@/hooks/use-in-view";
import { useDemoCursorTour } from "@/hooks/use-demo-cursor-tour";
import { useDemoInvitation } from "@/hooks/use-demo-invitation";
import {
  WEEKDAY_KEYS,
  weekdayOf,
  type WeekdayKey,
} from "@/utils/calendar-month";
import InfoIcon from "@/assets/icons/info.svg";

// ---------------------------------------------------------------------------
// Shift Scheduling v1 — the showcase for the Notice primitive, in the context
// the design gives it: a "Post a Shift" scheduling form (Figma 684:1012 dark /
// 704:1605 light). A registry demo, so it renders bare content — the DemoFrame
// supplies the outer 960×640 bordered canvas surface, and `ShiftFormShell` the
// wireframe dialog chrome it shares with Shift Scheduling v2. Every part but
// the Notice is an existing library component — DatePicker, Switch, and
// OptionList.Toolbar (the weekday selector, used AS a field). The Notice at the
// foot of the form recomposes live from the current selections — its emphasized
// dates/weekdays are the `<strong>` runs the recipe steps up to full accent.
//
// The form reads top-down in two blocks: the shift's DATE, then a card holding
// everything about REPEATING it. The repeat switch is that card's header, and
// the controls it governs sit under a rule inside the same box — so the switch
// visibly owns them, and turning it off collapses the box's contents rather
// than a loose run of fields floating below it.
//
// It opens CLOSED, and once it is properly on screen it opens itself: a
// stand-in cursor walks in, throws the repeat switch, picks out every other
// weekday and dates the last shift far enough ahead to book 25 shifts — then
// clears the run and hands the form over with the card left OPEN, which is the
// state the design is arguing for. Every click is the real control's (see
// `planDemoRecurrence` below), and it plays once, standing down for a visitor
// who asked for less motion, one who has already opened the card, and one who
// touches the form mid-performance. The frame's corner keeps the two controls
// that follow: replay it, or clear it.
// ---------------------------------------------------------------------------

const WEEKDAYS: { key: WeekdayKey; letter: string; name: string }[] = [
  { key: "sun", letter: "S", name: "Sunday" },
  { key: "mon", letter: "M", name: "Monday" },
  { key: "tue", letter: "T", name: "Tuesday" },
  { key: "wed", letter: "W", name: "Wednesday" },
  { key: "thu", letter: "T", name: "Thursday" },
  { key: "fri", letter: "F", name: "Friday" },
  { key: "sat", letter: "S", name: "Saturday" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

// ISO dayOfWeek is 1 (Mon) … 7 (Sun).
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]; // prettier-ignore

/** "Tuesday, 11 August, 2026" — weekday, day, month, year (Figma order). */
function formatFull(date: Temporal.PlainDate): string {
  return `${WEEKDAY_NAMES[date.dayOfWeek - 1]}, ${date.day} ${MONTHS[date.month - 1]}, ${date.year}`;
}

/** Emphasized weekday names joined with commas and a trailing "and". */
function joinDays(names: string[]): ReactNode {
  return names.map((name, i) => (
    <Fragment key={name}>
      {i > 0 && (i === names.length - 1 ? " and " : ", ")}
      <strong>{name}</strong>
    </Fragment>
  ));
}

// The form surface holds two blocks — the shift's date, then the repeating-shift
// card that owns everything about the repeat (Figma 704:1618, gap 12). The
// shell's own padding is the only outer inset.
const formStyle = css({ display: "flex", flexDirection: "column", gap: "lg" });

// The one remaining side-by-side row: the weekday toolbar beside Until. Top-
// aligned, so their labels line up even though only Until carries a hint under
// it.
//
// It WRAPS, because neither half can give: the toolbar is seven fixed 28px
// chips and the date field is a fixed 140px, so a card too narrow for both just
// clips Until against its edge. Wrapping is content-driven — no breakpoint to
// keep in step with the chip count — and the two gaps differ on purpose: 16px
// side by side is the design's (Figma 704:1625), while a wrapped Until drops
// onto the form's own 12px vertical rhythm, the same step that separates this
// row from the Notice under it.
const rowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "xl",
  rowGap: "lg",
  alignItems: "flex-start",
});
const dateFieldStyle = css({ width: "140px", flexShrink: 0 });

// The repeating-shift card (Figma 901:2365). The switch is its header and the
// controls it governs sit under a rule in the SAME box, so the grouping is
// drawn rather than left to be inferred from proximity — which is what the old
// arrangement (switch parked beside the date field, controls loose beneath it)
// asked of the reader.
//
// Its block padding is a balanced 8px: that is the inset the card RESTS at once
// the recurrence folds away. The design's deeper 12px foot is the Notice's
// breathing room rather than the card's, so the extra 4px lives INSIDE the
// collapsing region below and leaves with it.
//
// And deliberately NO gap: the region carries its own top spacing, so that
// spacing folds away WITH it. A card gap would instead survive the whole
// collapse — it only stops applying once `display: none` lands, at the very end
// — and snap the last 8px shut in a single frame.
const repeatCardStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingBlock: "md",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
});

/** The card's header row — the switch, on the same 12px inset as its body. */
const switchRowStyle = css({ paddingInline: "lg" });

// The recurrence block — the card's rule, the weekday toolbar, Until, and
// the Notice — folds away as ONE region when the repeat switch is off, so the
// card resizes instead of snapping. The card's height is content-driven, so it
// simply tracks the region. (The DIALOG's height is held steady by the footer
// counterweight above, which is the one thing here that measures.)
//
// The RULE is inside the region, not above it. A divider that outlived the
// collapse would be a line hanging under a switch with nothing beneath it to
// divide.
//
// Three nested elements, each owning one job:
//
//   • WRAPPER animates the height. `grid-template-rows: 1fr → 0fr` is the only
//     cross-browser way to transition to/from an intrinsic size (`height: auto`
//     needs `interpolate-size`, which is Chromium-only). `display` rides the
//     same transition under `allow-discrete`, so `none` lands at the very END of
//     the collapse and `grid` is restored at the START of the expand.
//   • CLIP supplies the `overflow: hidden` + `min-height: 0` the 0fr row needs to
//     actually crop its content. Safe for the DatePicker: its calendar portals
//     to document.body, so no ancestor clips it.
//   • CONTENT fades and rises 20px, and holds the block's own block spacing.
//
// The halves are deliberately offset so neither direction reads as a jump: on
// exit the content fades first (0→160ms) and the height follows (60→240ms); on
// entry the height opens first (0→180ms) and the content fades in behind it
// (80→240ms). Both directions land together at 240ms. The exit-side timings live
// in the `[data-collapsed='true']` blocks; the base values ARE the entry side.
//
// `@starting-style` is what makes the ENTRY animate at all: an element sitting
// at `display: none` was not rendered on the previous style change, so it has no
// before-change style and the browser starts NO transitions — the expand snaps
// back in a single frame. `_starting` supplies that missing origin (collapsed
// height + faded/raised content). It also fires the first time an element is
// rendered, i.e. on page load, which would play a spurious open animation on
// mount — hence the `[data-armed='true']` gate, false until the switch is first
// touched.
//
// `display: none` is gated on the SAME flag, because the form now opens with the
// card shut and something has to measure the block it is holding space for: an
// element at `display: none` reports nothing at all, so the counterweight's
// reserve would be zero exactly when it is first needed. Before the switch has
// been touched the region is a rendered `grid` at `0fr` instead — which crops
// its content to no height rather than removing it, so it measures true while
// showing nothing. `inert` is what keeps it out of reach either way, so nothing
// is lost by leaving it in the box. From the first interaction onwards
// `display: none` applies as before, and `@starting-style` with it.
const recurrenceStyle = css({
  display: "grid",
  gridTemplateRows: "1fr",
  transitionProperty: "grid-template-rows, display",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "0s",
  transitionBehavior: "allow-discrete",
  "&[data-collapsed='true']": {
    gridTemplateRows: "0fr",
    transitionDelay: "60ms",
  },
  "&[data-armed='true'][data-collapsed='true']": { display: "none" },
  _starting: {
    "&[data-armed='true'][data-collapsed='false']": { gridTemplateRows: "0fr" },
  },
});

const recurrenceClipStyle = css({ minHeight: 0, overflow: "hidden" });

// `paddingBlockStart` is the rule's clearance from the switch row above it;
// `paddingBlockEnd` tops the card's resting 8px up to the 12px the Figma gives
// the Notice. Both are the region's own, so both leave when it does.
const recurrenceContentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  paddingBlockStart: "md",
  paddingBlockEnd: "sm",
  opacity: 1,
  translate: "0 0",
  transitionProperty: "opacity, translate",
  transitionDuration: "160ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "80ms",
  "[data-collapsed='true'] &": {
    opacity: 0,
    translate: "0 -20px",
    transitionDelay: "0s",
  },
  _starting: {
    "[data-armed='true'][data-collapsed='false'] &": {
      opacity: 0,
      translate: "0 -20px",
    },
  },
});

// Full-bleed: the card carries no inline padding of its own, so the rule runs
// edge to edge while its siblings hold their 12px inset (Figma 901:2370). Drawn
// at the card's own 0.5px hairline rather than the 1px the option list's
// divider uses — inside a 0.5px box, a 1px rule outweighs the edge containing
// it.
const dividerStyle = css({
  flexShrink: 0,
  height: "token(spacing.3xs)",
  backgroundColor: "border.divider",
});

// The card's body: everything under the rule, on the same 12px inset as the
// switch row above it.
const recurrenceBodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  paddingInline: "lg",
});

// No gap: the label's line box sits directly above the frame, matching how the
// Field stacks its label over the input — so the weekday toolbar frame lines up
// with the sibling Until input frame (Figma 684:1032 — label y=0, frame y=24).
// The COUNTERWEIGHT — the wireframe block in the footer that takes back exactly
// the space the recurrence gives up (Figma 902:2390). Without it the dialog
// shrinks by the height of the folded block, and since the DemoFrame CENTRES
// the dialog, half of that shrink lands above the switch: the control you just
// clicked slides out from under the pointer.
//
// "Exactly" is the whole trick, and it is why this one block is measured while
// nothing else here is. Hand-fitting a stack of placeholder fields to the
// recurrence's height only holds for one particular sentence — the Notice
// re-wraps from one line to three as weekdays go on and off, moving the target
// 20px at a time. So the reserve is read off the recurrence's own content box
// and handed to this block as `--counterweight`.
//
// The two then cancel FRAME BY FRAME, not just at the ends: `grid-template-rows`
// interpolates a fraction of the same content height, so the region's height is
// linear in that fraction, and mirroring the duration/easing/delay here makes
// this block's height the exact complement at every moment of the transition.
// The delays are the mirror image of the region's — the block opens on the
// region's collapse timings and closes on its expand ones.
//
// Nothing here animates until the switch has been touched, for the same reason
// `@starting-style` is gated on it: the reserve arrives from a layout effect,
// so the FIRST height this block is ever given is a change from zero — and a
// transition on that plays a spurious 180ms open on page load, before anyone
// has asked for anything.
const counterweightStyle = css({
  height: "token(spacing.none)",
  opacity: 0,
  overflow: "hidden",
  transitionProperty: "none",
  transitionDuration: "180ms, 160ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "0s, 0s",
  "&[data-armed='true']": { transitionProperty: "height, opacity" },
  "&[data-open='true']": {
    height: "var(--counterweight, 0px)",
    opacity: 1,
    transitionDelay: "60ms, 80ms",
  },
});

// Padding lives INSIDE the clipped box, so it travels with the block instead of
// outliving it (Figma 902:2466 — 16px sides, 12 over, 4 under).
//
// The two groups are spread rather than stacked on a fixed gap, because the
// space this block has to fill is not a constant: the Figma fitted these fields
// to a two-line Notice, and the sentence runs to one line with no weekdays
// selected and to three with most of them. `space-between` puts that difference
// where it costs nothing — the gap between the note field and the checkboxes —
// instead of at the foot, where a block taller than its box would crop the last
// checkbox in half. The gap is 0, not `lg`: a minimum gap would be added ON TOP
// of the free space and bring the cropping straight back, and the two line
// boxes already hold ~12px of air between their bars without one.
//
// It is sized to the RESERVE, not to `100%` of its parent — and that difference
// is the whole reason the block opens quietly. `space-between` distributes
// whatever is left over after the content, so a percentage height re-runs that
// distribution at every frame of the parent's own height transition: the box
// spends most of the animation shorter than its content (no free space, groups
// packed) and only in the last fifth does slack appear, dropping the two
// checkbox rows 24px in a single step right as the block finishes fading in.
// Pinning the height to the reserve lays the fields out ONCE, at the size they
// will rest at, so the growing box uncovers them instead of re-flowing them.
const counterweightFieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  height: "var(--counterweight, 0px)",
  paddingInline: "xl",
  paddingBlockStart: "lg",
  paddingBlockEnd: "sm",
});

// No gap — two checkbox rows stacked on their own 28px line boxes, the rhythm
// the Figma draws them at (902:2506).
const counterweightChecksStyle = css({
  display: "flex",
  flexDirection: "column",
});

const weekdaysGroupStyle = css({ display: "flex", flexDirection: "column" });

const weekdaysLabelStyle = css({
  textStyle: "bodySmall",
  color: "field.text.muted",
  whiteSpace: "nowrap",
});

const weekdaysFrameStyle = css({
  display: "inline-flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInline: "md",
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
  width: "fit-content",
});

const weekdaysToolbarStyle = css({ gap: "sm" });

const dayChipStyle = css({
  width: "token(sizes.toolbarButton)",
  height: "token(sizes.toolbarButton)",
  padding: "none",
  justifyContent: "center",
  textAlign: "center",
});

// The stage the walkthrough's cursor is placed against. It wraps the whole
// dialog rather than the form surface, for one hard reason: the surface
// `clip-path`s its torn edges, and a clip-path makes a stacking context — a
// cursor inside it could never paint over the date popover it has to point at.
const stageStyle = css({ position: "relative" });

// ---------------------------------------------------------------------------
// The walkthrough.
//
// v1's argument is that recurrence belongs in a SENTENCE, and a sentence only
// makes that case once it is saying something worth reading. So the demo builds
// one: it turns the repeat switch on, picks out every other weekday, and dates
// the last shift far enough out that the run it has just described comes to 25
// shifts — a month and a half of roster, from four chips and two dates. Doing
// that by hand is the work v1 exists to remove, which is why the demo does it
// FOR you and then puts everything back.
// ---------------------------------------------------------------------------

/** Shifts the walkthrough builds up to — a roster, not a token pair. */
const TOUR_SHIFTS = 25;
/** Every OTHER chip in the S M T W T F S row; four is as many as seven allows. */
const TOUR_WEEKDAYS = 4;
/** A beat on the finished sentence before the cursor leaves and it is undone. */
const TOUR_FINALE_MS = 1800;

export interface DemoRecurrencePlan {
  /** Weekdays the run repeats on — the first shift's own weekday leads. */
  weekdays: WeekdayKey[];
  /** The Last Shift date that closes the run on exactly `shifts` shifts. */
  lastShift: Temporal.PlainDate;
}

/**
 * What the walkthrough is going to build, given the date the run opens on.
 *
 * The weekdays alternate ROUND the row from the first shift's own weekday, so
 * the toolbar ends up reading as a pattern rather than as four arbitrary
 * presses — and starting on that weekday means the opening date is already
 * shift one, so the sentence is coherent from the first chip onwards.
 *
 * The end date is then found by counting, not by arithmetic on weeks: whatever
 * `shifts` is asked for and however many weekdays the pattern lands on, the
 * range closes on the day the count is reached.
 */
export function planDemoRecurrence(
  firstShift: Temporal.PlainDate,
  shifts = TOUR_SHIFTS,
): DemoRecurrencePlan {
  const opening = WEEKDAY_KEYS.indexOf(weekdayOf(firstShift));
  const weekdays = Array.from(
    { length: TOUR_WEEKDAYS },
    (_, index) => WEEKDAY_KEYS[(opening + index * 2) % 7],
  );
  const repeats = new Set(weekdays);

  let lastShift = firstShift;
  let counted = 1;
  while (counted < shifts) {
    lastShift = lastShift.add({ days: 1 });
    if (repeats.has(weekdayOf(lastShift))) counted += 1;
  }
  return { weekdays, lastShift };
}

/** Chevron presses to page a calendar showing `from`'s month over to `to`'s. */
export function monthsBetween(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/** The open date popover — portalled to the body, so scoped on the document. */
const DATE_POPOVER = '[role="dialog"][aria-label="Choose date"]';

const WEEKDAY_NAMES_BY_KEY = new Map(
  WEEKDAYS.map((day) => [day.key, day.name]),
);

export function ShiftSchedulingV1() {
  // The form opens on a plausible near-future run rather than on fixed dates:
  // tomorrow through a week later. Read from the clock ONCE and shared by every
  // seed, so they can't land on either side of midnight, and lazily so the read
  // happens at mount rather than on every render.
  const [today] = useState(() => Temporal.Now.plainDateISO());
  // The opening state, kept in one place because two things need it: the seeds
  // below, and every reset — which is defined as "put it back to this".
  const opening = useMemo(() => {
    const firstShift = today.add({ days: 1 });
    return {
      firstShift,
      lastShift: today.add({ days: 8 }),
      // The weekday the first shift itself falls on — the one repeat a shift on
      // that date implies, so the form is already describing something true
      // rather than an arbitrary pair. A SEED only: re-dating the first shift
      // later leaves the toolbar alone, because by then the weekdays are the
      // user's answer and not ours to overwrite.
      days: [weekdayOf(firstShift)] as WeekdayKey[],
    };
  }, [today]);

  const [firstShift, setFirstShift] = useState<Temporal.PlainDate | null>(
    opening.firstShift,
  );
  const [lastShift, setLastShift] = useState<Temporal.PlainDate | null>(
    opening.lastShift,
  );
  // Closed at rest, because the walkthrough's opening move is to OPEN it — and
  // a card that folds itself shut the moment the demo starts would read as a
  // glitch rather than as the first step.
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<Set<WeekdayKey>>(
    () => new Set(opening.days),
  );
  // Arms the recurrence block's @starting-style once the switch is first
  // touched, so the entry animation can't fire on the initial render.
  const [armed, setArmed] = useState(false);

  // How much height the recurrence block takes with it when it folds, for the
  // footer counterweight to take back. Measured on the CONTENT box, which the
  // 0fr row crops rather than squashes, so it reads its natural height for the
  // whole of the collapse — the counterweight is sized correctly at every frame
  // of the transition, not just at the ends.
  //
  // Zero readings are DISCARDED. At rest the region is `display: none`, which
  // reports nothing at all; taking that literally would shrink the
  // counterweight to nothing the instant it was needed, which is the exact
  // layout shift this exists to prevent. The last non-zero reading is by
  // definition the height the block folded away from, so it is the one to keep.
  const recurrenceContentRef = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(0);
  useLayoutEffect(() => {
    const content = recurrenceContentRef.current;
    if (!content) return;
    const measure = () => {
      const height = content.getBoundingClientRect().height;
      if (height > 0) setReserve(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);

  const toggleDay = (key: WeekdayKey) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedNames = WEEKDAYS.filter((d) => days.has(d.key)).map(
    (d) => d.name,
  );
  // Deliberately NOT gated on `repeat`: the Notice now collapses along with the
  // rest of the recurrence block, so folding the clause out on `repeat: false`
  // would only re-flow the sentence under the reader mid-fade. The clause still
  // drops when the block is VISIBLE but no weekday is selected.
  const repeating = selectedNames.length > 0;

  // What the walkthrough is going to build. Planned at mount off the same
  // opening date the form seeds from, so the tour and the form can never
  // disagree about which day the run starts on.
  const tour = useMemo(
    () => planDemoRecurrence(opening.firstShift),
    [opening.firstShift],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  /**
   * Clear the run the walkthrough built and put the dates back.
   *
   * `repeating` is the one thing that is NOT simply "as we found it". Resetting
   * leaves the card OPEN, because open is the state v1 is arguing for — it is
   * what the Figma draws, and it is the only state in which there is anything
   * to play with. A reset that shut the card would hand back a form with one
   * switch in it and make the visitor's first act the same click the
   * walkthrough just demonstrated.
   *
   * Shut is therefore the walkthrough's STARTING position rather than the
   * demo's resting one, which is why replay is the only caller that asks for
   * it: the tour's opening move is to throw that switch, and it needs the
   * switch to have somewhere to go.
   */
  const restore = useCallback(
    (repeating: boolean) => {
      setRepeat(repeating);
      setDays(new Set(opening.days));
      setFirstShift(opening.firstShift);
      setLastShift(opening.lastShift);

      // Focus is part of what has to be handed back. The date picker returns
      // it to its trigger as it closes — right for whoever opened the thing,
      // wrong here, because the walkthrough opened it and the form is left
      // with the Until field wearing its focused frame as though the
      // visitor had tabbed in. Only ever gives up focus that is INSIDE the
      // form: a visitor who pressed Reset is focused on the button, out here,
      // and that focus is theirs to keep.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && stageRef.current?.contains(focused))
        focused.blur();
    },
    [opening],
  );

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    finaleMs: TOUR_FINALE_MS,
    stops: () => {
      const stage = stageRef.current;
      // The visitor has already opened the recurrence, or edited its weekdays.
      // The tour's whole opening move would be undoing that, so it declines —
      // the same call v0 makes over a calendar that already has dates on it.
      if (!stage || repeat || days.size !== 1) return [];

      const inStage = (selector: string) => () =>
        stage.querySelector<HTMLElement>(selector);
      const inPopover = (selector: string) => () =>
        document.querySelector<HTMLElement>(`${DATE_POPOVER} ${selector}`);

      // The calendar opens on whatever Until currently reads, so the
      // chevron presses are counted from there rather than from a fixed month.
      const shown = lastShift ?? opening.lastShift;
      const turns = Math.max(0, monthsBetween(shown, tour.lastShift));

      return [
        // Open the recurrence…
        inStage('[role="switch"]'),
        // …fill in the pattern (its first weekday is already the seeded one)…
        ...tour.weekdays
          .slice(1)
          .map((key) =>
            inStage(
              `[aria-label="Repeat on weekdays"] [aria-label="${WEEKDAY_NAMES_BY_KEY.get(key)}"]`,
            ),
          ),
        // …then date the end of the run, the long way, through the real picker.
        inStage('[data-testid="recurrence"] button[aria-haspopup="dialog"]'),
        ...Array.from({ length: turns }, () =>
          inPopover('button[aria-label="Next month"]'),
        ),
        inPopover(`[data-date="${tour.lastShift}"]:not([data-outside])`),
      ];
    },
    // A walkthrough that left 25 shifts booked would make the visitor's first
    // act undoing someone else's roster. The card stays open behind it: the
    // demo hands over a form you can use, not the blank it started from — and
    // with the page's invitation, if this is the first run on it to finish and
    // there is a cursor on screen to put the words beside.
    onComplete: () => {
      restore(true);
      invitation.offer();
    },
    // The frame scrolled away mid-run, so nobody is being handed anything —
    // and the two states genuinely differ here. Rewind to the card SHUT, which
    // is what the fresh run on the way back needs in order to open it.
    onRewind: () => restore(false),
  });

  // Replay rewinds to the walkthrough's own starting position — card SHUT, so
  // its first click has something to open — and every one of its clicks
  // TOGGLES, so running it over finished work would only take it apart again.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    restore(false);
    replayTour();
  }, [restore, replayTour]);

  // Reset calls off a performance in flight as well as clearing the run —
  // otherwise the tour's remaining clicks would put it straight back.
  const reset = useCallback(() => {
    stopTour();
    restore(true);
  }, [stopTour, restore]);

  // Is there a run on the form for reset to clear? The DATES and the weekday
  // pattern answer that, measured against the seed the form opened on.
  //
  // The repeat switch is deliberately not part of it, and that is the one thing
  // worth spelling out: reset does not put the switch back either — it always
  // hands the card over OPEN, because open is the state v1 is arguing for. So a
  // switch that had a say here would make the demo dirty in both directions and
  // for nothing. On load, with the card shut by design, it would offer a reset
  // whose only effect was opening a card nobody had touched; after a finished
  // run, with the card left open, it would offer one that changed nothing at
  // all. What the visitor can actually pile up is chips and dates, and that is
  // exactly what this reads.
  const dirty =
    !firstShift?.equals(opening.firstShift) ||
    !lastShift?.equals(opening.lastShift) ||
    days.size !== opening.days.length ||
    !opening.days.every((key) => days.has(key));

  return (
    <>
      <div className={stageStyle} ref={stageRef}>
        <ShiftFormShell
          footerFill={
            <div
              className={counterweightStyle}
              data-testid="repeat-counterweight"
              data-open={!repeat}
              data-armed={armed}
              style={{ "--counterweight": `${reserve}px` } as CSSProperties}
            >
              {/* The rest of the "Post a Shift" form, as a shape — the same
              treatment v0 gives its field column, and for the same reason: the
              point is that the dialog is still the same size, not what these
              particular fields say. `Wireframe` makes the whole block inert and
              aria-hidden, so it is scenery in every sense. */}
              <Wireframe className={counterweightFieldsStyle} opacity={25}>
                <TextInput
                  label="Additional Notes"
                  defaultValue="Anything the team should know"
                  hint="Visible to everyone rostered on this shift"
                />
                <div className={counterweightChecksStyle}>
                  <Field>
                    <Checkbox />
                    <Field.Label>
                      Notify the team when this shift is posted
                    </Field.Label>
                  </Field>
                  <Field>
                    <Checkbox />
                    <Field.Label>
                      Let staff swap this shift with a colleague
                    </Field.Label>
                  </Field>
                </div>
              </Wireframe>
            </div>
          }
        >
          {/* Interactive scheduling section — the real components + the Notice. */}
          <div className={formStyle}>
            <Field className={dateFieldStyle}>
              {/* One name, switch or no switch. Turning the repeat on adds a
                  SECOND date to the form; it does not turn this one into
                  something else, and relabelling it under the pointer made the
                  field the visitor had just filled in look like it had. */}
              <Field.Label>Shift Date</Field.Label>
              <DatePicker value={firstShift} onValueChange={setFirstShift} />
              <Field.Hint>dd/mm/yyyy</Field.Hint>
            </Field>

            <div className={repeatCardStyle} data-testid="repeat-card">
              <div className={switchRowStyle}>
                <Field size="lg">
                  <Switch
                    checked={repeat}
                    onCheckedChange={(next) => {
                      setArmed(true);
                      setRepeat(next);
                    }}
                  />
                  <Field.Label>Repeat this shift on other days</Field.Label>
                </Field>
              </div>

              <div
                className={recurrenceStyle}
                data-testid="recurrence"
                data-collapsed={!repeat}
                data-armed={armed}
                inert={!repeat}
              >
                <div className={recurrenceClipStyle}>
                  <div
                    className={recurrenceContentStyle}
                    ref={recurrenceContentRef}
                  >
                    <div
                      className={dividerStyle}
                      data-testid="repeat-divider"
                    />

                    <div className={recurrenceBodyStyle}>
                      <div className={rowStyle}>
                        <div className={weekdaysGroupStyle}>
                          <span className={weekdaysLabelStyle}>
                            Repeat Every Week On
                          </span>
                          <div className={weekdaysFrameStyle}>
                            <OptionList direction="inline">
                              <OptionList.Toolbar
                                aria-label="Repeat on weekdays"
                                className={weekdaysToolbarStyle}
                              >
                                {WEEKDAYS.map((day, i) => (
                                  <OptionList.Option
                                    key={`${day.key}-${i}`}
                                    pressed={days.has(day.key)}
                                    aria-label={day.name}
                                    className={dayChipStyle}
                                    onClick={() => toggleDay(day.key)}
                                  >
                                    {day.letter}
                                  </OptionList.Option>
                                ))}
                              </OptionList.Toolbar>
                            </OptionList>
                          </div>
                        </div>
                        <Field className={dateFieldStyle}>
                          <Field.Label>Until</Field.Label>
                          <DatePicker
                            value={lastShift}
                            onValueChange={setLastShift}
                          />
                          <Field.Hint>dd/mm/yyyy</Field.Hint>
                        </Field>
                      </div>

                      {/* The star of the showcase — a live, self-describing Notice. */}
                      <Notice role="status" aria-live="polite">
                        <Notice.Icon>
                          <InfoIcon />
                        </Notice.Icon>
                        <Notice.Label>
                          {repeating && lastShift ? (
                            <>
                              This shift will repeat every{" "}
                              {joinDays(selectedNames)} between{" "}
                              <strong>
                                {firstShift ? formatFull(firstShift) : "—"}
                              </strong>{" "}
                              and <strong>{formatFull(lastShift)}</strong>
                            </>
                          ) : (
                            <>
                              This shift will start on{" "}
                              <strong>
                                {firstShift ? formatFull(firstShift) : "—"}
                              </strong>
                            </>
                          )}
                          .
                        </Notice.Label>
                      </Notice>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ShiftFormShell>

        {/* A sibling of the dialog, not a child of the clipped form surface —
          see `stageStyle`. Last, so it paints over what it is pointing at. */}
        <DemoCursor {...cursor} />
        <DemoInvitation {...invitation} />
      </div>

      {/* Outside the shell, so it pins to the FRAME's corner rather than the
          dialog's — and outside the stage, so pressing one is not mistaken for
          the visitor reaching into the form mid-performance. */}
      <DemoControls
        onPlay={replay}
        // Stops the run where it stands and keeps its work — the same break-in
        // touching the form already performs, offered as a control.
        onStop={stopTour}
        running={cursor.running}
        onReset={reset}
        resettable={dirty && !cursor.running}
      />
    </>
  );
}
