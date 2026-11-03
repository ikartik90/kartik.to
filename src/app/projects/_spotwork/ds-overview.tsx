"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { useDismiss } from "@/hooks/use-dismiss";
import { DESIGN_SYSTEM, GUIDELINE_SECTIONS, SNACKS, type Guideline } from "./copy";
import { sheetBodyStyle } from "./dashboard-sheet";
import { DAY } from "./data";
import { ActionStack, CheckInPill, Table } from "./data-table";
import { ProgressBar, type ProgressTone } from "./data-viz";
import { certificateCard, spendingCard } from "./ds-card";
import { riskFactorCard, spotscoreChart } from "./ds-data-viz";
import { ABREAST, alone } from "./ds-data-table";
import { exampleName, fileOf } from "./ds-code";
import { dateSelector } from "./ds-filter";
import { dashboardTabs } from "./ds-tab";
import { SEGMENTED_CONTROL } from "./ds-form";
import { StateColors, UnitExamples } from "./ds-foundations";
import { TIMESHEET_ACTIONABLE, statusChip } from "./ds-form-more";
import { NOTIFICATION_PANE } from "./ds-navigation";
import { ACTION_BAR, CHECK_IN, CHECK_IN_NOTES, WORKER_HOURS_DIALOG, postedHoursCard } from "./ds-overlay";
import { ExampleBox, type Story } from "./ds-story";
import { Div } from "./ds-tailwind";
import { DsGroup, DsPage, floorRaw } from "./ds-ui";
import { PasswordInput } from "./form-parts";
import { Multiselect } from "./multiselect";
import { createFlow, paneCorners, type Placed, type Point, type Size } from "./montage-flow";
import { logoRaw } from "./navigation";
import { DatePicker } from "./shift-calendar";
import { Snackbar } from "./shifts-page";
import { TimePicker } from "./time-picker";
import { Button, Card, Chip, Field, LabelValuePair, Presence, SegmentedControl, SideSheet, Typography, useEscapeLayer } from "./ui";
import LogoIcon from "./assets/logo.svg";
import ChevronRightIcon from "./assets/icons/medium/chevron-right.svg";
import SuccessIcon from "./assets/icons/small/success.svg";

// The design system's front pages: its overview, a landing page of cards beside a montage of its components, and its
// guidelines, a card for each section with an intro that opens its groups in a side sheet, then the other sections.

const landingStyle = css({ display: "grid", gridTemplateColumns: "1fr 2fr", height: "100%" });

const sideStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  minHeight: 0,
  padding: "var(--sw-padding-3xl)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset -1px 0 0 var(--sw-border-subdued)",
});

/** Blue Ribbon's 800, 700 and 600 in rings from a box's corner, changing at 33% and 66% of the way to the far corner. */
export const BANNER_RINGS =
  "radial-gradient(circle at 0 0, var(--sw-colors-blue-ribbon-800) 33%, var(--sw-colors-blue-ribbon-700) 0 66%, var(--sw-colors-blue-ribbon-600) 0)";

// For its code alone: SW Curie's Button takes no UNSAFE_className, which marks a style the system doesn't offer.
const OverriddenButton = Button as ComponentType<ComponentProps<typeof Button> & { UNSAFE_className: string }>;

/** The rings as Tailwind's arbitrary value, its spaces as underscores. */
const RINGS_CLASS = `bg-[${BANNER_RINGS.replace(/,\s+/g, ",").replaceAll(" ", "_")}]`;

/** A Get started button in the rings, and its code, which passes them through `UNSAFE_className`. */
export const OVERRIDDEN_BUTTON = {
  specimen: <Button style={{ backgroundImage: BANNER_RINGS }}>Get started</Button>,
  code: <OverriddenButton UNSAFE_className={RINGS_CLASS}>Get started</OverriddenButton>,
};

// Figma's Project Cover at 3:2 across the column, past its padding to its edges, in its rings; the logo over the
// system's name.
const bannerStyle = css({
  position: "relative",
  isolation: "isolate",
  display: "flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  width: "calc(100% + 2 * var(--sw-padding-3xl))",
  aspectRatio: "3 / 2",
  overflow: "hidden",
  marginBlockStart: "calc(-1 * var(--sw-padding-3xl))",
  marginInline: "calc(-1 * var(--sw-padding-3xl))",
  color: "var(--sw-glyph-inverted-default)",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    zIndex: -1,
    background: BANNER_RINGS,
  },
});

