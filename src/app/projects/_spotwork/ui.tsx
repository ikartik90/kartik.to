"use client";

import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  createElement,
  type ComponentProps,
  type CSSProperties,
  type FC,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../../styled-system/css";
import type { SystemStyleObject } from "../../../../styled-system/types";
import { Skeleton, Wireframe, useWireframe } from "@/components/ui/wireframe";
import { useControllable } from "./controllable";
import type { Status, Tier } from "./data";
import { scrolls } from "./demo";
import { useCentredInk } from "./ink";
import { placeBeside, placeOverlay, type Side } from "./placement";
import { misplaced, ownPart, partsOf, restOf, useOwner } from "./slots";
import { useTypedNote } from "./typed-note";
import TooltipArrow from "./assets/tooltip-arrow.svg";
import TickIcon from "./assets/tick.svg";
import ChipTickIcon from "./assets/icons/medium/tick.svg";
import RemoveIcon from "./assets/icons/small/cross.svg";
import RadioDotIcon from "./assets/icons/medium/radio-switch.svg";
import RadioDotSmallIcon from "./assets/icons/small/radio-switch.svg";
import StarsSuper from "./assets/stars-super.svg";
import StarsPro from "./assets/stars-pro.svg";
import StarsElite from "./assets/stars-elite.svg";
import WarningIcon from "./assets/warning.svg";
import DangerIcon from "./assets/icons/small/warning.svg";
import CloseIcon from "./assets/icons/medium/cross.svg";
import ResizeHandle from "./assets/resize-handle.svg";
import AbsentIcon from "./assets/absent.svg";
import ArriveIcon from "./assets/arrive.svg";
import LeaveIcon from "./assets/leave.svg";
import LateIcon from "./assets/late.svg";
import UpcomingIcon from "./assets/upcoming.svg";
import AddIcon from "./assets/icons/medium/add.svg";
import SubtractIcon from "./assets/icons/medium/subtract.svg";
import ChevronDownIcon from "./assets/chevron-down.svg";
import UndoIcon from "./assets/undo.svg";
import RedoIcon from "./assets/redo.svg";

// SW Curie's parts that more than one of the app's screens use.

// SW Curie's buttons. A tone (`data-tone`, Affirmative by default) sets each emphasis's own tokens: Primary fills,
// Secondary (the default) outlines, Tertiary washes only while pointed at or pressed. `data-hover` and `data-active`
// hold a state still, as the design system shows them.
const buttonToneRaw = css.raw({
  "--primary-fill": "var(--sw-surface-button-primary-affirmative-default)",
  "--primary-fill-hover": "var(--sw-surface-button-primary-affirmative-hover)",
  "--primary-fill-pressed": "var(--sw-surface-button-primary-affirmative-pressed)",
  "--secondary-border": "var(--sw-border-button-secondary-affirmative-default)",
  "--secondary-glyph": "var(--sw-glyph-button-secondary-affirmative-default)",
  "--secondary-glyph-hover": "var(--sw-glyph-button-secondary-affirmative-hover)",
  "--secondary-glyph-pressed": "var(--sw-glyph-button-secondary-affirmative-pressed)",
  "--secondary-wash-hover": "var(--sw-surface-button-secondary-affirmative-hover)",
  "--secondary-wash-pressed": "var(--sw-surface-button-secondary-affirmative-pressed)",
  "--tertiary-glyph": "var(--sw-glyph-button-tertiary-affirmative-default)",
  "--tertiary-glyph-hover": "var(--sw-glyph-button-tertiary-affirmative-hover)",
  "--tertiary-glyph-pressed": "var(--sw-glyph-button-tertiary-affirmative-pressed)",
  "--tertiary-wash-hover": "var(--sw-surface-button-tertiary-affirmative-hover)",
  "--tertiary-wash-pressed": "var(--sw-surface-button-tertiary-affirmative-pressed)",
  "&[data-tone=destructive]": {
    "--primary-fill": "var(--sw-surface-button-primary-destructive-default)",
    "--primary-fill-hover": "var(--sw-surface-button-primary-destructive-hover)",
    "--primary-fill-pressed": "var(--sw-surface-button-primary-destructive-pressed)",
    "--secondary-border": "var(--sw-border-button-secondary-destructive-default)",
    "--secondary-glyph": "var(--sw-glyph-button-secondary-destructive-default)",
    "--secondary-glyph-hover": "var(--sw-glyph-button-secondary-destructive-hover)",
    "--secondary-glyph-pressed": "var(--sw-glyph-button-secondary-destructive-pressed)",
    "--secondary-wash-hover": "var(--sw-surface-button-secondary-destructive-hover)",
    "--secondary-wash-pressed": "var(--sw-surface-button-secondary-destructive-pressed)",
    "--tertiary-glyph": "var(--sw-glyph-button-tertiary-destructive-default)",
    "--tertiary-glyph-hover": "var(--sw-glyph-button-tertiary-destructive-hover)",
    "--tertiary-glyph-pressed": "var(--sw-glyph-button-tertiary-destructive-pressed)",
    "--tertiary-wash-hover": "var(--sw-surface-button-tertiary-destructive-hover)",
    "--tertiary-wash-pressed": "var(--sw-surface-button-tertiary-destructive-pressed)",
  },
  "&[data-tone=warning]": {
    "--secondary-border": "var(--sw-border-button-secondary-warning-default)",
    "--secondary-glyph": "var(--sw-glyph-button-secondary-warning-default)",
    "--secondary-glyph-hover": "var(--sw-glyph-button-secondary-warning-hover)",
    "--secondary-glyph-pressed": "var(--sw-glyph-button-secondary-warning-pressed)",
    "--secondary-wash-hover": "var(--sw-surface-button-secondary-warning-hover)",
    "--secondary-wash-pressed": "var(--sw-surface-button-secondary-warning-pressed)",
    "--tertiary-glyph": "var(--sw-glyph-button-tertiary-warning-default)",
    "--tertiary-glyph-hover": "var(--sw-glyph-button-tertiary-warning-hover)",
    "--tertiary-glyph-pressed": "var(--sw-glyph-button-tertiary-warning-pressed)",
    "--tertiary-wash-hover": "var(--sw-surface-button-tertiary-warning-hover)",
    "--tertiary-wash-pressed": "var(--sw-surface-button-tertiary-warning-pressed)",
  },
  "&[data-tone=dark]": {
    "--tertiary-glyph": "var(--sw-glyph-button-tertiary-dark-default)",
    "--tertiary-glyph-hover": "var(--sw-glyph-button-tertiary-dark-hover)",
    "--tertiary-glyph-pressed": "var(--sw-glyph-button-tertiary-dark-pressed)",
    "--tertiary-wash-hover": "var(--sw-surface-button-tertiary-dark-hover)",
    "--tertiary-wash-pressed": "var(--sw-surface-button-tertiary-dark-pressed)",
  },
});

// Where a control's hover and press looks go: Panda may write `_hover` after `_disabled` at the same specificity, so a
// disabled control would take them. `:where` adds no specificity, so the overrides of those looks still win.
const ENABLED = "&:where(:not(:disabled, [data-disabled], [aria-disabled=true]))";

// Chips, pills and buttons multiply over what's under them, so a fill the same as its surface's (Info on Selected)
// still shows. Not on a dark surface, which would blacken them, nor while holding a tooltip, which would multiply too.
const multiplyRaw = css.raw({
  mixBlendMode: "multiply",
  "&:is([data-tone=dark], :has(> [data-tooltip]))": { mixBlendMode: "normal" },
});

const buttonEmphasisRaw = css.raw({
  color: "var(--secondary-glyph)",
  boxShadow: "inset 0 0 0 1.5px var(--secondary-border)",
  cursor: "pointer",
  [ENABLED]: {
    _hover: { boxShadow: "none", backgroundColor: "var(--secondary-wash-hover)", color: "var(--secondary-glyph-hover)" },
    _active: { boxShadow: "none", backgroundColor: "var(--secondary-wash-pressed)", color: "var(--secondary-glyph-pressed)" },
  },
  _disabled: {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-button-secondary-disabled)",
    backgroundColor: "transparent",
    color: "var(--sw-glyph-button-disabled)",
    cursor: "default",
  },
  "&[data-emphasis=primary]": {
    boxShadow: "none",
    backgroundColor: "var(--primary-fill)",
    color: "var(--sw-glyph-button-primary)",
    [ENABLED]: {
      _hover: { backgroundColor: "var(--primary-fill-hover)", color: "var(--sw-glyph-button-primary)" },
      _active: { backgroundColor: "var(--primary-fill-pressed)", color: "var(--sw-glyph-button-primary)" },
    },
    _disabled: { boxShadow: "none", backgroundColor: "var(--sw-surface-button-primary-disabled)", color: "var(--sw-glyph-button-disabled)" },
  },
  "&[data-emphasis=tertiary]": {
    boxShadow: "none",
    color: "var(--tertiary-glyph)",
    [ENABLED]: {
      _hover: { boxShadow: "none", backgroundColor: "var(--tertiary-wash-hover)", color: "var(--tertiary-glyph-hover)" },
      _active: { boxShadow: "none", backgroundColor: "var(--tertiary-wash-pressed)", color: "var(--tertiary-glyph-pressed)" },
    },
    _disabled: { boxShadow: "none", backgroundColor: "transparent", color: "var(--sw-glyph-button-disabled)" },
  },
});

// Molecules/Button/Icon Button: Tertiary, 28 across.
export const iconButtonStyle = css(buttonToneRaw, multiplyRaw, {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "1.75rem",
  height: "1.75rem",
  borderRadius: "var(--sw-radius-xs)",
  color: "var(--tertiary-glyph)",
  cursor: "pointer",
  [ENABLED]: {
    _hover: { backgroundColor: "var(--tertiary-wash-hover)", color: "var(--tertiary-glyph-hover)" },
    _active: { backgroundColor: "var(--tertiary-wash-pressed)", color: "var(--tertiary-glyph-pressed)" },
  },
  _disabled: { backgroundColor: "transparent", color: "var(--sw-glyph-button-disabled)", cursor: "default" },
  // Atoms/Risk Matrix: its tooltip shows while pointed at, never a wash.
  "&[data-bare]": { _hover: { backgroundColor: "transparent" }, _active: { backgroundColor: "transparent" } },
  // Molecules/Navigation/Header's bell: neutral until pointed at.
  "&[data-neutral]": { "--tertiary-glyph": "var(--sw-glyph-default)" },
});

// Molecules/Button/Small.
export const smallButtonStyle = css(buttonToneRaw, buttonEmphasisRaw, multiplyRaw, {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sw-gap-xs)",
  height: "1.75rem",
  paddingInline: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  whiteSpace: "nowrap",
  // As a chip's badge: a 20px icon at either end sits as far from its side as from its top and bottom.
  "&:has(> svg:first-child)": { paddingInlineStart: "var(--sw-padding-xs)" },
  "&:has(> svg:last-child)": { paddingInlineEnd: "var(--sw-padding-xs)" },
});

export type TypographyVariant =
  | "title"
  | "heading"
  | "subheading"
  | "subheadingSmall"
  | "badge"
  | "bodyLarge"
  | "bodyStrong"
  | "body"
  | "metadataStrong"
  | "metadata";

// SW Curie's text styles, the only place the app sets a font, Title with its letter spacing. `data-typography`, as
// components keep `data-type` for their own.
const typographyStyle = css({
  margin: "var(--sw-margin-none)",
  letterSpacing: "0",
  "&[data-typography=title]": { font: "var(--sw-text-style-10)", letterSpacing: "-0.05rem" },
  "&[data-typography=heading]": { font: "var(--sw-text-style-9)" },
  "&[data-typography=subheading]": { font: "var(--sw-text-style-8)" },
  "&[data-typography=subheadingSmall]": { font: "var(--sw-text-style-6)" },
  "&[data-typography=badge]": { font: "var(--sw-text-style-5)" },
  "&[data-typography=bodyLarge]": { font: "var(--sw-text-style-7)" },
  "&[data-typography=bodyStrong]": { font: "var(--sw-text-style-4)" },
  "&[data-typography=body]": { font: "var(--sw-text-style-3)" },
  "&[data-typography=metadataStrong]": { font: "var(--sw-text-style-2)" },
  "&[data-typography=metadata]": { font: "var(--sw-text-style-1)" },
});

/** SW Curie's glyph colours, a `Typography`'s `color`. */
export const glyph = {
  subdued: css({ color: "var(--sw-glyph-subdued)" }),
  placeholder: css({ color: "var(--sw-glyph-placeholder)" }),
  info: css({ color: "var(--sw-glyph-info)" }),
  success: css({ color: "var(--sw-glyph-success)" }),
  warning: css({ color: "var(--sw-glyph-warning)" }),
  alert: css({ color: "var(--sw-glyph-alert)" }),
  disabled: css({ color: "var(--sw-glyph-disabled)" }),
};

export type GlyphColor = keyof typeof glyph;

type TypographyTag = keyof React.JSX.IntrinsicElements;

/**
 * Text in one of SW Curie's styles, `variant`, as the element `tag` (a span unless given), in its glyph colour `color`
 * (Default unless given). A `className` sets anything but its font and colour.
 */
export function Typography<T extends TypographyTag = "span">({
  tag,
  variant,
  color,
  className,
  ...props
}: { tag?: T; variant: TypographyVariant; color?: GlyphColor } & Omit<ComponentProps<T>, "color">) {
  // Inside a `Wireframe`, its words show as a skeleton bar; loading, each run of them, in gray.
  const scope = useWireframe();
  const bar =
    scope?.mode === "loading"
      ? barRuns(props.children, glyph.disabled)
      : scope && typeof props.children === "string"
        ? [<Skeleton key="">{props.children}</Skeleton>]
        : null;
  return createElement(
    tag ?? "span",
    { className: cx(typographyStyle, color && glyph[color], className), "data-typography": variant, ...props },
    ...(bar ?? []),
  );
}

// A tone's two colours, as `--tone-surface` and `--tone-glyph` for everything inside.
// A tone's surface and glyph, and its badge's (Figma's inverted pair) and an icon's colour.
export const toneStyle = css({
  "&[data-tone=active]": {
    "--tone-surface": "var(--sw-surface-info)",
    "--tone-glyph": "var(--sw-glyph-info)",
    "--tone-badge": "var(--sw-surface-inverted-info)",
    "--tone-badge-glyph": "var(--sw-glyph-inverted-info)",
    "--tone-icon": "var(--sw-glyph-info)",
  },
  "&[data-tone=success]": {
    "--tone-surface": "var(--sw-surface-success)",
    "--tone-glyph": "var(--sw-glyph-success)",
    "--tone-badge": "var(--sw-surface-inverted-success)",
    "--tone-badge-glyph": "var(--sw-glyph-inverted-success)",
    "--tone-icon": "var(--sw-glyph-success)",
  },
  "&[data-tone=warning]": {
    "--tone-surface": "var(--sw-surface-warning)",
    "--tone-glyph": "var(--sw-glyph-warning)",
    "--tone-badge": "var(--sw-surface-inverted-warning)",
    "--tone-badge-glyph": "var(--sw-glyph-inverted-warning)",
    "--tone-icon": "var(--sw-glyph-warning)",
  },
  "&[data-tone=alert]": {
    "--tone-surface": "var(--sw-surface-alert)",
    "--tone-glyph": "var(--sw-glyph-alert)",
    "--tone-badge": "var(--sw-surface-inverted-alert)",
    "--tone-badge-glyph": "var(--sw-glyph-inverted-alert)",
    "--tone-icon": "var(--sw-glyph-alert)",
  },
  "&[data-tone=disabled]": {
    "--tone-surface": "var(--sw-surface-disabled)",
    "--tone-glyph": "var(--sw-glyph-disabled)",
    "--tone-badge": "var(--sw-surface-inverted-disabled)",
    "--tone-badge-glyph": "var(--sw-glyph-inverted-disabled)",
    "--tone-icon": "var(--sw-surface-inverted-disabled)",
  },
});

// Pressed as a whole, when actionable.
const pressRaw = css.raw({
  "&:is(button)": {
    cursor: "pointer",
    outline: "none",
    _focusVisible: { boxShadow: "0 0 0 1.5px var(--sw-border-focus)" },
  },
});

/**
 * A medium `Chip`'s box, in its tone (`toneStyle`; `data-tone=default` outlined): a `Badge` or an icon, then its label.
 * `data-shape=pill` is a `Pill`, round.
 */
