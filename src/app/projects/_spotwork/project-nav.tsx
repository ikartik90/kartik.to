"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { token } from "../../../../styled-system/tokens";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import PlayIcon from "@/assets/icons/play.svg";
import { DEMO, NAV } from "./copy";

// The overlay's nav: the projects in a menu below the window (`ProjectDock`), the versions and Play above it
// (`VersionBar`) for a project with no About sheet to play them from.

export type Project = { id: string; label: string; versions?: { id: string; label: string }[] };
export type Choice = { project: string; version?: string };

const MOTION: KeyframeAnimationOptions = { duration: 200, easing: "ease-out" };

const rowStyle = css({ display: "flex", flexShrink: 0, alignItems: "center", gap: "xxl" });

const stateStyle = css({
  "&:not([aria-current=true]):hover": { backgroundColor: "bg.surface" },
  "&[aria-current=true]": { backgroundColor: "field.bg.active", color: "field.text.active" },
});

// Figma's secondary and accent fills are see-through and vanish over the shader, so the pills are glass and the
// current one takes the opaque active fill: Figma's accent over a dark ground.
export const glassStyle = cx(css({ backgroundColor: "bg.surfaceGlass" }), stateStyle);

const pillStyle = css({ flexShrink: 0, borderRadius: "full", textStyle: "bodySmall" });

// One glass under all the versions: frosted one by one, their edges let the ground through mid-slide.
const versionsStyle = css({
  display: "flex",
  flexShrink: 0,
  borderRadius: "full",
  overflow: "clip",
  backgroundColor: "bg.surfaceGlass",
});

// Inline: Panda's `backdropFilter` emits only the -webkit- form, which Chromium ignores.
const FROSTED = { backdropFilter: "blur(var(--spacing-md))", WebkitBackdropFilter: "blur(var(--spacing-md))" };

// Joined, so a press doesn't shrink one away from its neighbours. The seam beside the current version takes its tint.
const versionStyle = css({
  flexShrink: 0,
  borderRadius: 0,
  backgroundColor: "transparent",
  textStyle: "bodySmall",
  _active: { transform: "none" },
  "& + &": { boxShadow: "inset 0.5px 0 0 var(--colors-bg-button-secondary-default)" },
  "&[aria-current=true] + &, & + &[aria-current=true]": {
    boxShadow: "inset 0.5px 0 0 var(--colors-field-border-active)",
  },
});

const moves = () =>
  typeof Element.prototype.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A project chosen from the list opens on the version it showed last, or its first. */
function choiceOf(next: Project, value: Choice): Choice {
  if (!next.versions) return { project: next.id };
  return { project: next.id, version: (next.id === value.project && value.version) || next.versions[0].id };
}