// The name ends under the logo's end, at Figma's ratio of name to logo.
const lockupStyle = css(logoRaw, {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "var(--sw-gap-xs)",
  "& > svg": { height: "2.5rem", width: "auto" },
  "& > svg path": { fill: "currentColor" },
});

// A press anywhere on the card is its title's; pointed at, it fills with Surface/Active without its rule, as Figma's
// hovered records do.
const cardStyle = css({
  position: "relative",
  gap: "var(--sw-gap-xxs)",
  "&:has(button:hover)": { backgroundColor: "var(--sw-hover-shade)", boxShadow: "none" },
  "&:has(button:focus-visible)": { outline: "2px solid var(--sw-outline-focus)" },
  "& h2 > button": {
    textAlign: "start",
    _focusVisible: { outline: "none" },
    "&::after": { content: '""', position: "absolute", inset: 0 },
  },
  // A chevron at the heading's end, as Settings' navigation records end in theirs.
  "& h2": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" },
  "& h2 > svg": { flexShrink: 0 },
});

// Figma's cover (368:13473): its live components where it sets them, tilted 30° as one over the dotted floor, its
// window's centre on the pane's; inside the tilt, a track that carries them up its columns.
const montageStyle = css(floorRaw, {
  position: "relative",
  overflow: "hidden",
  backgroundColor: "var(--sw-surface-subdued)",
  "& > div": {
    position: "absolute",
    insetInlineStart: "50%",
    insetBlockStart: "50%",
    transformOrigin: "0 0",
    // Its translate is montage-flow.ts's OFFSET.
    transform: "scale(var(--montage-scale, 1)) translate(-22.0625rem, -67.75rem) rotate(30deg)",
  },
  "& > div > div": { position: "absolute", insetInlineStart: 0, insetBlockStart: 0 },
  "& > div > div > div": { position: "absolute" },
  // A cell's ground under a piece that has none of its own.
  "& > div > div > [data-surface]": {
    paddingBlock: "var(--sw-padding-md)",
    paddingInline: "var(--sw-padding-sm)",
    backgroundColor: "var(--sw-surface-default)",
  },
  // Every piece still, as Figma draws it.
  "& > div > div > div *, & > div > div > div *::before, & > div > div > div *::after": {
    animation: "none !important",
    transition: "none !important",
  },
  // A badge's letters as laid out: tilted, it can't find the middle of their ink.
  "& [data-badge] > span": { translate: "none !important" },
});

// Sections as far apart as a component page's examples, a section's groups closer, a group's cards closer still.
const guidelinesStyle = css({ display: "flex", flexDirection: "column", gap: "calc(2 * var(--sw-gap-3xl))" });

const guidelineSectionStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-3xl)" });

// The cards that open a section's sheet, abreast.
const sheetCardsStyle = css({ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--sw-gap-xl)" });

const guidelineCardsStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "var(--sw-gap-xl)",
  "& > :not([data-abreast])": { gridColumn: "1 / -1" },
  "&[data-stacked]": { gridTemplateColumns: "minmax(0, 1fr)" },
});

// A card's title and text, one row of its subgrid.
const guidelineHeadStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-sm)" });

const guidelineTextStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

const inlineCodeStyle = css({
  paddingInline: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--sw-surface-subdued)",
  fontFamily: "jetbrainsMono",
  color: "var(--sw-glyph-default)",
});

/** `` ` ``-marked names as code. */
function coded(text: string): ReactNode {
  return text.split("`").map((part, i) => (i % 2 ? <code key={i} className={inlineCodeStyle}>{part}</code> : <Fragment key={i}>{part}</Fragment>));
}

// Each card's part, given how many components there are; `open` is a page's id or a component's Figma name.
// Components opens on the sidebar's first component.
const cards = (components: Story[]) => [
  { title: DESIGN_SYSTEM.guidelines, line: DESIGN_SYSTEM.cards.guidelines, open: "guidelines" },
  { title: DESIGN_SYSTEM.foundations, line: DESIGN_SYSTEM.cards.foundations, open: "colors" },
  { title: DESIGN_SYSTEM.components, line: DESIGN_SYSTEM.cards.components(components.length), open: components[0].figma },
];

const SHIFT_TIME = "09:00AM–05:00 PM";