const badgeChipStyle = css(pressRaw, multiplyRaw, {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  flexShrink: 0,
  height: "1.5rem",
  paddingInlineStart: "var(--sw-padding-xxs)",
  paddingInlineEnd: "var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--tone-surface)",
  color: "var(--tone-glyph)",
  whiteSpace: "nowrap",
  transition: "background-color 300ms ease, color 300ms ease",
  "& > svg": { flexShrink: 0, color: "var(--tone-icon)" },
  "&[data-shape=pill]": { gap: "var(--sw-gap-xxs)", paddingInlineEnd: "var(--sw-padding-md)", borderRadius: "var(--sw-radius-full)" },
  "&[data-shape=pill][data-tone=disabled] > [data-badge]": { backgroundColor: "var(--sw-glyph-disabled)" },
  // Disabled, an icon drawn in its own colour (Absent's) takes the tone's too.
  "&[data-tone=disabled] > svg [fill]:not([fill=none])": { fill: "currentColor" },
  "&[data-tone=default]": {
    backgroundColor: "var(--sw-surface-default)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
    color: "var(--sw-glyph-default)",
  },
  // Without its badge or icon.
  "&[data-bare]": { paddingInlineStart: "var(--sw-padding-md)" },
  "&[data-bare]:not([data-shape])": { paddingInlineStart: "var(--sw-padding-sm)" },
  // An icon at its end, as at its start, sits as far from its side as from its top and bottom.
  "&:has(> :is(svg, [data-remove]):last-child)": { gap: "var(--sw-gap-xxs)", paddingInlineEnd: "var(--sw-padding-xxs)" },
  // Large, as tall as the large toggle, its badge or icon and its cross as far from its sides as from its top and bottom.
  "&[data-size=large]": { height: "1.75rem" },
  "&[data-size=large]:not([data-bare])": { paddingInlineStart: "var(--sw-padding-xs)" },
  "&[data-size=large]:has(> :is(svg, [data-remove]):last-child)": { paddingInlineEnd: "var(--sw-padding-xs)" },
  // Loading, gray whatever its tone, icon and badge too, as its status may be another.
  "[aria-busy=true] &": {
    "&[data-tone]": {
      backgroundColor: "var(--sw-surface-disabled)",
      boxShadow: "none",
      color: "var(--sw-glyph-disabled)",
      "& > svg": { color: "var(--sw-glyph-disabled)" },
      "& > svg [fill]:not([fill=none])": { fill: "currentColor" },
      "& > [data-badge]": { backgroundColor: "var(--sw-glyph-disabled)", color: "var(--sw-surface-disabled)" },
    },
  },
});

/** A small `Chip` (Figma's Atoms/Pill/Info): a tag in its tone's colours (`toneStyle`). */
const tagStyle = css(pressRaw, multiplyRaw, {
  paddingInline: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--tone-surface)",
  color: "var(--tone-glyph)",
  whiteSpace: "nowrap",
  "[aria-busy=true] &": { backgroundColor: "var(--sw-surface-disabled)", color: "var(--sw-glyph-disabled)" },
});

export const STATUS_ICON: Record<Status, ReactNode> = {
  absent: <AbsentIcon aria-hidden />,
  late: <LateIcon aria-hidden />,
  lateCheckIn: <ArriveIcon aria-hidden />,
  checkedIn: <ArriveIcon aria-hidden />,
  checkedOut: <LeaveIcon aria-hidden />,
  upcoming: <UpcomingIcon aria-hidden />,
};

/** Atoms/Chip/Large/Actionable: picked (`aria-pressed`), and in its tone (`toneStyle`) when that isn't Affirmative. */
const actionableChipStyle = css(multiplyRaw, {
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  paddingBlock: "var(--sw-padding-xxs)",
  paddingInline: "var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  color: "var(--sw-glyph-default)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background-color 300ms ease, box-shadow 300ms ease, color 300ms ease, padding 300ms ease",
  "&:not([aria-pressed=true])": { _hover: { backgroundColor: "var(--sw-hover-shade)" } },
  _disabled: { cursor: "default" },
  "& > svg": { flexShrink: 0 },
  // Its tick opens out from nothing as it's picked, and folds away as it isn't.
  "& > [data-tick]": {
    width: 0,
    marginInlineEnd: "calc(-1 * var(--sw-gap-xs))",
    opacity: 0,
    transition: "width 300ms ease, margin 300ms ease, opacity 300ms ease",
  },
  "&[aria-pressed=true]": {
    paddingInlineStart: "var(--sw-padding-xxs)",
    backgroundColor: "var(--sw-surface-selected)",
    boxShadow: "none",
    color: "var(--sw-glyph-selected)",
  },
  "&[aria-pressed=true]:not([data-tone]):hover:not(:disabled)": {
    backgroundColor: "var(--sw-surface-selected)",
    backgroundImage: "linear-gradient(var(--sw-surface-hover) 0 0)",
    backgroundBlendMode: "multiply",
  },
  "&[aria-pressed=true] > [data-tick]": { width: "1.5rem", marginInlineEnd: 0, opacity: 1 },
  "&[aria-pressed=true][data-tone]": { backgroundColor: "var(--tone-surface)", color: "var(--tone-glyph)" },
});

const removeStyle = css({ display: "flex", flexShrink: 0, cursor: "pointer", _disabled: { cursor: "default" } });

export type ChipState = "default" | "affirmative" | "success" | "warning" | "alert";

const CHIP_TONE: Record<ChipState, string> = {
  default: "default",
  affirmative: "active",
  success: "success",
  warning: "warning",
  alert: "alert",
};

/** A check-in status's pill. */
export const STATUS_PILL: Record<Status, { state?: ChipState; disabled?: boolean }> = {
  absent: { state: "alert" },
  late: { state: "warning" },
  lateCheckIn: { state: "affirmative" },
  checkedIn: { state: "affirmative" },
  checkedOut: { state: "success" },
  upcoming: { disabled: true },
};

const ChipContext = createContext<{ disabled: boolean; remove: () => void } | null>(null);

/** Its words in a `span`, so an icon before them isn't also its last child, which ends it tighter. */
/**
 * Each run of words among `children` as a skeleton bar, `className` on it; what's between them standing. Null without
 * words, so children it leaves alone keep their keys and aren't mounted afresh.
 */
function barRuns(children: ReactNode, className?: string) {
  const all = Children.toArray(children);
  if (!all.some((child) => typeof child === "string" || typeof child === "number")) return null;
  const parts: ReactNode[] = [];
  let run = "";
  const end = () => {
    if (run.trim()) parts.push(<Skeleton key={`run-${parts.length}`} className={className}>{run}</Skeleton>);
    else if (run) parts.push(run);
    run = "";
  };
  for (const child of all) {
    if (typeof child === "string" || typeof child === "number") run += child;
    else {
      end();
      parts.push(child);
    }
  }
  end();
  return parts;
}

// Its words each in a span; loading, each run of them a bar in its own colour.
function spanned(children: ReactNode, loading = false) {
  const barred = loading && barRuns(children);
  return barred
    ? barred.map((part) => (isValidElement(part) && part.type === Skeleton ? <span key={part.key}>{part}</span> : part))
    : Children.map(children, (child) => (typeof child === "string" || typeof child === "number" ? <span>{child}</span> : child));
}

type ChipBoxProps = Omit<ComponentProps<"button">, "type" | "value" | "color"> & {
  /** A button as a whole. */
  actionable?: boolean;
  state?: ChipState;
};

/** A chip or a pill in its look: a button as a whole when `actionable`, a span otherwise. */
function Pressable({
  actionable,
  disabled,
  look,
  ...props
}: Omit<ChipBoxProps, "state"> & { look: { variant: TypographyVariant; className: string } & Record<`data-${string}`, string | undefined> }) {
  return actionable ? (
    <Typography tag="button" type="button" disabled={disabled} {...look} {...props} />
  ) : (
    <Typography {...look} {...(props as Omit<ComponentProps<"span">, "color">)} />
  );
}

/** A medium `Chip`'s or a `Pill`'s box in its `tone`, led by its `Badge` or icon. */
function ChipBox({ tone, className, children, ...props }: Omit<ChipBoxProps, "state"> & { tone: string }) {
  const loading = useWireframe()?.mode === "loading";
  const look = {
    variant: "body" as const,
    className: cx(badgeChipStyle, toneStyle, className),
    "data-tone": tone,
    // Led by its badge or icon.
    "data-bare": isValidElement(Children.toArray(children)[0]) ? undefined : "",
  };
  return (
    <Pressable look={look} {...props}>
      {spanned(children, loading)}
    </Pressable>
  );
}

/** An actionable large chip is a toggle; otherwise a large chip is a medium one's taller kind. */
type ChipProps = ChipBoxProps & {
  /** A large chip's: picked. */
  pressed?: boolean;
  defaultPressed?: boolean;
} & ({ actionable: true; size: "large" } | { size?: "small" | "medium" } | { actionable?: false; size: "large" });

/**
 * Atoms/Chip: square, in its `state`'s tone (Default, outlined, unless given). Small, its words alone (Figma's
 * Atoms/Pill/Info); medium, led by its `Badge` or icon and ended by its `Chip.Remove`; large, the same at 28px, or
 * when `actionable` a toggle, ticked as it's picked. A button as a whole when `actionable`.
 */
function ChipRoot({
  actionable,
  size = "medium",
  state = "default",
  disabled = false,
  pressed: held,
  defaultPressed = false,
  className,
  children,
  ...props
}: ChipProps) {
  const [pressed, setPressed] = useControllable(held, defaultPressed);
  const [removed, setRemoved] = useState(false);
  if (removed) return null;
  const tone = disabled ? "disabled" : CHIP_TONE[state];
  if (size === "large" && actionable) {
    return (
      <Typography
        tag="button"
        variant="body"
        type="button"
        className={cx(actionableChipStyle, toneStyle, className)}
        aria-pressed={pressed}
        data-size="large"
        data-tone={pressed && tone !== "default" && tone !== "active" ? tone : undefined}
        disabled={disabled}
        {...props}
        onClick={(event) => {
          setPressed(!pressed);
          props.onClick?.(event);
        }}
      >
        <ChipTickIcon aria-hidden data-tick="" />
        {children}
      </Typography>
    );
  }
  if (size === "small") {
    const look = { variant: "metadata" as const, className: cx(tagStyle, toneStyle, className), "data-size": "small", "data-tone": tone };
    return (
      <Pressable actionable={actionable} disabled={disabled} look={look} {...props}>
        {children}
      </Pressable>
    );
  }
  return (
    <ChipContext value={{ disabled, remove: () => setRemoved(true) }}>
      <ChipBox actionable={actionable} tone={tone} disabled={disabled} className={className} data-size={size} {...props}>
        {children}
      </ChipBox>
    </ChipContext>
  );
}

// In a 20px icon's room, in its tone's own colours (Active's unless given); inverted, the tone's badge pair (its chip's,
// inside one), for a surface already coloured.
const badgeStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  minWidth: "1rem",
  height: "1rem",
  margin: "var(--sw-margin-xxs)",
  paddingInline: "var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-full)",
  backgroundColor: "var(--sw-surface-info)",
  color: "var(--sw-glyph-info)",
  "&[data-tone]": { backgroundColor: "var(--tone-surface)", color: "var(--tone-glyph)" },
  "&[data-inverted]": {
    backgroundColor: "var(--tone-badge, var(--sw-surface-inverted-info))",
    color: "var(--tone-badge-glyph, var(--sw-glyph-inverted-info))",
  },
});

/** A tone a badge or a status's words take (`toneStyle`). */
export type Tone = "active" | "success" | "warning" | "alert" | "disabled";

/**
 * Atoms/Badge: a letter or a number in a circle, in its `state`'s colours. `inverted` only on a surface already
 * coloured: a `Chip`'s, whose tone it takes, or a disabled box's. Its words are left to what it leads (a chip reads its
 * own) unless `aria-hidden` is false, as a count read on its own is. Its letter's ink sits in the middle of the circle.
 */
export function Badge({
  state,
  inverted,
  "aria-hidden": hidden = true,
  children,
}: {
  state?: Tone;
  inverted?: boolean;
  "aria-hidden"?: boolean;
  children: ReactNode;
}) {
  const ref = useCentredInk<HTMLSpanElement>(children);
  return (
    <Typography
      ref={ref}
      variant="badge"
      className={cx(badgeStyle, state && toneStyle)}
      data-tone={state}
      data-inverted={inverted ? "" : undefined}
      data-badge=""
      aria-hidden={hidden}
    >
      <span>{children}</span>
    </Typography>
  );
}

/** Figma's Is Removable: takes its chip away itself unless given `onClick`. */
function ChipRemove({ "aria-label": label = "Remove", onClick, ...props }: Omit<ComponentProps<"button">, "children">) {
  const { disabled, remove } = useOwner(ChipContext, ChipRemove);
  return (
    <button
      type="button"
      className={removeStyle}
      aria-label={label}
      disabled={disabled}
      data-remove=""
      onClick={onClick ?? remove}
      {...props}
    >
      <RemoveIcon aria-hidden />
    </button>
  );
}

ChipRoot.displayName = "Chip";
ChipRemove.displayName = "Chip.Remove";

export const Chip = Object.assign(ChipRoot, { Remove: ownPart(ChipRemove) });

/** Chip/Read-only: a round chip in its `state`'s tone (Affirmative unless given), led by its `Badge` or icon. */
export function Pill({ state = "affirmative", disabled, ...props }: ChipBoxProps) {
  return <ChipBox {...props} tone={disabled ? "disabled" : CHIP_TONE[state]} disabled={disabled} data-shape="pill" />;
}

// Atoms/Pill/Spotscore: the tier's stars and name, then its score (`scoreStyle`) in the tier's colour.
const tierStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xxs)",
  paddingInlineStart: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--sw-surface-inverted-default)",
  color: "var(--sw-glyph-inverted-default)",
  whiteSpace: "nowrap",
  "& > svg": { flexShrink: 0 },
  "[aria-busy=true] &": {
    backgroundColor: "var(--sw-surface-disabled)",
    color: "var(--sw-glyph-disabled)",
    "& > svg [fill]:not([fill=none])": { fill: "currentColor" },
  },
});

const scoreStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "stretch",
  minWidth: "1.5rem",
  paddingInline: "var(--sw-padding-xxs)",
  borderStartEndRadius: "var(--sw-radius-xxs)",
  borderEndEndRadius: "var(--sw-radius-xxs)",
  color: "var(--sw-glyph-default)",
  "[data-tier=Super] > &": { backgroundColor: "var(--sw-glyph-tier-bronze)" },
  "[data-tier=Pro] > &": { backgroundColor: "var(--sw-glyph-tier-silver)" },
  "[data-tier=Elite] > &": { backgroundColor: "var(--sw-glyph-tier-gold)" },
  "[aria-busy=true] [data-tier] > &": { backgroundColor: "var(--sw-surface-disabled)" },
});

const TIERS = {
  elite: { name: "Elite", Stars: StarsElite },
  pro: { name: "Pro", Stars: StarsPro },
  super: { name: "Super", Stars: StarsSuper },
} satisfies Record<Lowercase<Tier>, { name: Tier; Stars: unknown }>;

/** Atoms/Pill/Spotscore: its `tier`'s stars and name, then its score. */
export function Spotscore({
  tier = "elite",
  className,
  children,
  ...props
}: Omit<ComponentProps<"span">, "color"> & { tier?: Lowercase<Tier> }) {
  const { name, Stars } = TIERS[tier];
  return (
    <Typography variant="metadata" className={cx(tierStyle, className)} data-tier={name} {...props}>
      <Stars aria-hidden />
      {name}
      <Typography variant="metadataStrong" className={scoreStyle}>
        {children}
      </Typography>
    </Typography>
  );
}

const tooltipStyle = css({
  position: "absolute",
  insetBlockStart: "calc(100% + 0.25rem)",
  insetInlineEnd: 0,
  zIndex: 4,
  display: "flex",
  alignItems: "center",
  height: "1.25rem",
  paddingInline: "var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-xxs)",
  backgroundColor: "var(--sw-surface-inverted-subdued)",
  color: "white",
  whiteSpace: "nowrap",
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 150ms ease",
  ":is(button, [data-tip]):hover > &, [data-tip]:hover [data-tip-anchor] > &": { opacity: 1, transitionDelay: "300ms" },
  "button:is([data-hover], [data-active]) > &": { opacity: 1, transitionDelay: "0ms" },
  "&[data-lines]": {
    flexDirection: "column",
    alignItems: "flex-start",
    height: "auto",
    paddingBlock: "var(--sw-padding-xxs)",
  },
  "& > svg": {
    position: "absolute",
    insetBlockStart: "-0.25rem",
    insetInlineEnd: "0.625rem",
  },
  "&[data-align=start]": {
    insetInlineStart: 0,
    insetInlineEnd: "auto",
    "& > svg": { insetInlineStart: "0.625rem", insetInlineEnd: "auto" },
  },
  "&[data-place=above]": {
    insetBlockStart: "auto",
    insetBlockEnd: "calc(100% + 0.25rem)",
    insetInlineStart: "50%",
    insetInlineEnd: "auto",
    translate: "-50% 0",
    "& > svg": { insetBlockStart: "auto", insetBlockEnd: "-0.25rem", insetInlineStart: "calc(50% - 0.3125rem)", rotate: "180deg" },
  },
});