function VersionPills({
  versions,
  value,
  onChange,
}: {
  versions: NonNullable<Project["versions"]>;
  value?: string;
  onChange?: (version: string) => void;
}) {
  return (
    <div className={versionsStyle} style={FROSTED} role="group" aria-label={NAV.versions}>
      {versions.map(({ id, label }) => (
        <Button
          key={id}
          className={cx(stateStyle, versionStyle)}
          aria-current={id === value || undefined}
          onClick={onChange && (() => onChange(id))}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

const dockStyle = css({ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" });

// The dots and the projects' row take turns: whichever is away sits centred over the other, out of the layout and out
// of reach, so the menu's box is only ever the one showing. It jumps from the dots to the row, never shrinking under
// the pointer as it opens.
const awayStyle = css({
  position: "absolute",
  insetBlockStart: "half",
  insetInlineStart: "half",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
});

const dotsStyle = css({
  display: "flex",
  gap: "md",
  padding: "calc(token(spacing.sm) + token(spacing.md))",
  borderRadius: "full",
  backgroundColor: "bg.surfaceGlass",
  transition: "opacity 200ms ease-out",
  _motionReduce: { transition: "none" },
  "&[data-away]": { opacity: 0 },
});

const dotStyle = css({
  width: "token(spacing.md)",
  height: "token(spacing.md)",
  borderRadius: "full",
  backgroundColor: "field.text.default",
  "&[data-current]": { backgroundColor: "field.text.active" },
});

const dockRowStyle = css({ padding: "sm", "&[data-away] > *": { opacity: 0 } });

// Opening from its start, the projects' row lies over the dots from their start edge, its first pill's on theirs, so the
// menu's box stays the dots' and what's beside it never moves.
const fromStartStyle = css({
  position: "absolute",
  insetBlockStart: "half",
  insetInlineStart: "calc(token(spacing.sm) * -1)",
  transform: "translateY(-50%)",
  "&[data-away]": { pointerEvents: "none" },
});

/** A pill's frames between the pill of dots' box, scaled to it and faded, and its own place in the row. */
function morph(pill: Element, dots: Element, opening: boolean): Keyframe[] {
  const to = pill.getBoundingClientRect();
  const from = dots.getBoundingClientRect();
  const dx = from.x + from.width / 2 - (to.x + to.width / 2);
  const dy = from.y + from.height / 2 - (to.y + to.height / 2);
  const blurred = `blur(${getComputedStyle(pill).getPropertyValue("--spacing-md").trim()})`;
  const sharp = "blur(0px)";
  const folded = {
    transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`,
    opacity: 0,
    filter: blurred,
  };
  const open = { transform: "none", opacity: 1, filter: sharp };
  // WebKit draws even a hundredth of a pixel's blur as a visible soften, so the blur clears before the fade ends.
  return opening ? [folded, { filter: sharp, offset: 0.7 }, open] : [open, { filter: sharp, offset: 0.3 }, folded];
}

// How far past the projects, above and below them and either side, the pointer can stray before the open menu closes.
const SAFE = { block: parseFloat(token("spacing.xxl")), inline: parseFloat(token("spacing.4xl")) };

/** Whether `x`, `y` is over the projects in `row` (its box inside its padding) or within `SAFE` of them. */
function nearProjects(row: Element, x: number, y: number) {
  const box = row.getBoundingClientRect();
  const style = getComputedStyle(row);
  const pad = (side: string) => parseFloat(style.getPropertyValue(`padding-${side}`)) || 0;
  return (
    x >= box.left + pad("left") - SAFE.inline &&
    x <= box.right - pad("right") + SAFE.inline &&
    y >= box.top + pad("top") - SAFE.block &&
    y <= box.bottom - pad("bottom") + SAFE.block
  );
}

/** The projects' menu: a glass pill of a dot per project, the current one marked, whose pills scale up out of
 * it into the projects while it's held, hovered (or the pointer is near them), tapped open or reached by keyboard. */
export function ProjectDock({
  projects,
  value,
  onChange,
  held = false,
  fromStart = false,
  className,
}: {
  projects: Project[];
  value: Choice;
  onChange: (choice: Choice) => void;
  /** Open whatever the pointer and focus do. */
  held?: boolean;
  /** Opens rightward from the dots' start edge, not out from their centre. */
  fromStart?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState<"over" | "near" | null>(null);
  const [focused, setFocused] = useState(false);
  // A finger hovers nothing: its tap opens the menu, and a pick or a tap elsewhere closes it.
  const [tapped, setTapped] = useState(false);
  const touch = useRef(false);
  const nav = useRef<HTMLElement>(null);
  const expanded = held || !!hover || focused || tapped;

  useEffect(() => {
    if (!tapped) return;
    const away = (event: PointerEvent) => !nav.current?.contains(event.target as Node) && setTapped(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [tapped]);

  // Turning back mid-way reverses the morph from where it stands.
  const dots = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);

  // Off the menu but near its projects, it stays open until the pointer moves out of reach. Read from the pointer, so the
  // safe area takes no presses from what's under it.
  useEffect(() => {
    if (hover !== "near") return;
    const move = (event: PointerEvent) =>
      row.current && !nearProjects(row.current, event.clientX, event.clientY) && setHover(null);
    document.addEventListener("pointermove", move);
    return () => document.removeEventListener("pointermove", move);
  }, [hover]);
  const morphs = useRef<Animation[]>([]);
  const shown = useRef(expanded);
  useLayoutEffect(() => {
    if (shown.current === expanded || !dots.current || !row.current) return;
    shown.current = expanded;
    const running = morphs.current.filter((animation) => animation.playState === "running");
    if (running.length) return running.forEach((animation) => animation.reverse());
    if (!moves()) return;
    const from = dots.current;
    morphs.current = [...row.current.children].map((pill) => pill.animate(morph(pill, from, expanded), MOTION));
  }, [expanded]);
  useLayoutEffect(() => () => morphs.current.forEach((animation) => animation.cancel()), []);

  return (
    <nav
      ref={nav}
      className={cx(dockStyle, className)}
      aria-label={NAV.label}
      data-expanded={expanded ? "" : undefined}
      onPointerEnter={(event) => event.pointerType !== "touch" && setHover("over")}
      onPointerLeave={(event) =>
        event.pointerType !== "touch" &&
        setHover(row.current && nearProjects(row.current, event.clientX, event.clientY) ? "near" : null)
      }
      onPointerDown={(event) => (touch.current = event.pointerType === "touch")}
      // On the click, not the press, so the tap that opens it can't land on the pill that opens under it.
      onClick={() => touch.current && !expanded && setTapped(true)}
      // Only from the keys (useKeyboardFocus): a press focuses what it lands on, and the overlay's opening its first pill.
      onFocus={() => setFocused(document.documentElement.hasAttribute("data-keyboard-focus"))}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setFocused(false)}
    >
      <div
        ref={dots}
        className={cx(dotsStyle, expanded && !fromStart && awayStyle)}
        style={FROSTED}
        data-away={expanded ? "" : undefined}
        aria-hidden
      >
        {projects.map((each) => (
          <span key={each.id} className={dotStyle} data-dot="" data-current={each.id === value.project || undefined} />
        ))}
      </div>
      <div
        ref={row}
        className={cx(rowStyle, dockRowStyle, fromStart ? fromStartStyle : !expanded && awayStyle)}
        data-away={expanded ? undefined : ""}
      >
        {projects.map((each) => {
          const isCurrent = each.id === value.project;
          return (
            <Button
              key={each.id}
              className={cx(glassStyle, pillStyle)}
              aria-current={isCurrent || undefined}
              onClick={() => {
                setTapped(false);
                onChange(choiceOf(each, value));
              }}
            >
              {each.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

const menuNavStyle = css({ position: "relative" });

// The dock's pills, stacked under its dots, each on one line however narrow the dots are.
const menuStyle = css({
  position: "absolute",
  insetBlockStart: "calc(100% + token(spacing.md))",
  insetInlineStart: 0,
  width: "max-content",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "md",
});

/** The projects' menu on a phone upright, which has no pointer to hover it open: its dots, a button that opens
 * the projects under it. */
export function ProjectMenu({
  projects,
  value,
  onChange,
  className,
}: {
  projects: Project[];
  value: Choice;
  onChange: (choice: Choice) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={cx(menuNavStyle, className)} aria-label={NAV.label}>
      <button
        type="button"
        className={dotsStyle}
        style={FROSTED}
        aria-label={NAV.label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-project-menu=""
        onClick={() => setOpen(!open)}
      >
        {projects.map((each) => (
          <span key={each.id} className={dotStyle} data-dot="" data-current={each.id === value.project || undefined} />
        ))}
      </button>
      {open && (
        <Popover
          className={menuStyle}
          role="menu"
          ariaLabel={NAV.label}
          ignoreSelector="[data-project-menu]"
          onDismiss={() => setOpen(false)}
        >
          {projects.map((each) => (
            <Button
              key={each.id}
              role="menuitem"
              className={cx(glassStyle, pillStyle)}
              style={FROSTED}
              aria-current={each.id === value.project || undefined}
              onClick={() => {
                setOpen(false);
                onChange(choiceOf(each, value));
              }}
            >
              {each.label}
            </Button>
          ))}
        </Popover>
      )}
    </nav>
  );
}

const barStyle = css({ display: "flex", alignItems: "center", gap: "md" });

/** The row above the window: the current project's versions, if it has any, and Play beside them. */
export function VersionBar({
  projects,
  value,
  onChange,
  onPlay,
  className,
}: {
  projects: Project[];
  value: Choice;
  onChange: (choice: Choice) => void;
  onPlay?: () => void;
  className?: string;
}) {
  const project = projects.find(({ id }) => id === value.project);
  if (!project?.versions && !onPlay) return null;
  return (
    <div className={cx(barStyle, className)}>
      {project?.versions && (
        <VersionPills
          versions={project.versions}
          value={value.version}
          onChange={(version) => onChange({ project: project.id, version })}
        />
      )}
      {onPlay && (
        <Button variant="icon" emphasis="glass" shape="circle" aria-label={DEMO.play} onClick={onPlay}>
          <PlayIcon aria-hidden />
          <Button.Tooltip>
            <Tooltip.Text>{DEMO.play}</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      )}
    </div>
  );
}