/** A day's shift on the Shifts page, its places filled in `tone`. */
const shiftCell = (title: string, tone: ProgressTone) =>
  alone(
    "11rem",
    <Table.Cell>
      <Typography variant="body">{title}</Typography>
      <Typography variant="metadata" color="subdued">
        {SHIFT_TIME}
      </Typography>
      <ProgressBar fill value={18} max={30} tone={tone}>
        <Typography variant="metadata" color="subdued">
          18/30
        </Typography>
        <Typography variant="metadata" color="subdued">
          Filled
        </Typography>
      </ProgressBar>
    </Table.Cell>,
  );

/** A day on the Timesheet: its hours' chip over its shift's times. */
const dayCell = (status: keyof typeof TIMESHEET_ACTIONABLE) =>
  alone(
    "8.5rem",
    <Table.Cell>
      {statusChip(TIMESHEET_ACTIONABLE[status])}
      <Typography variant="metadata" color="subdued">
        {SHIFT_TIME}
      </Typography>
    </Table.Cell>,
  );

const CONDITIONS = [
  "Adverse Environmental Conditions",
  "Cold Environment",
  "Cold Storage Jumpsuit",
  "Dusty Environment",
  "Extreme Noise Levels",
  "Hazardous Chemicals",
  "Hot Environment",
  "Messy Environment",
];

const SEGMENTS = ["Documents", "Equipment", "Licenses", "Validations"];

// Figma's pieces, each at its place before the tilt (its top, or where it ends), in its order, the last on top. The
// Notes overlay stands in Figma's messenger's place, as far from the hours dialog, the Shift Date and the Action Bar as
// the pickers are apart (72px); the Action Bar sits left of Figma's place to make room. Its table cells (`filler`) also
// plug the flow's pits that nothing coming fits.
type Piece = { width?: number; surface?: true; filler?: true; piece: ReactNode };

const MONTAGE: (Piece & { left: number; top?: number; bottom?: number })[] = [
  {
    left: 1114,
    top: 374,
    width: 455,
    piece: (
      <Field data-active="">
        <Field.Label>Password</Field.Label>
        <PasswordInput defaultValue="forkliftyard" defaultMasked>
          <PasswordInput.Conditions>
            <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
            <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
            <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
            <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
            <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
          </PasswordInput.Conditions>
        </PasswordInput>
      </Field>
    ),
  },
  {
    left: 223,
    top: 572,
    piece: dateSelector({ defaultOpen: true }),
  },
  {
    left: 423,
    top: 548,
    piece: (
      <Field>
        <Field.Label>Shift End</Field.Label>
        <TimePicker since={15 * 60} defaultValue={DAY} defaultOpen />
      </Field>
    ),
  },
  {
    left: 695,
    top: 532,
    piece: (
      <Field>
        <Field.Label>Shift Date</Field.Label>
        <DatePicker defaultValue="2023-11-30" today="2023-11-03" from={null} defaultOpen defaultView="month" />
        <Field.HintText>mm/dd/yyyy</Field.HintText>
      </Field>
    ),
  },
  {
    left: 1088,
    top: 578,
    width: 400,
    piece: (
      <Div tw="flex h-[17.5rem] flex-col">
        <Field tone="alert">
          <Field.Label>Skills &amp; requirements</Field.Label>
          <Multiselect>
            {CONDITIONS.map((condition) => (
              <Multiselect.Option key={condition}>{condition}</Multiselect.Option>
            ))}
          </Multiselect>
          <Field.HintText>Select at least one skill</Field.HintText>
        </Field>
      </Div>
    ),
  },
  { left: 482, bottom: 460, piece: CHECK_IN_NOTES },
  {
    left: 1188,
    top: 929,
    width: 325,
    piece: (
      <Card>
        <Card.Header>
          <Typography tag="h3" variant="subheading">Spotscore</Typography>
        </Card.Header>
        {spotscoreChart("status")}
      </Card>
    ),
  },
  { left: 1585, top: 929, filler: true, piece: dayCell("Confirmed") },
  { left: 418, top: 963, width: 325, piece: certificateCard("Passport", "Feb 3, 2026") },
  { left: 1114, top: 0, piece: WORKER_HOURS_DIALOG.examples[0].render() },
  {
    left: 7,
    top: 908,
    piece: (
      <SegmentedControl size="small" defaultValue="Validations">
        {SEGMENTS.map((segment) => (
          <SegmentedControl.Segment key={segment} value={segment}>
            {segment}
          </SegmentedControl.Segment>
        ))}
      </SegmentedControl>
    ),
  },
  { left: 803, top: 964, width: 325, piece: certificateCard("Work Permit", "Nov 16, 2024", true) },
  { left: 358, top: 1146, filler: true, piece: shiftCell("Holiday Special All Days", "high") },
  { left: 593, top: 1146, filler: true, piece: shiftCell("Morning Shift (M/W/F)", "full") },
  { left: 828, top: 1181, piece: postedHoursCard(true) },
  {
    left: 536,
    top: 1330,
    filler: true,
    piece: alone(
      "13.75rem",
      <Table.Cell>
        <CheckInPill status="Checked In" />
        <Div tw={ABREAST}>
          <Typography variant="metadata" color="subdued">
            08:11 PM
          </Typography>
          <Chip size="small" state="warning">+11 Minutes</Chip>
        </Div>
      </Table.Cell>,
    ),
  },
  { left: 536, top: 1479, filler: true, piece: dayCell("Worker Submitted") },
  {
    left: 153,
    top: 996,
    filler: true,
    piece: alone(
      "12.5rem",
      <Table.Cell>
        <ActionStack>
          <ActionStack.Secondary>
            <Button size="small" emphasis="secondary">
              <SuccessIcon aria-hidden />
              Confirm 45h 15m
            </Button>
          </ActionStack.Secondary>
        </ActionStack>
        <Typography variant="metadata" color="subdued">
          7 Shifts • 2 Adjusted • 1 Absent
        </Typography>
      </Table.Cell>,
    ),
  },
  { left: -205, top: 420, piece: ACTION_BAR.examples[0].render() },
];