/**
 * Shows under its button (or a `data-tip` part) while the pointer rests on it, from its right edge, or its left with
 * `start`; with `above`, centred over the `data-tip-anchor` it hangs from in a `data-tip` part. Several children, a line
 * each.
 */
export function Tooltip({ children, start, above }: { children: ReactNode; start?: boolean; above?: boolean }) {
  return (
    <Typography
      variant="metadata"
      className={tooltipStyle}
      aria-hidden
      data-tooltip=""
      data-align={start ? "start" : undefined}
      data-place={above ? "above" : undefined}
      data-lines={Children.count(children) > 1 ? "" : undefined}
    >
      <TooltipArrow />
      {children}
    </Typography>
  );
}

const tagsStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xs)" });

// Its tooltip hangs from it, beside its chip.
const moreTagsStyle = css({ position: "relative", display: "flex" });

/** A template's tags, or a worker's skills: its first two, then how many more as a third, whose tooltip lists them a line each. */
export function Tags({ tags, "aria-label": label = "Tags" }: { tags: string[]; "aria-label"?: string }) {
  if (!tags.length) return null;
  const rest = tags.slice(2);
  return (
    <div role="group" aria-label={label} className={tagsStyle}>
      {tags.slice(0, 2).map((tag) => (
        <Chip size="small" state="affirmative" key={tag}>
          {tag}
        </Chip>
      ))}
      {rest.length > 0 && (
        <span className={moreTagsStyle} data-tip="">
          <Chip size="small" state="affirmative">
            {`+${rest.length}`}
          </Chip>
          <Tooltip>
            {rest.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </Tooltip>
        </span>
      )}
    </div>
  );
}

// A line between parts. Between a list's rows, beside a filled row (hovered or selected) it goes, so the fill meets its
// neighbour; between two filled rows it stays, keeping them apart. Beside a hovered button it goes too.
const dividerStyle = css({
  flexShrink: 0,
  alignSelf: "stretch",
  height: "0.0625rem",
  margin: 0,
  border: "none",
  backgroundColor: "var(--sw-border-subdued)",
  "&[data-orientation=vertical]": { width: "0.0625rem", height: "auto" },
  "&[data-tone=warning]": { backgroundColor: "var(--sw-border-inverted-warning)" },
  "&[data-tone=alert]": { backgroundColor: "var(--sw-border-inverted-alert)" },
  "&:is(:is([role=option], [data-add]):is(:hover, [data-hover], [aria-selected=true]) + *):not(:has(+ :is([role=option], [data-add]):is(:hover, [data-hover], [aria-selected=true])))":
    { backgroundColor: "transparent" },
  "&:has(+ :is([role=option], [data-add]):is(:hover, [data-hover], [aria-selected=true])):not(:is([role=option], [data-add]):is(:hover, [data-hover], [aria-selected=true]) + *)":
    { backgroundColor: "transparent" },
  "&:is(button:hover + *, :has(+ button:hover))": { backgroundColor: "transparent" },
});

/** A line between parts, across them or, `vertical`, down beside them; `warning` or `alert` on that tone's surface. */
export function Divider({ orientation, tone }: { orientation?: "vertical"; tone?: "warning" | "alert" }) {
  return <hr className={dividerStyle} data-orientation={orientation} data-tone={tone} aria-hidden />;
}

const zoneStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-sm)",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-alert)",
  "&[data-zone=warning]": { backgroundColor: "var(--sw-surface-warning)" },
  "& > div:first-child": { display: "flex", flexDirection: "column", gap: "var(--sw-gap-xs)" },
  "& > div:first-child > div": {
    display: "flex",
    alignItems: "center",
    gap: "var(--sw-gap-xs)",
    paddingInline: "var(--sw-padding-xxs)",
  },
  "& > button": { alignSelf: "flex-start" },
});

function zone(tone: "alert" | "warning", name: string) {
  function Zone({ title, children }: { title: string; children: ReactNode }) {
    const id = useId();
    return (
      <div className={zoneStyle} role="group" aria-labelledby={id} data-zone={tone}>
        <div>
          <Typography tag="div" variant="bodyStrong" color={tone} id={id}>
            <DangerIcon aria-hidden />
            {title}
          </Typography>
          <Divider tone={tone} />
        </div>
        {children}
      </div>
    );
  }
  return Object.assign(Zone, { displayName: name });
}

/** What can't be undone, on the alert surface under its `title` and an alert divider; a button keeps its own width. */
export const DangerZone = zone("alert", "DangerZone");

/** What undoes a Danger zone's action, as it's laid out, on the warning surface. */
export const CautionZone = zone("warning", "CautionZone");

// SW Curie's Molecules/Button/Large.
const largeButtonStyle = css(buttonToneRaw, buttonEmphasisRaw, multiplyRaw, {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sw-gap-md)",
  height: "2.75rem",
  paddingInline: "var(--sw-padding-xxl)",
  borderRadius: "var(--sw-radius-md)",
  whiteSpace: "nowrap",
  // As a chip's badge: a 24px icon at either end sits as far from its side as from its top and bottom.
  "&:has(> svg:first-child)": { paddingInlineStart: "var(--sw-padding-md)" },
  "&:has(> svg:last-child)": { paddingInlineEnd: "var(--sw-padding-md)" },
});

export type ButtonTone = "destructive" | "warning" | "dark";

const BUTTON_SIZE = { large: largeButtonStyle, small: smallButtonStyle, icon: iconButtonStyle };

/**
 * Molecules/Button, Large or Small, in Figma's emphases and tones; icons go in beside its words. At size `icon` it's
 * Figma's Icon Button, its icon alone (named by `aria-label`, and a `Tooltip` if it has one), Tertiary only.
 */
export function Button({
  size = "large",
  emphasis = "primary",
  tone,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "color"> & {
  size?: "large" | "small" | "icon";
  emphasis?: "primary" | "secondary" | "tertiary";
  tone?: ButtonTone;
}) {
  const loading = useWireframe()?.mode === "loading";
  return (
    <Typography
      tag="button"
      variant={size === "large" ? "bodyLarge" : "metadata"}
      type="button"
      className={cx(BUTTON_SIZE[size], className)}
      data-emphasis={size === "icon" ? undefined : emphasis}
      data-tone={tone}
      {...props}
    >
      {spanned(children, loading)}
    </Typography>
  );
}

const toolbarStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  height: "2.5rem",
  padding: "var(--sw-padding-xs)",
  // As much room right of its end as above and below it.
  paddingInlineEnd: "calc(var(--sw-padding-xs) + var(--sw-padding-xxs))",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "& > [data-group]": { display: "flex", gap: "var(--sw-gap-md)" },
  "& > [data-end]": { marginInlineStart: "auto" },
});

/** A bar across the top of what it heads, a line under it: its `Toolbar.Group`s, a vertical `Divider` between two, and `end` at its far end. */
function ToolbarRoot({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className={toolbarStyle}>
      {children}
      {end && <div data-end="">{end}</div>}
    </div>
  );
}

/** Icon buttons that go together. */
function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div data-group="">{children}</div>;
}

/** Undo and Redo, each disabled without its action. */
function ToolbarHistory({ onUndo, onRedo }: { onUndo?: () => void; onRedo?: () => void }) {
  return (
    <ToolbarGroup>
      <Button size="icon" aria-label="Undo" disabled={!onUndo} onClick={onUndo}>
        <UndoIcon aria-hidden />
        <Tooltip start>Undo</Tooltip>
      </Button>
      <Button size="icon" aria-label="Redo" disabled={!onRedo} onClick={onRedo}>
        <RedoIcon aria-hidden />
        <Tooltip start>Redo</Tooltip>
      </Button>
    </ToolbarGroup>
  );
}

export const Toolbar = Object.assign(ToolbarRoot, { Group: ToolbarGroup, History: ToolbarHistory });

// SW Curie's Atoms/Hint Text (6975:27663): subdued, or a warning or an alert after its icon.
const hintStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  color: "var(--sw-glyph-subdued)",
  "& > svg": { flexShrink: 0 },
  "&[data-tone=warning]": { color: "var(--sw-glyph-warning)" },
  "&[data-tone=alert]": { color: "var(--sw-glyph-alert)" },
  "&[data-tone=success]": { color: "var(--sw-glyph-success)" },
});

export type FieldTone = "warning" | "alert";

/**
 * A control's own look: Active, a tone, or an error that its field's hint says in place of its own words; or the
 * field's whole `state`, null for none, which overrides the field's own tone (a password once it's been used).
 */
type FieldLook = { active?: boolean; tone?: FieldTone; error?: string; state?: "active" | FieldTone | null };

/**
 * What a `Field` gives the parts inside it: its control's `id` (its `Field.Label` is for it), the ids its label and hint
 * take, its tone and whether it's disabled, and its look (`state`), which its control `report`s it into.
 */
export const FieldContext = createContext<{
  field?: boolean;
  id?: string;
  labelId?: string;
  hintId?: string;
  tone?: FieldTone;
  disabled?: boolean;
  state?: "active" | FieldTone;
  /** A demo's held look, `data-active`'s value. */
  held?: string;
  orientation?: "vertical" | "horizontal";
  /** A horizontal field's checkbox, radio or switch, and its size. */
  choice?: string;
  size?: "small";
  /** What its control says is wrong (a typed time that isn't one), which its hint says instead. */
  error?: string;
  report?: (look: FieldLook) => void;
}>({});

/**
 * The field a control is in, told the control's own look: Active while `active` (focused, or open), or in `tone`.
 * Out of a field, the look is the control's alone.
 */
export function useField(look: FieldLook = {}) {
  const field = use(FieldContext);
  const { report } = field;
  useLayoutEffect(() => report?.(look), [report, look.active, look.tone, look.error, look.state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (field.field) return field;
  const state = look.state !== undefined ? (look.state ?? undefined) : fieldState({ tone: look.tone, active: look.active });
  return { ...field, state };
}

// A field stacks its label, control and hint; horizontal, its checkbox, radio or switch sits beside its words.
const fieldStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  "& > * + [data-hint]": { marginBlockStart: "var(--sw-margin-xs)" },
  "&[data-orientation=horizontal]": { flexDirection: "row", alignItems: "flex-start", gap: "var(--sw-gap-md)" },
  "&[data-orientation=horizontal][data-size=small]": { alignItems: "center", gap: "var(--sw-gap-xs)" },
  // The words take the room the box leaves, a switch at the far end.
  "&[data-orientation=horizontal] > :is([data-content], [data-label])": { flex: "1 1 auto" },
  // A multiselect scrolls its rows in the room the field's left.
  "&:has(> [data-multiselect])": { minHeight: 0 },
});

const contentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  minWidth: 0,
  "& > [data-hint]": { whiteSpace: "pre-line" },
});

/** A horizontal field's label and hint, beside its checkbox, radio or switch. */
function FieldContent({ children }: { children: ReactNode }) {
  if (!use(FieldContext).field) throw misplaced(FieldContent);
  return (
    <div className={contentStyle} data-content="">
      {children}
    </div>
  );
}
FieldContent.displayName = "Field.Content";

/** Of a field's children, its checkbox, radio or switch, which a horizontal field lays out beside its words. */
const choiceOf = (children: ReactNode) =>
  Children.toArray(children).find(
    (child): child is ReactElement<{ size?: "small"; disabled?: boolean }, { choice?: string } & FC> =>
      isValidElement(child) && Boolean((child.type as { choice?: string }).choice),
  );

/**
 * A form control's shell, as shadcn/ui's Field: its `Field.Label`, its control and its `Field.HintText`, or, `orientation`
 * horizontal, a checkbox, radio or switch beside them (in `Field.Content` when there's a hint). It holds the
 * control's ids, `tone` and `disabled`, and takes on the look its control reports; `data-active` holds Active.
 */
function FieldRoot({
  tone,
  disabled,
  orientation = "vertical",
  "data-active": held,
  className,
  children,
}: {
  tone?: FieldTone;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
  "data-active"?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [look, report] = useState<FieldLook>({});
  const owned = look.state !== undefined;
  const own = look.error ? "alert" : owned ? (look.state === "active" ? undefined : (look.state ?? undefined)) : (tone ?? look.tone);
  const state = owned && !disabled ? (look.state ?? undefined) : fieldState({ tone: own, active: look.active || held !== undefined, disabled });
  const parts = Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === FieldContent ? Children.toArray((child.props as { children?: ReactNode }).children) : [child],
  );
  const choice = choiceOf(children);
  const size = choice?.props.size;
  const shared = {
    field: true,
    id,
    labelId: partsOf(parts, FieldLabel).length ? `${id}-label` : undefined,
    hintId: partsOf(parts, FieldHintText).length ? `${id}-hint` : undefined,
    tone: own,
    disabled: disabled ?? choice?.props.disabled,
    state,
    held,
    orientation,
    choice: choice?.type.choice,
    size,
    error: look.error,
    report,
  };
  return (
    <div
      className={cx(fieldStyle, className)}
      data-field=""
      data-orientation={orientation}
      data-size={orientation === "horizontal" ? size : undefined}
      data-state={state}
      data-disabled={disabled ? "" : undefined}
    >
      <FieldContext value={shared}>{children}</FieldContext>
    </div>
  );
}
FieldRoot.displayName = "Field";

/**
 * Atoms/Hint Text: a field's hint, in the field's tone unless given one; while the field's control reports an
 * error, the hint says that instead. An icon given as its first child takes the place of its tone's
 * (Atoms/Form/Password Conditions draws its states so).
 */
function FieldHintText({
  tone: own,
  children,
  ...props
}: {
  tone?: "warning" | "alert" | "success";
  children: ReactNode;
  id?: string;
  role?: string;
}) {
  const field = use(FieldContext);
  if (!field.field) throw misplaced(FieldHintText);
  const error = own ? undefined : field.error;
  const tone = error ? "alert" : (own ?? field.tone);
  const words = error ?? children;
  const icon = isValidElement(Children.toArray(words)[0]);
  const Icon = icon ? null : tone === "alert" ? AbsentIcon : tone === "warning" ? WarningIcon : null;
  const hint = (
    <Typography
      variant="metadata"
      className={hintStyle}
      data-tone={tone}
      id={field.hintId}
      role={error ? "alert" : undefined}
      {...props}
    >
      {Icon && <Icon aria-hidden />}
      {words}
    </Typography>
  );
  // A field places its hint by `data-hint`, on a box of its own so its layout never meets the hint's colours.
  return <span data-hint="">{hint}</span>;
}

// A field's label: 14px over its control, in the field's look; beside a checkbox, radio or switch, its words at 16px
// (Atoms/Filter's at 12, a filter switch's at 14).
const labelStyle = css({
  color: "var(--sw-glyph-subdued)",
  "&[data-state=active]": { color: "var(--sw-glyph-selected)" },
  "&[data-state=warning]": { color: "var(--sw-glyph-warning)" },
  "&[data-state=alert]": { color: "var(--sw-glyph-alert)" },
  "&[data-orientation=horizontal]": { color: "var(--sw-glyph-default)", cursor: "pointer" },
  "&[data-disabled]": { cursor: "default" },
});

/** A field's label, for its control. */
function FieldLabel({ children }: { children: ReactNode }) {
  const { field, id, labelId, state, orientation, size, disabled, choice } = use(FieldContext);
  if (!field) throw misplaced(FieldLabel);
  const horizontal = orientation === "horizontal";
  const variant = !horizontal ? "body" : size !== "small" ? "bodyLarge" : choice === "switch" ? "body" : "metadata";
  return (
    <Typography
      tag="label"
      variant={variant}
      htmlFor={id}
      id={labelId}
      className={labelStyle}
      data-label=""
      data-state={horizontal ? undefined : state}
      data-orientation={orientation}
      data-size={horizontal ? size : undefined}
      data-choice={choice}
      data-disabled={horizontal && disabled ? "" : undefined}
    >
      {children}
    </Typography>
  );
}
FieldHintText.displayName = "Field.HintText";
FieldLabel.displayName = "Field.Label";