// The system's own components that flow in after the cover's, each as its page's first example draws it unless given
// its `piece` (an overlay without the button that opens it on its page, a chart in its card), on a cell's ground where
// it has none.
const MORE: { id: string; width?: number; surface?: true; piece?: ReactNode }[] = [
  // Held, where its page shows it coming and going.
  {
    id: "Snackbar",
    piece: (
      <Snackbar onClose={() => {}}>
        {SNACKS.invitationSent}
        <Snackbar.Close />
      </Snackbar>
    ),
  },
  { id: "Spider Chart", width: 672, piece: riskFactorCard() },
  { id: "Switch", surface: true },
  { id: "Profile Overview Card" },
  // As wide as the dashboard's page beside its open sidebar, in the 1440px frame.
  { id: "Tab Group", width: 1112, piece: dashboardTabs() },
  { id: "Manual Check-in", piece: CHECK_IN },
  { id: "Stepper" },
  { id: "Bar Chart", width: 344, piece: spendingCard() },
  { id: "Verification Code Input" },
  { id: "Notifications", piece: NOTIFICATION_PANE },
  { id: "Tags Field" },
  { id: "Risk Matrix", surface: true },
  { id: "Dropdown" },
  { id: "Range Selector" },
  { id: "Applicant Selector" },
  { id: "Type-ahead" },
  { id: "File Upload", surface: true },
  { id: "Popover Menu" },
];

// Figma's cover's window at full size, and the pieces' places, in px at a 16px root.
const COVER = { width: 1239, height: 927 };
const rem = (px?: number) => (px === undefined ? undefined : `${px / 16}rem`);

// How fast the montage travels up its columns, in its own px a second, and how far it ever goes.
const SPEED = 28;
const DISTANCE = 1_000_000;

/** The root's size over 16px, and the montage's scale with the cover's window fitted into `node`. */
function fitOf(node: HTMLElement) {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
  return { root, scale: Math.min(node.clientWidth / (COVER.width * root), node.clientHeight / (COVER.height * root)) };
}

const unsubscribed = () => () => {};

/** Where `piece` shows on screen, with any panel hanging out of it, but not what's hidden or clipped. */
function inkOf(piece: Element) {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (element: Element, clips: boolean) => {
    const box = element.getBoundingClientRect();
    if (box.width && box.height) {
      [left, top] = [Math.min(left, box.left), Math.min(top, box.top)];
      [right, bottom] = [Math.max(right, box.right), Math.max(bottom, box.bottom)];
    }
    if (clips || element instanceof SVGElement) return;
    for (const child of element.children) {
      const style = getComputedStyle(child);
      if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0")
        walk(child, style.overflowX !== "visible" || style.overflowY !== "visible");
    }
  };
  walk(piece, false);
  return { left, top, right, bottom };
}

/** A piece's place: a cover piece's own as Figma sets it, or where the flow packed what shows of it, `offset` into it. */
function placeOf({ key, x, y }: Pick<Placed, "key" | "x" | "y">, offset: Point = { x: 0, y: 0 }): CSSProperties {
  const cover = MONTAGE[key];
  if (!cover) return { left: rem(x - offset.x), top: rem(y - offset.y) };
  return cover.top === undefined
    ? { left: rem(cover.left), top: rem(cover.bottom), translate: "0 -100%" }
    : { left: rem(cover.left), top: rem(cover.top) };
}

/**
 * Figma's cover, its whole window scaled into its pane, travelling up its columns with `components` flowing in after
 * it and coming round again; still for reduced motion.
 */
function Montage({ components }: { components: Story[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () => [
      ...MONTAGE,
      ...MORE.flatMap(({ id, width, surface, piece }) => {
        const story = components.find((one) => one.id === id);
        return story ? [{ width, surface, piece: piece ?? story.examples[0].render() }] : [];
      }),
    ],
    [components],
  );
  const moves = useSyncExternalStore(
    unsubscribed,
    () => typeof Element.prototype.animate === "function",
    () => false,
  );
  // What shows of each piece, and how far that is into its box.
  const [measured, setMeasured] = useState<{ view: Point[]; seeds: Placed[]; sizes: Size[]; offsets: Point[] } | null>(null);
  const [shown, setShown] = useState<Placed[] | null>(null);
  // The pieces past the cover's, drawn once unseen to be measured for the flow.
  const staged = moves && !reduced && !measured;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => node.style.setProperty("--montage-scale", String(fitOf(node).scale));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    const tilt = track.current?.parentElement;
    if (!staged || !node || !track.current || !tilt) return;
    const { root, scale } = fitOf(node);
    // Untilted for the moment it's measured, in its own px however the window round it is scaled.
    tilt.style.transform = "none";
    const origin = track.current.getBoundingClientRect();
    const unit = (node.getBoundingClientRect().width / node.offsetWidth) * root;
    const boxes = [...track.current.children].map((piece) => {
      const own = piece.getBoundingClientRect();
      const ink = inkOf(piece);
      return {
        box: {
          x: (ink.left - origin.left) / unit,
          y: (ink.top - origin.top) / unit,
          width: (ink.right - ink.left) / unit,
          height: (ink.bottom - ink.top) / unit,
        },
        offset: { x: (ink.left - own.left) / unit, y: (ink.top - own.top) / unit },
      };
    });
    tilt.style.transform = "";
    setMeasured({
      view: paneCorners({ width: node.clientWidth / root, height: node.clientHeight / root }, scale),
      seeds: MONTAGE.map((_, i) => ({ ...boxes[i].box, piece: i, key: i })),
      sizes: boxes.map(({ box }) => ({ width: box.width, height: box.height })),
      offsets: boxes.map(({ offset }) => offset),
    });
  }, [staged]);

  useEffect(() => {
    const node = ref.current;
    if (!measured || reduced || !node || !track.current) return;
    const order = [...pieces.keys()].slice(MONTAGE.length).concat([...MONTAGE.keys()]);
    const fillers = [...pieces.keys()].filter((piece) => pieces[piece].filler);
    const flow = createFlow({ view: measured.view, seeds: measured.seeds, sizes: measured.sizes, order, fillers });
    const animation = track.current.animate(
      { transform: ["translateY(0)", `translateY(${-DISTANCE / 16}rem)`] },
      { duration: (DISTANCE / SPEED) * 1000, fill: "forwards" },
    );
    let seen = true;
    const tick = () => {
      // Still while nobody can see it: off-screen, in a hidden tab, or under a modal dialog it isn't in.
      const covered = [...document.querySelectorAll("dialog:modal")].some((dialog) => !dialog.contains(node));
      if (seen && !document.hidden && !covered) animation.play();
      else animation.pause();
      const near = flow.step((SPEED * Number(animation.currentTime)) / 1000);
      setShown((last) => (last?.length === near.length && last.every((one, i) => one.key === near[i].key) ? last : near));
    };
    const observer = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      tick();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", tick);
    const timer = setInterval(tick, 500);
    return () => {
      animation.cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", tick);
      clearInterval(timer);
      setShown(null);
    };
  }, [measured, reduced, pieces]);

  const items = shown ?? MONTAGE.map((_, i) => ({ key: i, piece: i, x: 0, y: 0 }));
  const pieceOf = (key: string | number, piece: number, style: CSSProperties) => (
    <div
      key={key}
      style={{ ...style, width: rem(pieces[piece].width) }}
      data-surface={pieces[piece].surface ? "" : undefined}
      data-montage-piece=""
    >
      {pieces[piece].piece}
    </div>
  );
  // An open panel hangs into the room kept for it below its field.
  return (
    <div ref={ref} className={montageStyle} data-montage="" data-popover-room="" inert>
      <div>
        <div ref={track}>
          {items.map(({ key, piece, x, y }) => pieceOf(key, piece, placeOf({ key, x, y }, measured?.offsets[piece])))}
          {staged && [...pieces.keys()].slice(MONTAGE.length).map((piece) => pieceOf(`staged ${piece}`, piece, { opacity: 0 }))}
        </div>
      </div>
    </div>
  );
}