export const Field = Object.assign(FieldRoot, {
  Content: ownPart(FieldContent),
  Label: ownPart(FieldLabel),
  HintText: ownPart(FieldHintText),
});

// A 24px box (20 at Atoms/Filter's size), its square inset in it.
export const checkboxStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "1.5rem",
  height: "1.5rem",
  cursor: "pointer",
  "& > span": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.25rem",
    height: "1.25rem",
    borderRadius: "var(--sw-radius-xs)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
    backgroundColor: "var(--sw-surface-default)",
  },
  // The tick's white reaches it as currentColor (the site's SVGR); `data-checked`, a list item's mark.
  "&:is([aria-checked=true], [data-checked]) > span": {
    boxShadow: "none",
    backgroundColor: "var(--sw-surface-inverted-selected)",
    color: "var(--sw-glyph-inverted-default)",
  },
  "&[data-tone=warning] > span": { boxShadow: "inset 0 0 0 1px var(--sw-border-warning)" },
  "&[data-tone=warning][aria-checked=true] > span": {
    boxShadow: "none",
    backgroundColor: "var(--sw-surface-inverted-warning)",
  },
  "&[data-tone=alert] > span": { boxShadow: "inset 0 0 0 1px var(--sw-border-alert)" },
  "&[data-tone=alert][aria-checked=true] > span": {
    boxShadow: "none",
    backgroundColor: "var(--sw-surface-inverted-alert)",
  },
  _disabled: { cursor: "default" },
  "&:disabled > span": { backgroundColor: "var(--sw-surface-disabled)" },
  "&:disabled[aria-checked=true] > span": {
    backgroundColor: "var(--sw-surface-inverted-disabled-selected)",
    color: "var(--sw-glyph-disabled)",
  },
  // Atoms/Form/Radio Button: a ring, filled with Figma's Radio Switch dot when picked.
  "&[data-shape=radio] > span": { borderRadius: "var(--sw-radius-full)" },
  "&[data-size=small]": { width: "1.25rem", height: "1.25rem" },
  "&[data-size=small] > span": { width: "1rem", height: "1rem", borderRadius: "var(--sw-radius-xxs)" },
  // Atoms/Filter/Radio Switch is round; it and Atoms/Filter/Checkbox, disabled and picked, are filled dark.
  "&[data-size=small][data-shape=radio] > span": { borderRadius: "var(--sw-radius-full)" },
  "&[data-size=small]:disabled[aria-checked=true] > span": {
    backgroundColor: "var(--sw-surface-inverted-disabled)",
    color: "var(--sw-glyph-inverted-disabled)",
  },
});

/** `part`, named `name` in the code view. */
const named = <T extends object>(part: T, name: string) => Object.assign(part, { displayName: name });

type ChoiceProps = {
  /** Held by its owner; left out, the choice holds it, from `defaultChecked`. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  /** Atoms/Filter's. */
  size?: "small";
  tone?: FieldTone;
  disabled?: boolean;
  /** Names the box when it has no label. */
  "aria-label"?: string;
  "data-tour"?: string;
  className?: string;
  /** In a `RadioGroup`, the radio's own, picked while it's the group's. */
  value?: string;
};

/**
 * Atoms/Form/Checkbox, or Atoms/Form/Radio Button, a choice among others: the box alone. In a horizontal `Field`, its
 * `Label` beside it names it, and it takes the field's tone and disabled.
 */
function choice(name: "Checkbox" | "RadioButton") {
  const radio = name === "RadioButton";
  function Choice({ checked: held, defaultChecked = false, onChange, size, tone, disabled, value, className, ...props }: ChoiceProps) {
    const field = use(FieldContext);
    const group = use(RadioGroupContext);
    if (radio && value !== undefined && !group) throw new Error("RadioButton's value is for a radio in a RadioGroup");
    const grouped = radio && group && value !== undefined;
    const [own, setChecked] = useControllable(held, defaultChecked, onChange);
    const checked = grouped ? group.value === value : own;
    const Mark = radio ? (size === "small" ? RadioDotSmallIcon : RadioDotIcon) : TickIcon;
    return (
      <button
        type="button"
        id={field.id}
        role={radio ? "radio" : "checkbox"}
        aria-checked={checked}
        aria-describedby={field.hintId}
        className={cx(checkboxStyle, className)}
        data-size={size}
        data-shape={radio ? "radio" : undefined}
        data-tone={tone ?? field.tone}
        disabled={disabled ?? field.disabled}
        onClick={() => (grouped ? group.pick(value) : setChecked(radio || !checked))}
        {...props}
      >
        <span>{checked && <Mark aria-hidden />}</span>
      </button>
    );
  }
  return Object.assign(named(Choice, name), { choice: radio ? "radio" : "checkbox" });
}

export const Checkbox = choice("Checkbox");
export const RadioButton = choice("RadioButton");

const RadioGroupContext = createContext<{ value?: string; pick: (value: string) => void } | null>(null);

const radioGroupStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

/** Radio buttons of which one is picked: each `RadioButton` in it by its `value`, held by its owner or by itself. */
export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [picked, pick] = useControllable<string | undefined>(value, defaultValue, (next) => next && onValueChange?.(next));
  return (
    <div role="radiogroup" className={cx(radioGroupStyle, className)} {...props}>
      <RadioGroupContext value={{ value: picked, pick }}>{children}</RadioGroupContext>
    </div>
  );
}

RadioGroup.displayName = "RadioGroup";

// SW Curie's Atoms/Form/Switch (661:2040): its track, level with a 24px line of words (Atoms/Filter/Switch's, a 28px one).
const switchStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  width: "2.25rem",
  height: "1.25rem",
  marginBlock: "0.125rem",
  marginInline: "var(--sw-margin-xxs)",
  paddingInline: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-full)",
  backgroundColor: "var(--sw-surface-inverted-default)",
  cursor: "pointer",
  transition: "background-color 150ms ease",
  "& > span": {
    width: "1rem",
    height: "1rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-surface-default)",
    transition: "transform 150ms ease",
  },
  "&[aria-checked=true]": { backgroundColor: "var(--sw-surface-inverted-selected)" },
  "&[aria-checked=true] > span": { transform: "translateX(calc(2.25rem - 2 * var(--sw-padding-xxs) - 1rem))" },
  _disabled: { cursor: "default", backgroundColor: "var(--sw-surface-disabled)" },
  "&:disabled[aria-checked=true]": { backgroundColor: "var(--sw-surface-inverted-disabled-selected)" },
  "&:disabled > span": { backgroundColor: "var(--sw-glyph-disabled)" },
  "&[data-size=small]": { marginBlock: "0.25rem" },
});

/**
 * Atoms/Form/Switch, or at size small Atoms/Filter/Switch: the toggle alone. In a horizontal `Field`, its `Label`
 * names it, before or after it; without one, `aria-label` does.
 */
function SwitchRoot({
  checked: held,
  defaultChecked = false,
  onChange,
  size,
  disabled,
  ...props
}: {
  /** Held by its owner; left out, the switch holds it, from `defaultChecked`. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  size?: "small";
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const field = use(FieldContext);
  const [checked, setChecked] = useControllable(held, defaultChecked, onChange);
  return (
    <button
      type="button"
      id={field.id}
      role="switch"
      aria-checked={checked}
      aria-describedby={field.hintId}
      className={switchStyle}
      data-size={size}
      disabled={disabled ?? field.disabled}
      onClick={() => setChecked(!checked)}
      {...props}
    >
      <span />
    </button>
  );
}

export const Switch = Object.assign(named(SwitchRoot, "Switch"), { choice: "switch" });

// A control's box in its field's look (`data-state`): Active as it's used (or held so), and a warning or an alert. Each
// outlines the box with a ring and tints what's drawn in it.
export const boxStateRaw = css.raw({
  "&[data-state=active]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
    outline: "2px solid var(--sw-outline-focus)",
    color: "var(--sw-glyph-selected)",
  },
  "&[data-state=warning]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)",
    outline: "2px solid var(--sw-outline-warning)",
    color: "var(--sw-glyph-warning)",
  },
  "&[data-state=alert]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)",
    outline: "2px solid var(--sw-outline-alert)",
    color: "var(--sw-glyph-alert)",
  },
});

// Atoms/Form/Text Input's box (395:371), a `Typography` (Body Large) its input takes the font of: 40px; a prefix fills its start, a suffix its end.
// Disabled (`data-disabled`), it takes the disabled fills.
export const boxRaw = css.raw(boxStateRaw, {
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  height: "2.5rem",
  minWidth: 0,
  paddingInline: "var(--sw-padding-md)",
  overflow: "hidden",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  color: "var(--sw-glyph-default)",
  cursor: "text",
  "& > svg": { flexShrink: 0 },
  "& input, & textarea": {
    flex: "1 1 auto",
    minWidth: 0,
    alignSelf: "stretch",
    padding: "var(--sw-padding-none)",
    border: "none",
    outline: "none",
    background: "none",
    font: "inherit",
    letterSpacing: "inherit",
    color: "var(--sw-glyph-default)",
    resize: "none",
  },
  "& [data-prefix], & [data-suffix]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    minWidth: "2.75rem",
    paddingInline: "var(--sw-padding-md)",
    // Its fill covers the box's outline, so it draws the outline's share again.
    backgroundColor: "var(--sw-surface-subdued)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
    color: "var(--sw-glyph-default)",
  },
  "& [data-prefix]": {
    marginInlineStart: "-0.625rem",
    borderStartStartRadius: "var(--sw-radius-xs)",
    borderEndStartRadius: "var(--sw-radius-xs)",
  },
  "& [data-suffix]": {
    marginInlineEnd: "-0.625rem",
    borderStartEndRadius: "var(--sw-radius-xs)",
    borderEndEndRadius: "var(--sw-radius-xs)",
  },
  "&[data-state=active] :is([data-prefix], [data-suffix])": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "&[data-state=warning] :is([data-prefix], [data-suffix])": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)" },
  "&[data-state=alert] :is([data-prefix], [data-suffix])": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)" },
  "&[data-disabled]": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    cursor: "default",
  },
  "&[data-disabled] :is(input, textarea, [data-prefix], [data-suffix])": { color: "var(--sw-glyph-disabled)" },
  "&[data-disabled] :is([data-prefix], [data-suffix])": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  },
});

/** Focus held within, and the handlers that track it, for a control that's Active while it's in use. */
export function useFocusWithin() {
  const [focused, setFocused] = useState(false);
  return [
    focused,
    {
      onFocus: () => setFocused(true),
      onBlur: (event: FocusEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      },
    },
  ] as const;
}

// Small, Atoms/Inline Input (3429:2454): 28px, 12px words, 88px unless it fills its row.
export const textInputStyle = css(boxRaw, {
  "&[data-multiline]": { height: "5.5rem", alignItems: "flex-start", paddingBlock: "var(--sw-padding-sm)" },
  "&[data-size=small]": {
    flexShrink: 0,
    width: "5.5rem",
    height: "1.75rem",
    gap: "var(--sw-gap-xs)",
    paddingInline: "var(--sw-padding-xs)",
    "& :is([data-prefix], [data-suffix])": { minWidth: "2.5rem", paddingInline: "var(--sw-padding-xs)" },
    "& [data-prefix]": { marginInlineStart: "-0.25rem" },
    "& [data-suffix]": { marginInlineEnd: "-0.25rem" },
  },
  "&[data-size=small][data-fill]": { flex: "1 1 0", width: "auto" },
});

const TextInputContext = createContext<object | null>(null);
const IN_TEXT_INPUT = {};

function TextInputPrefix({ children }: { children: ReactNode }) {
  useOwner(TextInputContext, TextInputPrefix);
  return <span data-prefix="">{children}</span>;
}
TextInputPrefix.displayName = "TextInput.Prefix";

function TextInputSuffix({ children }: { children: ReactNode }) {
  useOwner(TextInputContext, TextInputSuffix);
  return <span data-suffix="">{children}</span>;
}
TextInputSuffix.displayName = "TextInput.Suffix";

/**
 * Focuses `field` as it's drawn, given `on`, without scrolling to it, once what it's drawn in stops moving: WebKit
 * scrolls a focused field into view, `preventScroll` or not, which would shift an overlay that's sliding in by the room
 * it has yet to cover.
 */
function useAutoFocus(field: RefObject<HTMLElement | null>, on?: boolean) {
  useEffect(() => {
    const node = field.current;
    if (!on || !node) return;
    const moving = (document.getAnimations?.() ?? []).filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return target?.contains(node) && animation.effect?.getComputedTiming().endTime !== Infinity;
    });
    const focus = () => node.focus({ preventScroll: true });
    if (!moving.length) return void focus();
    let live = true;
    Promise.allSettled(moving.map((animation) => animation.finished)).then(() => live && focus());
    return () => {
      live = false;
    };
  }, [field, on]);
}

/**
 * Atoms/Form/Text Input: the box typed in, its `Prefix` filling its start and its `Suffix` its end; `multiline` takes
 * lines. It holds what's typed from `defaultValue` unless its owner holds `value`; `autofill` types itself in when
 * first focused empty. Small, it's Atoms/Inline Input, a table cell's or a filter's; `active` holds its Active look,
 * and `tone` gives it one outside a `Field`.
 */
function TextInputRoot({
  value: held,
  defaultValue = "",
  onChange,
  autofill,
  multiline,
  size = "large",
  fill,
  tone,
  active,
  disabled: off,
  autoFocus,
  inputMode,
  onFocus,
  onBlur,
  "aria-label": label,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (text: string) => void;
  autofill?: string;
  multiline?: boolean;
  size?: "large" | "small";
  /** Small, across the room its row leaves. */
  fill?: boolean;
  tone?: FieldTone;
  active?: boolean;
  disabled?: boolean;
  /** Takes the focus as it's drawn, without scrolling to it. */
  autoFocus?: boolean;
  inputMode?: "decimal" | "text" | "email";
  onFocus?: () => void;
  onBlur?: () => void;
  "aria-label"?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [value, setValue] = useControllable(held, defaultValue, onChange);
  const typeIn = useTypedNote(setValue);
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused || active, tone });
  const disabled = off ?? field.disabled;
  const own = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useAutoFocus(own, autoFocus);
  const props = {
    ref: own,
    id: field.id,
    value,
    disabled,
    inputMode,
    "aria-label": label,
    "aria-describedby": field.hintId,
    onChange: (event: { target: { value: string } }) => setValue(event.target.value),
    onFocus: () => {
      if (!value && autofill) typeIn(autofill);
      onFocus?.();
    },
    onBlur,
  };
  return (
    <Typography
      tag="div"
      variant={size === "small" ? "metadata" : "bodyLarge"}
      className={cx(textInputStyle, className)}
      data-box=""
      data-size={size === "small" ? size : undefined}
      data-fill={fill ? "" : undefined}
      data-state={disabled ? undefined : field.state}
      data-disabled={disabled ? "" : undefined}
      data-multiline={multiline ? "" : undefined}
      {...focus}
    >
      <TextInputContext value={IN_TEXT_INPUT}>
        {partsOf(children, TextInputPrefix)}
        {multiline ? <textarea {...props} /> : <input {...props} autoComplete="off" />}
        {restOf(children, TextInputPrefix)}
      </TextInputContext>
    </Typography>
  );
}
TextInputRoot.displayName = "TextInput";

export const TextInput = Object.assign(TextInputRoot, { Prefix: ownPart(TextInputPrefix), Suffix: ownPart(TextInputSuffix) });

/** A field's `data-state`: its tone over its Active look, and nothing while it's disabled. */
export const fieldState = ({ tone, active, disabled }: { tone?: FieldTone; active?: boolean; disabled?: boolean }) =>
  disabled ? undefined : (tone ?? (active ? ("active" as const) : undefined));

/**
 * A form's actions are never disabled: pressed while something's missing, the form stays put and what's missing turns
 * Alert (`tried`) until it's filled in.
 */
export const alertIf = (tried: boolean, missing: boolean) => (tried && missing ? ("alert" as const) : undefined);

// SW Curie's Atoms/Form/Stepper (4376:12873); disabled, its box takes the disabled fills.
const stepperStyle = css(boxStateRaw, {
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  width: "fit-content",
  height: "2.5rem",
  padding: "var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  "& > span": { width: "2.25rem", textAlign: "center" },
  "& > button": {
    display: "flex",
    cursor: "pointer",
    _disabled: { opacity: 0.4, cursor: "default" },
  },
  "&[data-disabled]": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
  },
  "&[data-disabled] > button": { visibility: "hidden" },
});

/** Atoms/Form/Stepper: Less, the value and More, in a box that's Active while it's in use. */
function StepperRoot({
  value: held,
  defaultValue,
  onChange: heard,
  step = 1,
  min = 0,
  disabled: off,
  "aria-label": label,
}: {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [value, onChange] = useControllable(held, defaultValue ?? min, heard);
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused });
  const disabled = off ?? field.disabled;
  return (
    <div
      className={stepperStyle}
      role="group"
      aria-label={label}
      aria-labelledby={field.labelId}
      aria-describedby={field.hintId}
      data-box=""
      data-state={disabled ? undefined : field.state}
      data-disabled={disabled ? "" : undefined}
      {...focus}
    >
      <button
        type="button"
        aria-label="Less"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <SubtractIcon aria-hidden />
      </button>
      <Typography variant="bodyLarge" aria-live="polite">
        {value}
      </Typography>
      <button type="button" aria-label="More" disabled={disabled} onClick={() => onChange(value + step)}>
        <AddIcon aria-hidden />
      </button>
    </div>
  );
}

export const Stepper = named(StepperRoot, "Stepper");

// A table's 10px outline, above its rows so no cell's fill can cover it.
export const tableOutlineStyle = css({
  position: "relative",
  borderRadius: "var(--sw-radius-md)",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    pointerEvents: "none",
    // Its own compositing layer: without one, Safari can draw a scrolling table over it.
    willChange: "transform",
  },
  // A field's box (`data-box`): a field's border, and its ring while Active or in a tone. A table or calendar a form
  // needs filled in, left empty, rings Alert.
  "&[data-box]:not([data-state])::after": { boxShadow: "inset 0 0 0 1px var(--sw-border-default)" },
  "&[data-state=active]": { outline: "2px solid var(--sw-outline-focus)" },
  "&[data-state=active]::after": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "&[data-state=warning]": { outline: "2px solid var(--sw-outline-warning)" },
  "&[data-state=warning]::after": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)" },
  "&[data-state=alert]": { outline: "2px solid var(--sw-outline-alert)" },
  "&[data-state=alert]::after": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)" },
});

// An outlined table that hugs its rows, or scrolls them (`tableScrollerRaw` on the `Table`) in the room it's left; the
// outline sits over the sticky cells, a field's box's over its head too.
export const tableFrameStyle = cx(
  tableOutlineStyle,
  css({
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    "&::after": { zIndex: 6 },
    "&[data-box]::after": { zIndex: 8 },
  }),
);

export const tableScrollerRaw = css.raw({
  minHeight: 0,
  overflow: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

// A scrolling table's head, over the outline while its search has focus, so the ring shows whole.
export const stickyHeadStyle = css({
  position: "sticky",
  insetBlockStart: 0,
  zIndex: 5,
  _focusWithin: { zIndex: 7 },
});

export const hatchStyle = css({ backgroundImage: "var(--sw-hatch-gradient)" });

// Each part marked `data-placeholder` in it keeps its place and shapes: each line of its words a bar as long and as
// tall as their capitals, each icon a block. The glyphs' own fill, which no colour set on them overrides.
export const placeholdersStyle = css({
  "& [data-placeholder] *": {
    WebkitTextFillColor: "transparent",
    textDecorationLine: "line-through",
    textDecorationColor: "var(--sw-surface-disabled)",
    textDecorationThickness: "1cap",
    textDecorationSkipInk: "none",
  },
  "& [data-placeholder] svg": { backgroundColor: "var(--sw-surface-disabled)", borderRadius: "var(--sw-radius-xs)" },
  "& [data-placeholder] svg > *, & [data-placeholder] [data-chevron]": { visibility: "hidden" },
});

/** Marks a part `placeholdersStyle` draws as a placeholder, out of reach. */
export const PLACEHOLDER = { "data-placeholder": "", inert: true } as const;

// A table's focus and selection, turned inward so they stay inside it: a 1.5px border over its outline out to 4px. The sided
// form draws each side by its `--ring-*` (1, or 0 where the part meets another selected one, so those make one box).
const FOCUS_RING = "inset 0 0 0 1.5px var(--sw-border-focus), inset 0 0 0 4px var(--sw-outline-focus)";
const SELECTED_RING = "inset 0 0 0 1.5px var(--sw-border-selected), inset 0 0 0 4px var(--sw-outline-selected)";
const SELECTED_RING_SIDED =
  "inset 0 calc(var(--ring-top) * 1.5px) var(--sw-border-selected), inset calc(var(--ring-right) * -1.5px) 0 var(--sw-border-selected), inset 0 calc(var(--ring-bottom) * -1.5px) var(--sw-border-selected), inset calc(var(--ring-left) * 1.5px) 0 var(--sw-border-selected), inset 0 calc(var(--ring-top) * 4px) var(--sw-outline-selected), inset calc(var(--ring-right) * -4px) 0 var(--sw-outline-selected), inset 0 calc(var(--ring-bottom) * -4px) var(--sw-outline-selected), inset calc(var(--ring-left) * 4px) 0 var(--sw-outline-selected)";

// A selected table cell (`data-selected`), lit over the table's lines; the sides `data-joined` to selected neighbours
// open, so they make one box.
export const selectedCellRaw = css.raw({
  "--ring-top": "1",
  "--ring-right": "1",
  "--ring-bottom": "1",
  "--ring-left": "1",
  "&[data-joined~=top]": { "--ring-top": "0" },
  "&[data-joined~=right]": { "--ring-right": "0" },
  "&[data-joined~=bottom]": { "--ring-bottom": "0" },
  "&[data-joined~=left]": { "--ring-left": "0" },
  "&[data-selected]::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
    boxShadow: SELECTED_RING_SIDED,
  },
});

// A button filling a table cell, or a share of it: under the pointer, unless its cell is selected, it's Hover's shade,
// its cell's line and hatching showing through; Selected and ringed while the sheet it opens is (`data-sheet`), its
// keyboard focus showing instead. Never a pseudo-element: WebKit shifts the parts of a subgrid that has an absolutely
// positioned child.
export const sheetSlotRaw = css.raw({
  "&:is(button):not([data-sheet], :is([data-selected] *)):hover": { backgroundColor: "var(--sw-hover-shade)" },
  "&[data-sheet]:not(:focus-visible)": { boxShadow: SELECTED_RING },
});

// A field's focus: the whole cell holding a context search lights up, over the table's outline. The whole cell is the
// search's to press.
export const searchFocusStyle = css({
  cursor: "text",
  _focusWithin: { zIndex: 1, boxShadow: FOCUS_RING },
});

// `SegmentedControl`'s look: its buttons `aria-pressed`; small, Molecules/Filter/Segmented Control.
const segmentedStyle = css({
  display: "flex",
  flexShrink: 0,
  gap: "var(--sw-gap-xs)",
  width: "fit-content",
  height: "2.5rem",
  padding: "var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  // A segment's words, after its icon or before its count; it fills the box's height.
  "& > button": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sw-gap-xs)",
    minWidth: "4.75rem",
    paddingInline: "var(--sw-padding-md)",
    borderRadius: "var(--sw-radius-xxs)",
    cursor: "pointer",
    "& > svg, & > * > svg": { flexShrink: 0, margin: "0.0625rem" },
  },
  "& > button[aria-pressed=true]": { backgroundColor: "var(--sw-surface-selected)", color: "var(--sw-glyph-selected)" },
  // Small, a segment's words share a cell with a hidden copy at the pressed weight, so pressing it widens nothing.
  "&[data-size=small] > button": { display: "grid" },
  "&[data-size=small] > button > *": {
    gridArea: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sw-gap-xs)",
  },
  "&[data-size=small] > button > [aria-hidden]": { visibility: "hidden" },
  "&[data-wide] > button": { minWidth: "5.75rem" },
  // Across its field, the segments sharing it.
  "&[data-fill]": { width: "100%" },
  "&[data-fill] > button": { flex: "1 1 0" },
  "&[data-disabled]": { boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)" },
  "&[data-disabled] > button": { color: "var(--sw-glyph-disabled)", cursor: "default" },
  "&[data-disabled] > button[aria-pressed=true]": { backgroundColor: "var(--sw-surface-disabled)" },
  "&[data-size=small]": { gap: "var(--sw-gap-none)", height: "1.75rem", padding: "var(--sw-padding-xxs)" },
});

type SegmentedState = { value: string; onChange: (value: string) => void; disabled: boolean; small?: boolean };

const SegmentedContext = createContext<SegmentedState | null>(null);

/**
 * Molecules/Form/Segmented Control, and at size small Molecules/Filter/Segmented Control: its segments in a box, the
 * one holding `value` pressed; in a `Field`, named by its `Label`.
 */
function SegmentedControlRoot<T extends string>({
  value: held,
  defaultValue,
  onChange: heard,
  size = "large",
  layout = "hug",
  wide,
  disabled,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  className,
  ref,
  children,
}: {
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: "large" | "small";
  /** Figma's Segment Layout: Hug Contents, or Fill Container. */
  layout?: "hug" | "fill";
  wide?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  ref?: ComponentProps<"div">["ref"];
  children: ReactNode;
}) {
  const [value, onChange] = useControllable<string>(held, defaultValue ?? "", heard as ((value: string) => void) | undefined);
  const field = use(FieldContext);
  const off = disabled ?? field.disabled ?? false;
  return (
    <SegmentedContext value={{ value, onChange, disabled: off, small: size === "small" }}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        aria-labelledby={field.labelId ?? labelledBy}
        aria-describedby={field.hintId}
        className={cx(segmentedStyle, className)}
        data-size={size === "small" ? "small" : undefined}
        data-fill={layout === "fill" ? "" : undefined}
        data-wide={wide ? "" : undefined}
        data-disabled={off ? "" : undefined}
      >
        {children}
      </div>
    </SegmentedContext>
  );
}

function SegmentedControlSegment({
  value,
  disabled,
  children,
  ...props
}: Omit<ComponentProps<"button">, "value" | "onClick" | "color"> & { value: string }) {
  const control = useOwner(SegmentedContext, SegmentedControlSegment);
  const pressed = control.value === value;
  const face = pressed ? "metadataStrong" : "metadata";
  return (
    <Typography
      tag="button"
      variant={control.small ? face : "bodyLarge"}
      type="button"
      aria-pressed={pressed}
      disabled={control.disabled || disabled}
      onClick={() => control.onChange(value)}
      {...props}
    >
      {control.small ? (
        <>
          <Typography variant={face}>{children}</Typography>
          <Typography variant="metadataStrong" aria-hidden>
            {children}
          </Typography>
        </>
      ) : (
        children
      )}
    </Typography>
  );
}

SegmentedControlRoot.displayName = "SegmentedControl";
SegmentedControlSegment.displayName = "SegmentedControl.Segment";

export const SegmentedControl = Object.assign(SegmentedControlRoot, { Segment: ownPart(SegmentedControlSegment) });

// A panel down the app's end, portaled into its overlay layer: Small on the page's grey, Large the 1216 frame wide. A small
// one whose tab on show joins its body straight under the tabs is white, as the tab is, as is one given `surface`.
const sideSheetStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInlineEnd: 0,
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--sw-overlay-shadow)",
  // Its way in and out reads side-sheet-motion.ts's variables; each fallback is that file's default.
  transformOrigin: "var(--side-sheet-origin, 100% 50%)",
  transitionProperty: "opacity, translate, scale",
  transitionDuration: "var(--side-sheet-in-duration, 250ms)",
  transitionDelay: "var(--side-sheet-in-delay, 0ms)",
  transitionTimingFunction: "var(--side-sheet-in-easing, cubic-bezier(0.08, 0.59, 0.4, 1))",
  "&[data-entering]": {
    opacity: "var(--side-sheet-in-opacity, 0)",
    translate: "var(--side-sheet-in-from, 120px 0px)",
    scale: "var(--side-sheet-in-scale, 1)",
  },
  "[data-closing] &": {
    opacity: "var(--side-sheet-out-opacity, 0)",
    translate: "var(--side-sheet-out-to, 120px 0px)",
    scale: "var(--side-sheet-out-scale, 1)",
    transitionDuration: "var(--side-sheet-out-duration, 250ms)",
    transitionDelay: "var(--side-sheet-out-delay, 0ms)",
    transitionTimingFunction: "var(--side-sheet-out-easing, cubic-bezier(0.6, 0, 0.92, 0.4))",
  },
  "& > div:first-child": { backgroundColor: "var(--sw-surface-default)" },
  "&[data-size=small]": { width: "var(--sw-width-side-sheet-small)", backgroundColor: "var(--sw-surface-subdued)" },
  "&[data-size=small]:is(:has(> [role=tablist] + [role=tabpanel]), [data-surface=default])": {
    backgroundColor: "var(--sw-surface-default)",
  },
  "&[data-size=large]": {
    width: "var(--sw-width-side-sheet-large)",
    backgroundColor: "var(--sw-surface-default)",
    borderInlineStart: "1px solid var(--sw-border-subdued)",
  },
  "&[data-inline]": { position: "relative", transition: "none" },
  // Its bottom sheet's scrim stays among its own layers, under the app's snackbars.
  "&:has(> [data-docked], > * > [data-docked])": { isolation: "isolate" },
});

const contentsStyle = css({ display: "contents" });

/** A large side sheet's modal frame: the rest of the app walled off under a light scrim, a press on it closing the sheet. */
function ModalSheet({
  height,
  holds,
  entering,
  onClose,
  children,
}: {
  height?: CSSProperties["height"];
  holds?: boolean;
  entering?: boolean;
  onClose?: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useWalledOff(root);
  return (
    <div ref={root} className={contentsStyle}>
      <div
        className={scrimStyle}
        style={{ height }}
        data-scrim="light"
        data-sheet-scrim=""
        data-entering={entering ? "" : undefined}
        onPointerDown={() => !holds && onClose?.()}
      />
      {children}
    </div>
  );
}

/**
 * Organisms/Overlay/Side Sheet: a dialog named by `label` down the app's end, its `SideSheet.Header` over what it
 * holds, its parts closing it with `onClose`. Small is the Check-ins dashboard's worker; Large, a shift's or a
 * template's, the 1216 frame wide, and modal, a press on its scrim closing it unless it `holds`. Small, a press outside
 * it closes it unless what's pressed opens a small sheet too (`data-sheet-trigger`), which fills this one. `inline`
 * sits it where it's drawn.
 */
function SideSheetRoot({
  size = "small",
  label,
  inline,
  holds,
  onClose,
  className,
  style,
  onKeyDown,
  surface,
  ref,
  ...props
}: ComponentProps<"div"> & {
  size?: "small" | "large";
  label: string;
  inline?: boolean;
  holds?: boolean;
  onClose?: () => void;
  /** A small one's ground, white in place of the page's grey. */
  surface?: "default";
}) {
  const modal = size === "large" && !inline;
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  // Its way in starts a frame after it's first drawn, or the work of drawing it eats the start; what it defers is built
  // once it's in.
  const [phase, setPhase] = useState<"held" | "entering" | "in">(() => (inline || !watchesWayIn() ? "in" : "held"));
  useEffect(() => {
    if (phase === "held") {
      let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => setPhase("entering"))));
      return () => cancelAnimationFrame(frame);
    }
    if (phase !== "entering") return;
    let live = true;
    Promise.allSettled((own.current?.getAnimations() ?? []).map((run) => run.finished)).then(() => live && setPhase("in"));
    return () => {
      live = false;
    };
  }, [phase]);
  // A press on a page round the app (a live figure's) isn't one in it.
  useEffect(() => {
    if (size !== "small" || inline || !onClose) return;
    const down = (event: PointerEvent) => {
      const target = event.target as Element;
      const sheet = own.current;
      const app = sheet?.closest("[data-check-ins-app]");
      if (!sheet || sheet.contains(target) || (app && !app.contains(target))) return;
      if (target.closest?.(`${CONTROLS}, [data-sheet-trigger]`)?.hasAttribute("data-sheet-trigger")) return;
      onClose();
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [size, inline, onClose]);
  const sheet = (
    <OverlayContext value={{ onClose }}>
      <SheetIn value={phase === "in"}>
        <div
          ref={setRef}
          className={cx(sideSheetStyle, className)}
          style={style}
          role="dialog"
          aria-label={label}
          aria-modal={modal ? "true" : undefined}
          onKeyDown={(event) => {
            if (modal) keepFocusIn(event);
            onKeyDown?.(event);
          }}
          data-size={size}
          data-surface={surface}
          data-inline={inline ? "" : undefined}
          data-entering={phase === "held" ? "" : undefined}
          data-side-sheet=""
          {...props}
        />
      </SheetIn>
    </OverlayContext>
  );
  if (!modal) return sheet;
  return (
    <ModalSheet height={style?.height} holds={holds} entering={phase === "held"} onClose={onClose}>
      {sheet}
    </ModalSheet>
  );
}
SideSheetRoot.displayName = "SideSheet";

// jsdom has no Web Animations, so no way in to wait for.
const watchesWayIn = () => typeof Element !== "undefined" && "getAnimations" in Element.prototype;

// Whether the side sheet it's in has come in; outside one, always.
const SheetIn = createContext(true);

/**
 * What a side sheet holds past its header, built once the sheet is in. Till then, `fallback` loads in its place: the
 * same body, with only what shows first.
 */
function SideSheetDeferred({ fallback, children }: { fallback: ReactElement; children: ReactNode }) {
  if (use(SheetIn)) return children;
  return (
    <Wireframe asChild mode="loading">
      {fallback}
    </Wireframe>
  );
}
SideSheetDeferred.displayName = "SideSheet.Deferred";

export const SideSheet = Object.assign(SideSheetRoot, overlayParts("SideSheet"), { Deferred: ownPart(SideSheetDeferred) });

// A shift's summary: New Shift's review, and the Shift Planner's Shift Summary.
export const summarySectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlock: "var(--sw-padding-xl)",
  "& + &": { boxShadow: "inset 0 1px 0 var(--sw-border-subdued)" },
  "& > div:first-child": { display: "flex", alignItems: "center", justifyContent: "space-between" },
});