/**
 * A landing page across the window: Figma's cover and a card for each part, beside a montage of the components,
 * which are `components`, in the sidebar's order.
 */
export function OverviewPage({ onOpen, components }: { onOpen: (page: string) => void; components: Story[] }) {
  return (
    <div className={landingStyle}>
      <div className={sideStyle}>
        <div className={bannerStyle}>
          <div className={lockupStyle}>
            <LogoIcon aria-hidden />
            <Typography tag="h1" variant="bodyLarge">
              {DESIGN_SYSTEM.name}
            </Typography>
          </div>
        </div>
        {cards(components).map((card) => (
          <Card key={card.open} className={cardStyle}>
            <Typography tag="h2" variant="heading">
              <button type="button" onClick={() => onOpen(card.open)}>
                {card.title}
              </button>
              <ChevronRightIcon aria-hidden />
            </Typography>
            <Typography tag="p" variant="body" color="subdued">
              {card.line}
            </Typography>
          </Card>
        ))}
      </div>
      <Montage components={components} />
    </div>
  );
}

/** `specimen`, and the code of `code` in the file `name`s, on tabs across its card's end. */
function GuidelineExample({ name, specimen, code = specimen }: { name: string; specimen: ReactNode; code?: ReactNode }) {
  return <ExampleBox specimen={specimen} code={fileOf(exampleName(name), code)} tabbed bleed />;
}

// What a card shows beneath its words, by its title and the paragraph each follows.
const FIGURES: Record<string, Record<number, ReactNode>> = {
  "Colours in OKLCH": { 0: <StateColors label="Colours in OKLCH" /> },
  "Sizes in rems, edges in pixels": { 0: <UnitExamples unit="rem" />, 1: <UnitExamples unit="px" /> },
  // The Segmented Control's first example, a `Field` round its parts.
  "Composition from owned parts": { 1: <GuidelineExample name={SEGMENTED_CONTROL.id} specimen={SEGMENTED_CONTROL.examples[0].render()} /> },
  "Component contracts": { 0: <GuidelineExample name="Button" {...OVERRIDDEN_BUTTON} /> },
};

/**
 * Guidelines' cards, a row each but those `abreast`, three across, or all `stacked`; each titled as `tag` over its
 * paragraphs, a figure under any paragraph that has one, with its example (if any) last, each part level with the same
 * part in the cards beside it.
 */
function GuidelineCards({ cards, tag, stacked }: { cards: Guideline[]; tag: "h2" | "h3" | "h4"; stacked?: boolean }) {
  return (
    <div className={guidelineCardsStyle} data-stacked={stacked ? "" : undefined}>
      {cards.map((card) => {
        const figures = FIGURES[card.title] ?? {};
        // Its paragraphs in runs, each but the last closed by a figure.
        const runs = card.text.split("\n\n").reduce<string[][]>(
          (all, paragraph, i) => {
            all.at(-1)!.push(paragraph);
            if (figures[i]) all.push([]);
            return all;
          },
          [[]],
        );
        const text = (run: string[]) =>
          run.length > 0 && (
            <div key={run[0]} className={guidelineTextStyle}>
              {run.map((paragraph) => (
                <Typography key={paragraph} tag="p" variant="body" color="subdued">
                  {coded(paragraph)}
                </Typography>
              ))}
            </div>
          );
        return (
          <Card key={card.title} subgrid data-abreast={card.abreast ? "" : undefined}>
            <div className={guidelineHeadStyle}>
              <Typography tag={tag} variant="subheading">
                {card.title}
              </Typography>
              {text(runs[0])}
            </div>
            {Object.values(figures).map((figure, i) => [<Fragment key={i}>{figure}</Fragment>, text(runs[i + 1])])}
            {card.example && (
              <LabelValuePair>
                <Typography variant="metadata" color="subdued">
                  {DESIGN_SYSTEM.example}
                </Typography>
                <Typography tag="p" variant="body">
                  {card.example}
                </Typography>
              </LabelValuePair>
            )}
          </Card>
        );
      })}
    </div>
  );
}