export const pairsStyle = css({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 18.75rem", gap: "var(--sw-gap-xl)" });

// A template's address over its directions.
export const addressStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-md)",
  flex: "1 1 auto",
  alignSelf: "stretch",
  "& > div:first-child": { display: "flex", flexDirection: "column" },
  "&[data-size=large]": { gap: "var(--sw-gap-xl)" },
});

// Figma's Toronto screenshot, framed on the site; large, the Mapbox frame of the Shift Summary.
export const mapStyle = css({
  position: "relative",
  // Its own stack, or Safari composites Google's tiles over a tooltip or list that hangs over the box.
  isolation: "isolate",
  height: "6.25rem",
  overflow: "hidden",
  borderRadius: "var(--sw-radius-xs)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "& > img": { position: "absolute", insetInlineStart: "-8.6875rem", insetBlockStart: "-10.4375rem", maxWidth: "none" },
  "& > svg": { position: "absolute", insetInlineStart: "5.5625rem", insetBlockStart: "2.4375rem" },
  "& > svg, & [data-pin]": { color: "var(--sw-glyph-alert)" },
  "[aria-busy=true] &": { backgroundColor: "var(--sw-surface-disabled)" },
  // As tall as what it's in: a minimap down a form's rows.
  "&[data-fill]": { height: "100%", minHeight: "6.25rem" },
  "&[data-size=large]": {
    flexShrink: 0,
    width: "18.75rem",
    height: "9.25rem",
    borderRadius: "var(--sw-radius-xs)",
    "& > img": { insetInlineStart: "-13.03125rem", insetBlockStart: "-15.75rem" },
    "& > svg": { insetInlineStart: "8.34375rem", insetBlockStart: "3.5625rem" },
    "&::after": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-subdued)" },
  },
  // Wide, the Address & Wage step's, across its form.
  "&[data-size=wide]": {
    height: "18.75rem",
    borderRadius: "var(--sw-radius-md)",
    "& > img": { insetInlineStart: "-16.6875rem", insetBlockStart: "-20.1875rem" },
    "&::after": { boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)" },
  },
  // Location, View Location's, edge to edge across its overlay.
  "&[data-size=location]": {
    height: "19.25rem",
    borderRadius: "var(--sw-radius-none)",
    boxShadow: "none",
    "& > img": { insetInlineStart: "-2.5rem", insetBlockStart: "-2.25rem", width: "40rem", height: "24.5rem" },
  },
  // Above the screenshot or Google's map, which would cover an inset shadow.
  "&:is([data-size=large], [data-size=wide])::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
  },
});

const pairStyle = css({
  display: "flex",
  flexDirection: "column",
  minWidth: "8.5rem",
  "& > [data-tone]": { alignSelf: "flex-start" },
});

/** `children` in two: those of the components in `types`, then the rest. */
export function partition(children: ReactNode, ...types: unknown[]) {
  const all = Children.toArray(children);
  const of = (node: ReactNode) => isValidElement(node) && types.includes(node.type);
  return [all.filter(of), all.filter((node) => !of(node))] as const;
}

/**
 * Atoms/Card Content/Label-value Pair: its slot stacks its label over its value, each a `Typography`, and Show Time
 * Difference's warning small `Chip` under them.
 */
function LabelValuePairRoot({ children }: { children: ReactNode }) {
  return <div className={pairStyle}>{children}</div>;
}
LabelValuePairRoot.displayName = "LabelValuePair";

export const LabelValuePair = LabelValuePairRoot;

// A table's header: white under the outline's top corners, a divider below.
export const tableHeadStyle = css({
  borderStartStartRadius: "var(--sw-radius-md)",
  borderStartEndRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
});

// A column's label in a table's header.
export const columnHeadRaw = css.raw({
  display: "flex",
  alignItems: "center",
  height: "2rem",
  paddingInline: "var(--sw-padding-sm)",
  color: "var(--sw-glyph-subdued)",
});

// A week's header, the Shifts table's and the Timesheet's: the search over both rows, each month over its days, then
// the days, with no lines between them.
export const weekSearchRaw = css.raw({
  gridColumn: "1",
  gridRow: "1 / span 2",
  height: "auto",
  display: "flex",
  alignItems: "flex-end",
  paddingBlock: "var(--sw-padding-xs)",
  paddingInline: "var(--sw-padding-sm)",
  borderStartStartRadius: "var(--sw-radius-md)",
  boxShadow: "inset -1px 0 0 var(--sw-border-subdued)",
});

export const weekMonthsStyle = css({
  display: "contents",
  "& > span": {
    display: "flex",
    alignItems: "center",
    height: "2rem",
    paddingInline: "var(--sw-padding-md)",
    color: "var(--sw-glyph-placeholder)",
    boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  },
  "& > span + span": { boxShadow: "inset 1px -1px 0 var(--sw-border-subdued)" },
});

/** A header cell divided from the next as the body's cells are. */
export const dividedRaw = css.raw({ "&:not(:last-child)": { boxShadow: "inset -1px 0 0 var(--sw-border-subdued)" } });

// A row of a table, divided from the one above, or from the body as the foot's first, over its cells' fills and its
// sticky cells.
export const tableRowRaw = css.raw({
  position: "relative",
  "& + &::after, [data-section=foot] > &:first-child::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  },
  "&:last-child": { borderEndStartRadius: "var(--sw-radius-md)", borderEndEndRadius: "var(--sw-radius-md)" },
  "&[data-picked]": { backgroundColor: "var(--sw-surface-selected)" },
  // A selected row (its sheet open, or picked) is lit whole, none of its cells on their own; rows selected one under
  // another make one box.
  "&:is([data-sheet], [data-picked])::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    zIndex: 2,
    borderRadius: "inherit",
    pointerEvents: "none",
    boxShadow: SELECTED_RING,
    "--ring-top": "1",
    "--ring-right": "1",
    "--ring-bottom": "1",
    "--ring-left": "1",
  },
  ":is([data-sheet], [data-picked]) + &": {
    "&:is([data-sheet], [data-picked])::before": { "--ring-top": "0", boxShadow: SELECTED_RING_SIDED },
  },
  "&:is([data-sheet], [data-picked]):has(+ :is([data-sheet], [data-picked]))::before": {
    "--ring-bottom": "0",
    boxShadow: SELECTED_RING_SIDED,
  },
});

// A table's or a record's cell: its parts down it, each in the middle of its line, spaced by its own margin so a line no
// part takes has no height. A part is as wide as it needs up to the cell's end, its text cut short there; a box (a row
// of parts, a field) runs across. An `Avatar` stands beside its parts' lines (`--lines` of them), a 28px one 8px off.
export const tableCellRaw = css.raw({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignContent: "center",
  alignItems: "center",
  justifyItems: "start",
  columnGap: "var(--sw-gap-xs)",
  minWidth: 0,
  paddingBlock: "var(--sw-padding-md)",
  paddingInline: "var(--sw-padding-sm)",
  "&:not(:last-child)": { boxShadow: "inset -1px 0 0 var(--sw-border-subdued)" },
  "& > *": { maxWidth: "100%" },
  "& > div, & > [data-line]": { justifySelf: "stretch" },
  // What holds an overlay hung in the cell isn't a part: spaced like one, it would grow a line no part takes.
  "& > :not([data-avatar]) ~ :not([data-avatar], :has(> [data-escape-layer]))": { marginBlockStart: "var(--sw-gap-xs)" },
  "& > [data-typography]:not([data-description])": {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "&:has(> [data-avatar])": { gridTemplateColumns: "auto minmax(0, 1fr)" },
  "&:has(> [data-avatar][data-size=inline])": { columnGap: "var(--sw-gap-sm)" },
  "& > [data-avatar]": { gridColumn: "1", gridRow: "1 / span var(--lines)" },
  "&:has(> [data-avatar]) > :not([data-avatar])": { gridColumn: "2" },
});

// A table cell's first line, as tall as the 28px buttons in its row, and the lines under it.
export const titleLineStyle = css({
  display: "flex",
  alignItems: "center",
  height: "1.75rem",
  minWidth: 0,
  whiteSpace: "nowrap",
});

export const lineStyle = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

// A table row pressed as a whole (it opens a side sheet, or picks its option): Hover under the pointer; Selected while
// its sheet is open (`data-sheet`) or its checkbox is picked (`data-picked`), deeper under the pointer.
export const sheetRowStyle = css({
  cursor: "pointer",
  "&:not([data-sheet], [data-picked]):hover": { backgroundColor: "var(--sw-hover-shade)" },
  "&:is([data-sheet], [data-picked])": {
    backgroundColor: "var(--sw-surface-selected)",
    _hover: { backgroundImage: "linear-gradient(var(--sw-surface-hover) 0 0)", backgroundBlendMode: "multiply" },
  },
});

// A sheet row's title as its button, for the keyboard.
export const titleButtonStyle = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  cursor: "pointer",
});

// What a press inside a row lands on that isn't the row's own: its controls and what they opened.
const CONTROLS = "button, a, input, textarea, [role=dialog], [role=menu]";

/** Whether a press on a sheet row is the row's own, not one of its controls' or what they opened; a dialog round it isn't. */
export const pressesRow = (event: MouseEvent) => {
  const control = (event.target as Element).closest(CONTROLS);
  return !control || !event.currentTarget.contains(control);
};

// SW Curie's Molecules/Link: its colour changes, never its ground, and its text is underlined while pointed at or
// pressed (Figma's 1.5px rule at the foot of the 20px line).
const linkStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xxs)",
  color: "var(--sw-glyph-link-primary-default)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  textDecorationThickness: "1.5px",
  textUnderlineOffset: "0.25rem",
  [ENABLED]: {
    _hover: { color: "var(--sw-glyph-link-primary-hover)", textDecorationLine: "underline" },
    _active: { color: "var(--sw-glyph-link-primary-active)", textDecorationLine: "underline" },
  },
  _disabled: { cursor: "default", color: "var(--sw-glyph-link-primary-disabled)" },
});

/** Molecules/Link: a button that reads as a link; icons go in beside its words. */
export function Link({ className, children, ...props }: Omit<ComponentProps<"button">, "color">) {
  return (
    <Typography tag="button" variant="metadata" type="button" className={cx(linkStyle, className)} {...props}>
      {children}
    </Typography>
  );
}

const disclosureStyle = css({
  display: "flex",
  flexDirection: "column",
  "& > button": { alignSelf: "flex-start" },
  "& > button > svg": { width: "1.25rem", height: "1.25rem", transition: "rotate 250ms cubic-bezier(0.22, 1, 0.36, 1)" },
  "& > button[aria-expanded=true] > svg": { rotate: "180deg" },
  // What it holds grows from no height to its own.
  "& > div": {
    display: "grid",
    gridTemplateRows: "0fr",
    transition: "grid-template-rows 250ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  "& > div[data-open]": { gridTemplateRows: "1fr" },
  "& > div > div": { minHeight: 0, overflow: "hidden" },
  _motionReduce: { "& > div, & > button > svg": { transition: "none" } },
});

/**
 * A `Link` showing and hiding what it holds under it: its words, `show` or `hide`, say what a press does; its chevron
 * turns. Shut unless `open`, which `onOpenChange` hears a press change.
 */
export function Disclosure({
  show,
  hide,
  open: held,
  onOpenChange,
  children,
}: {
  show: string;
  hide: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useControllable(held, false, onOpenChange);
  const id = useId();
  return (
    <div className={disclosureStyle}>
      <Link aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? hide : show}
        <ChevronDownIcon aria-hidden />
      </Link>
      <div id={id} data-open={open ? "" : undefined} aria-hidden={!open} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}

// SW Curie's Organisms/Card: a box whose slot holds anything, its parts stacked. Ending in its records (`Card.Records`)
// it ends 4px under the last; records alone, it has no padding above or below, nor a rule over the first.
const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  minWidth: 0,
  padding: "var(--sw-padding-xl)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "&:has(> [data-records]:last-child:not(:first-child))": { paddingBlockEnd: "var(--sw-padding-xs)" },
  "&:has(> [data-records]:only-child)": { paddingBlock: "var(--sw-padding-none)" },
  "& > [data-records]:first-child > :first-child": { boxShadow: "none" },
  // Over a zone, the last record is ruled off below too; lit (a record that's a button, pointed at), it has no rules,
  // and under a lit one, only its rule below.
  "& > [data-records]:has(+ [data-zone]) > :last-child": {
    boxShadow: "inset 0 1px 0 var(--sw-border-subdued), inset 0 -1px 0 var(--sw-border-subdued)",
  },
  "& > [data-records]:has(+ [data-zone]) > :last-child:is(button, :has(> button)):hover": { boxShadow: "none" },
  "& > [data-records]:has(+ [data-zone]) > :is(button, :has(> button)):hover + :last-child": {
    boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  },
  // Pressed as a whole through its `Press`, outlined as a tab card is.
  "&:has([data-card-press])": { position: "relative", _hover: { boxShadow: "inset 0 0 0 1px var(--sw-border-default)" } },
  "&:has([data-card-press]:focus-visible)": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "&[data-subgrid]": { display: "grid", gridTemplateRows: "subgrid" },
  // Deactivated: its fill, and its header's words and picture, subdued.
  "&[data-subdued]": {
    backgroundColor: "var(--sw-surface-subdued)",
    "& > [data-card-header]": { color: "var(--sw-glyph-subdued)" },
    "& > [data-card-header] [data-avatar] > span": { backgroundColor: "var(--sw-surface-disabled)", color: "var(--sw-glyph-subdued)" },
  },
});

// What has a hit area of its own inside a card, so a press there doesn't open or close it.

// A thumbnail, title and actions abreast; aligned to its top, a title's line is as tall as the 28px buttons beside it.
const cardHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--sw-gap-md)",
  "& > [data-typography]": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "&[data-align=start]": {
    alignItems: "flex-start",
    "& > [data-typography], & > [data-card-content] > [data-typography]:first-child": { lineHeight: "1.75rem" },
    // A 1.5rem pill leading the content sits centred in that line, at its own width.
    "& > [data-card-content] > [data-shape=pill]:first-child": { alignSelf: "flex-start", marginBlock: "var(--sw-margin-xxs)" },
  },
});

// Figma's Content Wrapper: its title over its subcontent, each a `Typography` on one line.
const cardContentStyle = css({
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  minWidth: 0,
  "& > [data-typography]": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

const cardActionsStyle = css({
  display: "flex",
  flexShrink: 0,
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  "&[data-gap=xs]": { gap: "var(--sw-gap-xs)" },
  "&[data-gap=xl]": { gap: "var(--sw-gap-xl)" },
  "[data-align=start] > &": { minHeight: "1.75rem" },
});

const cardRecordsStyle = css({ display: "flex", flexDirection: "column" });

// A part ruled off from the next.
const cardSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlockEnd: "var(--sw-padding-xl)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
});

const cardFooterStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" });

// Its hit area reaches over the whole card.
const cardPressStyle = css({
  width: "fit-content",
  textAlign: "start",
  cursor: "pointer",
  outline: "none",
  "&::after": { content: '""', position: "absolute", inset: 0 },
});

// The record picked among a card's records (by their `value`).
const CardContext = createContext<{ value?: string; pick: (value: string) => void }>({ pick: () => {} });

/** The value of the record picked among a card's, and picking another. */
export const useCardValue = () => {
  const { value, pick } = use(CardContext);
  return { value, pick };
};

function CardRoot({
  defaultValue,
  subgrid,
  subdued,
  className,
  ...props
}: Omit<ComponentProps<"div">, "defaultValue"> & {
  defaultValue?: string;
  /** Its parts on the rows of the grid holding it, a row each, level with those of the cards beside it. */
  subgrid?: boolean;
  /** What it stands for is deactivated. */
  subdued?: boolean;
}) {
  const [value, pick] = useState(defaultValue);
  return (
    <CardContext value={{ value, pick }}>
      <div
        className={cx(cardStyle, className)}
        data-card=""
        data-subgrid={subgrid ? "" : undefined}
        data-subdued={subdued ? "" : undefined}
        {...props}
        style={subgrid ? { gridRow: `span ${Children.toArray(props.children).length}`, ...props.style } : props.style}
      />
    </CardContext>
  );
}

function CardHeader({ align, className, ...props }: ComponentProps<"div"> & { align?: "start" }) {
  return <div className={cx(cardHeaderStyle, className)} data-card-header="" data-align={align} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx(cardContentStyle, className)} data-card-content="" {...props} />;
}

function CardActions({ gap, className, ...props }: ComponentProps<"div"> & { gap?: "xs" | "xl" }) {
  return <div className={cx(cardActionsStyle, className)} data-gap={gap} {...props} />;
}

function CardRecords({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx(cardRecordsStyle, className)} data-records="" {...props} />;
}

function CardSection({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx(cardSectionStyle, className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx(cardFooterStyle, className)} {...props} />;
}

/** Presses the card as a whole: its title, a `Typography`, as a button. */
function CardPress({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cx(cardPressStyle, className)} data-card-press="" {...props} />;
}

CardRoot.displayName = "Card";
CardHeader.displayName = "Card.Header";
CardContent.displayName = "Card.Content";
CardActions.displayName = "Card.Actions";
CardRecords.displayName = "Card.Records";
CardSection.displayName = "Card.Section";
CardFooter.displayName = "Card.Footer";
CardPress.displayName = "Card.Press";

/**
 * Organisms/Card: an empty box with a slot. Its layouts are compositions of its parts: a `Header` (a thumbnail, its
 * `Content` of a title over subcontent, each a `Typography`, its `Actions`), then `Records`, `Section`s or a `Footer`. Its `Press`
 * presses it whole.
 */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Content: CardContent,
  Actions: CardActions,
  Records: CardRecords,
  Section: CardSection,
  Footer: CardFooter,
  Press: CardPress,
});

// Every overlay slides from `--entrance-from` as it fades in, and back the same way as it fades out while `Presence`
// holds it. The way out is a transition: the same keyframes reversed wouldn't restart, and would end at once.
export const enterRaw = css.raw({
  "--entrance-from": "-4px",
  animation: "playgroundChromeIn 150ms cubic-bezier(0.22, 1, 0.36, 1)",
  "[data-closing] &": {
    opacity: 0,
    translate: "0 var(--entrance-from)",
    transition: "opacity 150ms cubic-bezier(0.64, 0, 0.78, 0), translate 150ms cubic-bezier(0.64, 0, 0.78, 0)",
  },
});

// A filter's 28px box (Atoms/Filter), and the panel it opens under itself.
export const selectStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  height: "1.75rem",
  paddingInline: "var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  whiteSpace: "nowrap",
  "&[aria-expanded=true]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
    outline: "2px solid var(--sw-outline-focus)",
  },
  // Its currentColor chevron or calendar turns active while open.
  "&[aria-expanded=true] > svg": { color: "var(--sw-glyph-selected)" },
  _disabled: {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    cursor: "default",
  },
  // Words and a count kept closer than the chevron (Molecules/Range Selector, Molecules/Filter/Date Picker).
  "& > [data-group]": { display: "flex", alignItems: "center", gap: "var(--sw-gap-xxs)" },
  // Atoms/Filter/Bulk Select: a box around a checkbox and its menu's chevron, Active while that menu is open.
  "&[data-bulk]": { width: "fit-content", gap: "var(--sw-gap-none)", paddingInline: "var(--sw-padding-xs)" },
  // Large, as far from its checkbox above and below as beside it.
  "&[data-bulk][data-size=large]": { height: "auto", paddingBlock: "var(--sw-padding-xs)" },
  "&[data-bulk]:has(> [aria-expanded=true])": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
    outline: "2px solid var(--sw-outline-focus)",
    color: "var(--sw-glyph-selected)",
  },
  // Subtle, a plain checkbox until pointed at, focused by keyboard or open, when its box opens out round the chevron.
  "&[data-subtle]": {
    transition: "background-color 300ms ease, box-shadow 300ms ease",
    "& > [aria-haspopup]": { width: "1.25rem", transition: "width 300ms ease, opacity 300ms ease" },
  },
  "&[data-subtle]:not(:hover):not(:has(:focus-visible)):not(:has(> [aria-expanded=true]))": {
    backgroundColor: "transparent",
    boxShadow: "none",
    "& > [aria-haspopup]": { width: 0, opacity: 0 },
  },
  // Across a table cell, its value (`data-value`) before the chevron at the end (the Inline Edit's Cell Input).
  "&[data-fill]": { width: "100%", "& > [data-value]": { flex: "1 1 auto", minWidth: 0, textAlign: "start" } },
});

export const panelStyle = css(enterRaw, {
  position: "absolute",
  insetBlockStart: "2rem",
  insetInlineStart: 0,
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
  width: "var(--sw-width-dropdown)",
  maxHeight: "15rem",
  overflowY: "auto",
  paddingInline: "var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
  outline: "2px solid var(--sw-outline-focus)",
  // Over its box where `useFlip` puts it.
  "&[data-side=above]": { insetBlockStart: "auto", insetBlockEnd: "2rem", "--entrance-from": "4px" },
  // Under or over a large Bulk Select's taller box.
  "&[data-size=large]": { insetBlockStart: "calc(100% + 0.25rem)" },
  "&[data-size=large][data-side=above]": { insetBlockStart: "auto", insetBlockEnd: "calc(100% + 0.25rem)" },
  // As wide as the box it fills, so a cell's inline edit keeps its list in the cell's column.
  "&[data-fill]": { width: "auto", insetInlineEnd: 0 },
  // Plain list items, edge to edge (Atoms/Filter/Bulk Select); `short`, Atoms/Filter/Dropdown's.
  "&[data-list]": { paddingInline: "var(--sw-padding-none)" },
  "&[data-list=short]": { maxHeight: "11.25rem" },
  // As big as what it holds (Molecules/Filter/Date Picker's views, Molecules/Range Selector's range).
  "&[data-hug]": {
    width: "auto",
    maxHeight: "none",
    paddingInline: "var(--sw-padding-none)",
    overflowY: "hidden",
  },
  // Edge to edge, a hovered item's fill would cover an inset shadow; a border stays clear of it.
  "&[data-list], &[data-hug]": {
    boxShadow: "none",
    border: "1.5px solid var(--sw-border-focus)",
  },
});


/**
 * Keeps an overlay that `children` drops (`{open && <Overlay />}`) on screen, marked `data-closing`, until the exit
 * animations inside it have run; an overlay without one goes at once.
 */
export function Presence({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<ReactNode>(children);
  if (children && children !== held) setHeld(children);
  const closing = !children && !!held;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!closing || !node) return;
    let live = true;
    const exits = (node.getAnimations?.({ subtree: true }) ?? []).filter(
      (animation) => animation.effect?.getComputedTiming().endTime !== Infinity,
    );
    Promise.allSettled(exits.map((animation) => animation.finished)).then(() => live && setHeld(null));
    return () => {
      live = false;
    };
  }, [closing]);

  if (!children && !held) return null;
  return (
    <div ref={root} className={contentsStyle} data-closing={closing ? "" : undefined}>
      {children || held}
    </div>
  );
}

// SW Curie's overlays (Manual Check-in 23516:164298, Messages 23658:29237, View Location 23522:164593).
export const overlayRaw = css.raw({
  width: "var(--sw-width-overlay-small)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "var(--sw-overlay-shadow)",
  cursor: "default",
  textAlign: "start",
});

/** A form's overlay, as tall as New shift's: its header and action bar hold still while its fields scroll. */
export const formOverlayRaw = css.raw({ display: "flex", flexDirection: "column", height: "47.25rem", overflow: "hidden" });

// An overlay hung beside what opened it; `usePlacement` picks the side once it's measured.
export const hungRaw = css.raw(enterRaw, {
  position: "absolute",
  insetBlockStart: "calc(100% - 0.25rem)",
  insetInlineEnd: "0.5rem",
  zIndex: 3,
  // `reveal`'s room below, which stretches the scroller's range; outside `overlayClipStyle`, so nothing clips it.
  "&::after": {
    content: '""',
    position: "absolute",
    insetBlockStart: "100%",
    insetInline: 0,
    height: "1.5rem",
    pointerEvents: "none",
  },
});

// A popover hung beside what opened it, outlined, its parts xs in from its edge.
export const popoverRaw = css.raw(overlayRaw, hungRaw, {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  padding: "var(--sw-padding-xs)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued), var(--sw-overlay-shadow)",
});

/** An overlay's content, cut to its corners and to its height as that eases. */
const overlayClipStyle = css({
  height: "100%",
  overflow: "hidden",
  borderRadius: "inherit",
});

const overlayHeaderStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-md)",
  padding: "var(--sw-padding-xl)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "& > div:first-child": { display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-md)" },
  "& > div:first-child > span": {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/** What an overlay's parts close it with. */
const OverlayContext = createContext<{ onClose?: () => void }>({});

/**
 * The parts every overlay family takes, named after it (`Dialog.Header`). Molecules/Overlay/Overlay Header: its title
 * (its first part, a `Typography`), then its `SheetActions` and `Close`, wherever they're placed; the rest goes under
 * them. Close and the Action Bar's Cancel close the overlay unless given their own `onClick`.
 */
function overlayParts(family: string) {
  function SheetActions({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  function Close({ onClick }: { onClick?: () => void }) {
    const overlay = use(OverlayContext);
    return (
      <Button size="icon" aria-label="Close" onClick={onClick ?? overlay.onClose}>
        <CloseIcon aria-hidden />
      </Button>
    );
  }

  function Header({ children }: { children: ReactNode }) {
    const [row, others] = partition(children, SheetActions, Close);
    const [title, ...rest] = Children.toArray(others);
    return (
      <div className={overlayHeaderStyle}>
        <div>
          {title}
          {row}
        </div>
        {rest}
      </div>
    );
  }

  /** An overlay's form, between its header and its action bar. */
  function Body(props: ComponentProps<"div">) {
    return <div className={formStyle} {...props} />;
  }

  /**
   * Molecules/Overlay/Action Bar: its `Cancel`, then its `ForwardActions`. `floating`, it lies over the overlay's foot,
   * which scrolls on under it.
   */
  function ActionBar({ floating, children, ...props }: Omit<ComponentProps<"div">, "className"> & { floating?: boolean }) {
    return (
      <div {...props} className={floating ? floatingBarStyle : actionBarStyle} data-action-bar="" data-floating={floating ? "" : undefined}>
        {children}
      </div>
    );
  }

  function Cancel({ children = "Cancel", onClick, ...props }: Omit<ComponentProps<typeof Button>, "size" | "emphasis">) {
    const overlay = use(OverlayContext);
    return (
      <Button emphasis="tertiary" onClick={onClick ?? overlay.onClose} {...props}>
        {children}
      </Button>
    );
  }

  /** The Action Bar's Forward Actions: a change summary, a supplementary action, and its Primary CTA, in that order. */
  function ForwardActions({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  /** The Forward Actions' change summary: an Unsaved Changes icon, if any, before its Label-value Pair. */
  function ChangeSummary({ children }: { children: ReactNode }) {
    return <div className={changeSummaryStyle}>{children}</div>;
  }

  Header.displayName = `${family}.Header`;
  SheetActions.displayName = `${family}.SheetActions`;
  Close.displayName = `${family}.Close`;
  Body.displayName = `${family}.Body`;
  ActionBar.displayName = `${family}.ActionBar`;
  Cancel.displayName = `${family}.Cancel`;
  ForwardActions.displayName = `${family}.ForwardActions`;
  ChangeSummary.displayName = `${family}.ChangeSummary`;
  return { Header, SheetActions, Close, Body, ActionBar, Cancel, ForwardActions, ChangeSummary };
}

const formStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  padding: "var(--sw-padding-xl)",
});

// Rises from the foot of what it's in, and sinks back while `Presence` holds it.
const riseRaw = css.raw({
  animation: "bottomSheetIn 250ms cubic-bezier(0.22, 1, 0.36, 1)",
  "[data-closing] &": {
    opacity: 0,
    translate: "0 100%",
    transition: "opacity 250ms cubic-bezier(0.64, 0, 0.78, 0), translate 250ms cubic-bezier(0.64, 0, 0.78, 0)",
  },
});

const actionBarRaw = css.raw({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "var(--sw-padding-xl)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > div": { display: "flex", gap: "var(--sw-gap-xl)" },
});

const actionBarStyle = css(actionBarRaw);

// Over everything the overlay holds, a table's sticky head included.
const floatingBarStyle = css(actionBarRaw, riseRaw, {
  position: "absolute",
  insetInline: 0,
  insetBlockEnd: 0,
  zIndex: 8,
});

const changeSummaryStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  "& > svg": { flexShrink: 0, color: "var(--sw-glyph-default)" },
});

/** Dims the whole app; set its `height` to the app's. */
export const scrimStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInline: 0,
  backgroundColor: "var(--sw-scrim)",
  "--entrance-from": "0px",
  "--scrim-duration": "150ms",
  animation: "playgroundChromeIn var(--scrim-duration) cubic-bezier(0.22, 1, 0.36, 1)",
  "[data-closing] &": { opacity: 0, transition: "opacity var(--scrim-duration) cubic-bezier(0.64, 0, 0.78, 0)" },
  "&[data-scrim=light]": { backgroundColor: "var(--sw-scrim-light)" },
  // A large side sheet's: its timing reads side-sheet-motion.ts's variables, and it waits as the sheet does.
  "&[data-sheet-scrim]": {
    "--scrim-duration": "var(--side-sheet-scrim-in, 250ms)",
    animationDelay: "var(--side-sheet-scrim-delay, 0ms)",
    animationFillMode: "backwards",
    animationTimingFunction: "var(--side-sheet-in-easing, cubic-bezier(0.08, 0.59, 0.4, 1))",
    "[data-closing] &": {
      "--scrim-duration": "var(--side-sheet-scrim-out, 250ms)",
      transitionTimingFunction: "var(--side-sheet-out-easing, cubic-bezier(0.6, 0, 0.92, 0.4))",
    },
  },
  "&[data-entering]": { opacity: 0, animation: "none" },
});

// The card centres in the scrim, and scrolls when the app is shorter. Docked, the scrim fills the side sheet it's in,
// fading as long as its card slides.
const modalStyle = css({
  display: "flex",
  padding: "var(--sw-padding-3xl)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  // Over all its side sheet holds, a field box's 8 included.
  "&[data-docked]": {
    zIndex: 9,
    insetBlockEnd: 0,
    alignItems: "flex-end",
    padding: 0,
    overflow: "hidden",
    animationDuration: "250ms",
    "[data-closing] &": { transitionDuration: "250ms" },
  },
});

// No taller than the app's window, so an overlay whose body scrolls keeps its header and action bar in view; cut to its
// corners, which its action bar's fill would square off.
const modalCardRaw = css.raw(enterRaw, { flexShrink: 0, maxHeight: "100%", margin: "auto", outline: "none", overflow: "hidden" });

// Across the side sheet's foot, rising from it as a side sheet comes in from the app's end; its fields scroll when
// they outgrow the sheet.
const dockedCardRaw = css.raw(riseRaw, {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  maxHeight: "100%",
  backgroundColor: "var(--sw-surface-default)",
  borderBlockStart: "1px solid var(--sw-border-subdued)",
  outline: "none",
  cursor: "default",
  textAlign: "start",
});

/**
 * Walls off the rest of the app, or of what `within` names round it, while `root` is up, all but what's marked
 * `data-unwalled` (its snackbars). It goes inert, where Safari's Tab (fields only) would otherwise slip past
 * `keepFocusIn`; the focus goes back to what had it once `root` goes.
 */