type GuidelineSection = (typeof GUIDELINE_SECTIONS)[number];

/** A section's groups, each under its own heading over its cards' `h4`s; a group without one, its cards' `h3`s. */
function GuidelineGroups({
  section,
  stacked,
  level = 3,
  target,
}: {
  section: GuidelineSection;
  stacked?: boolean;
  level?: 2 | 3;
  /** The group the page was sent to. */
  target?: string;
}) {
  const tag = level === 2 ? "h2" : "h3";
  const under = level === 2 ? "h3" : "h4";
  return section.groups.map((group) =>
    group.title ? (
      <DsGroup key={group.title} title={group.title} tag={tag} targeted={group.title === target}>
        <GuidelineCards cards={group.cards} tag={under} stacked={stacked} />
      </DsGroup>
    ) : (
      <GuidelineCards key={section.title} cards={group.cards} tag={tag} stacked={stacked} />
    ),
  );
}

/** A section's groups down a small side sheet, under its title and intro; another section's card fills it from the top. */
function GuidelineSheet({ section, height, onClose }: { section: GuidelineSection; height: number; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [section.title]);
  useDismiss({ ref: sheet, onDismiss: onClose, dismissOnOutsidePointer: false });
  // In the overlay, its window takes Escape first and passes it on.
  useEscapeLayer(sheet, true, onClose);
  return (
    <SideSheet ref={sheet} size="small" label={section.title} style={{ height }} onClose={onClose} data-escape-layer="">
      <SideSheet.Header>
        <Typography variant="heading">{section.title}</Typography>
        <SideSheet.Close />
        <Typography variant="body" color="subdued">
          {section.intro}
        </Typography>
      </SideSheet.Header>
      <div ref={body} className={sheetBodyStyle}>
        <GuidelineGroups section={section} stacked />
      </div>
    </SideSheet>
  );
}

const SHEETS = GUIDELINE_SECTIONS.filter((section) => section.intro);
const SECTIONS = GUIDELINE_SECTIONS.filter((section) => !section.intro);

/**
 * The guidelines in the Check-ins page's column, a section's sheet over the window's end, `height` tall, in `layer`,
 * and the group named `target` marked.
 */
export function GuidelinesPage({ layer, height, target }: { layer: HTMLElement | null; height: number; target?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = SHEETS.find((section) => section.title === open);
  return (
    <DsPage title={DESIGN_SYSTEM.guidelines} centred>
      <div className={guidelinesStyle}>
        <div className={sheetCardsStyle}>
          {SHEETS.map((section) => (
            <Card key={section.title} className={cardStyle}>
              <Typography tag="h2" variant="heading">
                <button
                  type="button"
                  data-sheet-trigger=""
                  aria-haspopup="dialog"
                  aria-expanded={open === section.title}
                  onClick={() => setOpen(open === section.title ? null : section.title)}
                >
                  {section.title}
                </button>
                <ChevronRightIcon aria-hidden />
              </Typography>
              <Typography tag="p" variant="body" color="subdued">
                {section.intro}
              </Typography>
            </Card>
          ))}
        </div>
        {SECTIONS.map((section) => (
          <section key={section.title} className={guidelineSectionStyle} aria-label={section.title}>
            <GuidelineGroups section={section} level={2} target={target} />
          </section>
        ))}
      </div>
      {layer &&
        createPortal(
          <Presence>
            {shown && <GuidelineSheet section={shown} height={height} onClose={() => setOpen(null)} />}
          </Presence>,
          layer,
        )}
    </DsPage>
  );
}