export function useWalledOff(root: RefObject<HTMLElement | null>, within = "[data-check-ins-app]") {
  // Read as it opens, before a field in it takes the focus.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  useEffect(() => {
    const own = root.current;
    const app = own?.closest(within);
    const walled: HTMLElement[] = [];
    for (let node: HTMLElement | null = own; node?.parentElement && node !== app; node = node.parentElement)
      for (const sibling of node.parentElement.children)
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.matches("[inert], [data-unwalled]")) walled.push(sibling);
    for (const node of walled) node.toggleAttribute("inert", true);
    return () => {
      for (const node of walled) node.toggleAttribute("inert", false);
      // Only once it's left the page: Strict Mode's rehearsal unmount keeps it in, and its field's focus.
      if (!own?.isConnected) opener?.focus({ preventScroll: true });
    };
  }, [root, within, opener]);
}

/** Keeps Tab and Shift-Tab cycling inside the element that has the handler. */
export function keepFocusIn(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const container = event.currentTarget;
  const items = [
    // One `:is()`, as jsdom lists a selector list's matches selector by selector, not in the page's order.
    ...container.querySelectorAll<HTMLElement>(":is(button:not(:disabled), input, textarea, [tabindex='0'])"),
  ].filter((item) => !item.closest("[inert]"));
  const [first, last] = [items[0], items.at(-1)];
  const wrap = () => (event.shiftKey ? last : first)?.focus();
  const at = document.activeElement;
  if (event.shiftKey ? at === first || at === container : at === last) {
    event.preventDefault();
    wrap();
    return;
  }
  // Safari's Tab skips buttons, so it can pass the last field straight out of the walled-off app; that's brought back.
  const app = container.closest("[data-check-ins-app]");
  const back = (moved: Event) => {
    if (!container.contains(moved.target as Node) && !app?.contains(moved.target as Node)) wrap();
  };
  document.addEventListener("focusin", back, { once: true });
  setTimeout(() => document.removeEventListener("focusin", back));
}

type OverlayBase = Omit<ComponentProps<"div">, "css"> & {
  label: string;
  /** Escape, the header's Close and the action bar's Cancel call it, and a modal's scrim; without it, it closes itself. */
  onClose?: () => void;
  css?: SystemStyleObject;
};

type Framed<P> = P & { onClose: () => void };

type ModalProps = OverlayBase & {
  inline?: false;
  /** The app's, which the dialog covers. */
  height: number;
  scrim?: "light";
  /** Stays up when its scrim is pressed. */
  holds?: boolean;
};

type DockedProps = OverlayBase & {
  /** Stays up when its scrim is pressed. */
  holds?: boolean;
};

type HungProps = OverlayBase & {
  /** What opened it, which it hangs beside. */
  trigger?: HTMLElement | null;
  /** To its trigger's right, level with its top, or its left where there's no room (`placeBeside`). */
  beside?: boolean;
  /** In the page's flow, as the design system shows it. */
  inline?: boolean;
};

/** A dialog over the whole app, portaled into its overlay layer and walled off from the rest; `docked`, over its side sheet's. */
function ModalFrame({
  label,
  onClose,
  css: card,
  height,
  scrim,
  holds,
  docked,
  inline: _inline,
  style,
  children,
  ...props
}: Framed<Omit<ModalProps, "height"> & { height?: number; docked?: boolean }>) {
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const hold = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    setLayer(node);
  }, []);
  useEscapeLayer(root, true, onClose);
  useWalledOff(root, docked ? "[data-side-sheet]" : undefined);

  useEffect(() => {
    if (!box.current?.contains(document.activeElement)) box.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={hold}
      className={cx(scrimStyle, modalStyle)}
      style={{ height }}
      data-scrim={scrim ?? ""}
      data-docked={docked ? "" : undefined}
      data-escape-layer=""
      onPointerDown={(event) => !holds && event.target === event.currentTarget && onClose()}
    >
      <div
        ref={box}
        className={docked ? css(dockedCardRaw, card) : css(overlayRaw, modalCardRaw, card)}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={keepFocusIn}
        {...props}
      >
        <ScrimContext value={layer}>{children}</ScrimContext>
      </div>
    </div>
  );
}

function HungFrame({ label, onClose, css: own, trigger = null, beside, inline, style, children, ...props }: Framed<HungProps>) {
  const root = useRef<HTMLDivElement>(null);
  useEscapeLayer(root, true, onClose);
  const placement = usePlacement(root, trigger, beside);
  return (
    <div
      ref={root}
      className={css(overlayRaw, inline ? enterRaw : hungRaw, own)}
      style={{ ...placement, ...style }}
      role="dialog"
      aria-label={label}
      data-escape-layer=""
      {...props}
    >
      <div className={overlayClipStyle}>{children}</div>
    </div>
  );
}

/** Gives an overlay's parts what closes it: `onClose`, or without one, the overlay itself, which then leaves. */
function Closable({ onClose, children }: { onClose?: () => void; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(true);
  const close = onClose ?? (() => setOpen(false));
  const frame = <OverlayContext value={{ onClose: close }}>{children(close)}</OverlayContext>;
  if (onClose) return frame;
  return <Presence>{open && frame}</Presence>;
}

/** A modal's props: they carry the app's `height`, which it covers. */
const isModal = (props: HungProps | ModalProps): props is ModalProps => "height" in props;

/**
 * SW Curie's overlay: over the whole app given its `height`, walled off from the rest, a press on its scrim closing it
 * unless it `holds`; or hung beside its `trigger`; or `inline` in the page's flow.
 */
function OverlayRoot(props: HungProps | ModalProps) {
  return (
    <Closable onClose={props.onClose}>
      {(close) => (isModal(props) ? <ModalFrame {...props} onClose={close} /> : <HungFrame {...props} onClose={close} />)}
    </Closable>
  );
}
OverlayRoot.displayName = "Overlay";

export const Overlay = Object.assign(OverlayRoot, overlayParts("Overlay"));

/**
 * A bottom sheet: a dialog across the foot of the side sheet it's drawn in, the rest of that sheet walled off under a
 * light scrim, a press on which closes it unless it `holds`.
 */
function BottomSheetRoot(props: DockedProps) {
  return <Closable onClose={props.onClose}>{(close) => <ModalFrame {...props} scrim="light" docked onClose={close} />}</Closable>;
}
BottomSheetRoot.displayName = "BottomSheet";

export const BottomSheet = Object.assign(BottomSheetRoot, overlayParts("BottomSheet"));

// SW Curie's confirmation dialog, Dialog wide.
const dialogRaw = css.raw({ width: "var(--sw-width-dialog)" });

/** SW Curie's confirmation dialog: over the whole app as an overlay is, or `inline` in the page's flow. */
function DialogRoot(props: ModalProps | (OverlayBase & { inline: true })) {
  const own = { ...dialogRaw, ...props.css };
  return (
    <Closable onClose={props.onClose}>
      {(close) =>
        props.inline ? <HungFrame {...props} css={own} onClose={close} /> : <ModalFrame {...props} css={own} onClose={close} />
      }
    </Closable>
  );
}
DialogRoot.displayName = "Dialog";

export const Dialog = Object.assign(DialogRoot, overlayParts("Dialog"));

// SW Curie's Text Area box: 115 high, so 140 with its label (`large` 375, `medium` the Billable Duration Card's 215).
const textAreaStyle = css(boxStateRaw, {
  position: "relative",
  display: "flex",
  flexShrink: 0,
  height: "7.25rem",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  "&[data-disabled]": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  },
  "&[data-disabled] textarea": { color: "var(--sw-glyph-disabled)" },
  "& > svg": {
    position: "absolute",
    insetInlineEnd: "0.125rem",
    insetBlockEnd: "0.125rem",
    pointerEvents: "none",
  },
  "& textarea": {
    flex: "1 1 auto",
    paddingBlock: "var(--sw-padding-sm)",
    paddingInline: "var(--sw-padding-md)",
    font: "inherit",
    color: "var(--sw-glyph-default)",
    backgroundColor: "transparent",
    resize: "none",
    outline: "none",
  },
  "&[data-size=large]": { height: "23.5rem" },
  "&[data-size=medium]": { height: "13.5rem" },
});

/**
 * SW Curie's Text Area: the box typed in, holding what's typed from `defaultValue` unless its owner holds `value`;
 * `autofill` types itself in the first time it's focused empty, and `fixed` drops its resize handle.
 */
function TextAreaRoot({
  value: held,
  defaultValue = "",
  onChange,
  autofill,
  autoFocus,
  maxLength,
  size,
  fixed,
  disabled: off,
  "aria-label": label,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (text: string) => void;
  autofill?: string;
  /** Takes the focus as it's drawn, without scrolling to it. */
  autoFocus?: boolean;
  maxLength?: number;
  size?: "large" | "medium";
  fixed?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [value, setValue] = useControllable(held, defaultValue, onChange);
  const typeIn = useTypedNote(setValue);
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused });
  const disabled = off ?? field.disabled;
  const own = useRef<HTMLTextAreaElement>(null);
  useAutoFocus(own, autoFocus);
  return (
    <Typography
      tag="div"
      variant="bodyLarge"
      className={textAreaStyle}
      data-box=""
      data-size={size}
      data-state={disabled ? undefined : field.state}
      data-disabled={disabled ? "" : undefined}
      {...focus}
    >
      <textarea
        ref={own}
        id={field.id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-label={label}
        aria-describedby={field.hintId}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          if (!value && autofill) typeIn(autofill);
        }}
      />
      {!fixed && <ResizeHandle aria-hidden />}
    </Typography>
  );
}

export const TextArea = named(TextAreaRoot, "TextArea");

/** Lets an enclosing dialog's Escape (prototype-overlay) close what `ref` holds while it's open. */
/** The nearest ancestor that scrolls: the part of the app an overlay must fit in. */
function scrollerOf(node: HTMLElement) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement)
    if (scrolls(parent)) return parent;
  return null;
}

/**
 * The side `popover` hangs from `anchor` on, for its `data-side`: under it, or over it when the view it scrolls in has
 * no room for it below but has above, as Radix's popovers flip. A `data-popover-room` round it is the room kept for it
 * below, so it opens there whatever the view. Its style places each side.
 */
export function useFlip(anchor: RefObject<HTMLElement | null>, popover: RefObject<HTMLElement | null>, open: boolean) {
  const [side, setSide] = useState<"above" | "below">("below");
  useLayoutEffect(() => {
    const node = popover.current;
    const at = anchor.current;
    if (!open || !node || !at) return;
    // Placed as it opens, and again as it changes size (a month view, a filtered list).
    const place = () => {
      if (at.closest("[data-popover-room]")) return setSide("below");
      const view = scrollerOf(at)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      const box = at.getBoundingClientRect();
      const height = node.getBoundingClientRect().height + 5;
      setSide(box.bottom + height > view.bottom && box.top - height >= view.top ? "above" : "below");
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [anchor, popover, open]);
  return side;
}

/** A modal's scrim, which the form controls in its dialog hang their popovers from (`useHang`). */
export const ScrimContext = createContext<HTMLElement | null>(null);

/**
 * Where a form control's popover opens: under `anchor`, or over it where there's no room below (`useFlip`). In a modal
 * it hangs from the scrim instead, over the dialog, so the dialog's body neither clips it nor scrolls to show it:
 * `hang` portals it there, placed in the scrim's own pixels whatever the app is scaled by, `gap` px from its box, its
 * sides on the box's as `insetInline: 0` puts them (a popover with a width of its own keeps it), and following the box
 * as the body scrolls. `mark` goes on the popover, so a press on it isn't outside the control (`ignore`, for
 * `useDismiss`).
 */
export function useHang(
  anchor: RefObject<HTMLElement | null>,
  popover: RefObject<HTMLElement | null>,
  open: boolean,
  { gap = 2 }: { gap?: number } = {},
) {
  const scrim = use(ScrimContext);
  const id = useId();
  const flipped = useFlip(anchor, popover, open && !scrim);
  const [placed, setPlaced] = useState<{ side: "above" | "below"; style: CSSProperties }>();
  useLayoutEffect(() => {
    const node = popover.current;
    const at = anchor.current;
    if (!open || !scrim || !node || !at) return;
    const place = () => {
      const view = scrim.getBoundingClientRect();
      const scale = view.width / scrim.offsetWidth || 1;
      const box = at.getBoundingClientRect();
      const top = (box.top - view.top) / scale + scrim.scrollTop;
      const bottom = (box.bottom - view.top) / scale + scrim.scrollTop;
      const height = node.offsetHeight + gap;
      const above = bottom + height > scrim.scrollTop + scrim.clientHeight && top - height >= scrim.scrollTop;
      setPlaced({
        side: above ? "above" : "below",
        style: {
          top: above ? top - height : bottom + gap,
          left: (box.left - view.left) / scale,
          right: scrim.clientWidth - (box.right - view.left) / scale,
          bottom: "auto",
        },
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    scrim.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      scrim.removeEventListener("scroll", place, true);
    };
  }, [anchor, popover, scrim, open, gap]);
  return {
    side: (scrim && placed?.side) || flipped,
    style: scrim ? placed?.style : undefined,
    hang: (node: ReactNode) => (scrim ? createPortal(node, scrim) : node),
    mark: { "data-popover-of": id },
    ignore: `[data-popover-of="${id}"]`,
    scrim,
  };
}

/** A form control's list, hung 2px under its box, or over it where `useFlip` puts it. */
export const popoverSidesRaw = css.raw({
  position: "absolute",
  insetBlockStart: "calc(100% + 0.125rem)",
  insetInline: 0,
  "&[data-side=above]": { insetBlockStart: "auto", insetBlockEnd: "calc(100% + 0.125rem)", "--entrance-from": "4px" },
});

/** What a form control's box and its popover hang from. */
export const anchorStyle = css({ position: "relative", display: "flex", flexDirection: "column", minWidth: 0 });

/** The style that opens `root`'s overlay beside `trigger` (`placeOverlay`, or `placeBeside`), kept there as it resizes. */
export function usePlacement(root: RefObject<HTMLElement | null>, trigger: HTMLElement | null, beside?: boolean) {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const node = root.current;
    const frame = node?.offsetParent;
    const view = node && scrollerOf(node);
    if (!node || !(frame instanceof HTMLElement) || !trigger || !view) return;
    let side: Side | undefined;
    const place = () => {
      // In the frame's own pixels, whatever the app and its window are scaled by.
      const box = frame.getBoundingClientRect();
      const scale = box.width / frame.offsetWidth || 1;
      const local = (r: DOMRect) => ({
        top: (r.top - box.top) / scale,
        bottom: (r.bottom - box.top) / scale,
        left: (r.left - box.left) / scale,
        right: (r.right - box.left) / scale,
      });
      const size = { width: node.offsetWidth, height: node.offsetHeight };
      const [cta, room] = [local(trigger.getBoundingClientRect()), local(view.getBoundingClientRect())];
      if (beside) {
        const { top, left } = placeBeside(cta, room, size);
        return setStyle({ top, left, right: "auto", bottom: "auto" });
      }
      const at = placeOverlay(cta, room, size, side);
      side = at.side;
      setStyle({
        top: at.top,
        left: at.left,
        right: "auto",
        bottom: "auto",
        ["--entrance-from" as string]: at.side === "above" ? "4px" : "-0.25rem",
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, trigger, beside]);
  return style;
}

export function useEscapeLayer(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onEscape: () => void,
) {
  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    node.addEventListener("escape-layer", onEscape);
    return () => node.removeEventListener("escape-layer", onEscape);
  }, [ref, open, onEscape]);
}

/** `reveal` in the nearest box round `node` that scrolls up and down, and none past it, as `scrollIntoView` would move. */
export function revealInScroller(node: HTMLElement) {
  for (let box = node.parentElement; box; box = box.parentElement)
    if (/auto|scroll/.test(getComputedStyle(box).overflowY)) return reveal(box, node);
}

/** Scrolls `scroller` so `node`, hung somewhere inside it, shows whole. `scroller` must be positioned: the offsets stop there. */
export function reveal(scroller: HTMLElement, node: HTMLElement) {
  let top = 0;
  for (
    let box: HTMLElement | null = node;
    box && box !== scroller;
    box = box.offsetParent as HTMLElement | null
  )
    top += box.offsetTop;
  const bottom = top + node.offsetHeight + 24;
  if (bottom > scroller.scrollTop + scroller.clientHeight)
    scroller.scrollTo?.({
      top: bottom - scroller.clientHeight,
      behavior: "smooth",
    });
}
