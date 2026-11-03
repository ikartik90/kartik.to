"use client";

import { createContext, use, type ComponentProps, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { useControllable } from "./controllable";
import { partsOf, restOf } from "./slots";
import { Typography } from "./ui";

// SW Curie's tabs (3438:2814): the tab cards, and the tab group of tab cards (large) or of Atoms/Tabs (small).

// Molecules/Tab Cards (3465:1436).
const cardStyle = css({
  display: "flex",
  flex: "1 1 0",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  minWidth: 0,
  minHeight: "5rem",
  paddingBlock: "var(--sw-padding-xl)",
  paddingInline: "var(--sw-padding-md)",
  overflow: "hidden",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  "&:not([aria-pressed=true], [aria-selected=true]):hover": { backgroundColor: "var(--sw-hover-shade)" },
  "&:is([aria-pressed=true], [aria-selected=true])": {
    backgroundColor: "var(--sw-surface-selected)",
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-selected)",
    color: "var(--sw-glyph-selected)",
  },
  // Pressing a current card on its own puts it back; a tab in a group stays current.
  "&[aria-pressed=true]:hover": { backgroundImage: "linear-gradient(var(--sw-surface-hover) 0 0)", backgroundBlendMode: "multiply" },
});

const iconStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "1.5rem",
  height: "1.5rem",
});

const bodyStyle = css({ display: "flex", flex: "1 1 auto", flexDirection: "column", gap: "var(--sw-gap-xs)", minWidth: 0 });

const valueStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "var(--sw-gap-sm)",
  rowGap: "var(--sw-gap-xs)",
  "& > [data-typography=heading]": { color: "var(--sw-glyph-default)" },
});

// A change's tone sets both its colours; a current card turns them inside out. Its 16px badge sits 4px from its start,
// as from its top and bottom.
const changeStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--sw-gap-xxs)",
  height: "1.5rem",
  paddingInlineStart: "var(--sw-padding-xxs)",
  paddingInlineEnd: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-full)",
  backgroundColor: "var(--tone-surface)",
  color: "var(--tone-glyph)",
  whiteSpace: "nowrap",
  "&[data-tone=alert]": { "--tone-surface": "var(--sw-surface-alert)", "--tone-glyph": "var(--sw-glyph-alert)" },
  "&[data-tone=warning]": { "--tone-surface": "var(--sw-surface-warning)", "--tone-glyph": "var(--sw-glyph-warning)" },
  "&[data-tone=success]": { "--tone-surface": "var(--sw-surface-success)", "--tone-glyph": "var(--sw-glyph-success)" },
  "& > [data-typography=badge]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1rem",
    height: "1rem",
    margin: "var(--sw-margin-xxs)",
    paddingInline: "var(--sw-padding-xs)",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--tone-glyph)",
    color: "var(--tone-surface)",
  },
  ":is([aria-pressed=true], [aria-selected=true]) &": {
    backgroundColor: "var(--tone-glyph)",
    color: "var(--tone-surface)",
    "& > [data-typography=badge]": { backgroundColor: "var(--tone-surface)", color: "var(--tone-glyph)" },
  },
});

// The tab group's value and how to change it, for the tabs (or tab cards) in it.
const GroupContext = createContext<{ value?: string; onChange?: (value: string) => void } | null>(null);

type TabCardProps = Omit<ComponentProps<"button">, "value" | "color"> & {
  /** Pressed, on its own; in a `TabGroup` the group's value picks the current card. */
  current?: boolean;
  /** Pressed as it opens, when `current` isn't given; a press toggles it. */
  defaultCurrent?: boolean;
  /** Its value in a `TabGroup`. */
  value?: string;
};

/**
 * Molecules/Tab Cards (3465:1436): its icon if it has one, then its count (its `heading` `Typography`) under its title (its other
 * `Typography`), a `TabCard.Change` beside the count.
 */
function TabCardRoot({ current, defaultCurrent = false, value, onClick, children, ...props }: TabCardProps) {
  const group = use(GroupContext);
  const tab = group !== null && value !== undefined;
  const [pressed, setPressed] = useControllable(current, defaultCurrent);
  const texts = partsOf(children, Typography);
  const icon = restOf(children, Typography, TabCardChange);
  const isCount = (text: (typeof texts)[number]) => (text.props as { variant?: string }).variant === "heading";
  return (
    <Typography
      tag="button"
      variant="body"
      type="button"
      className={cardStyle}
      role={tab ? "tab" : undefined}
      aria-selected={tab ? group.value === value : undefined}
      aria-pressed={tab ? undefined : pressed}
      onClick={(event) => {
        if (tab) group.onChange?.(value);
        else setPressed(!pressed);
        onClick?.(event);
      }}
      {...props}
    >
      {icon.length > 0 && <span className={iconStyle}>{icon}</span>}
      <span className={bodyStyle}>
        {texts.filter((text) => !isCount(text))}
        <span className={valueStyle}>
          {texts.filter(isCount)}
          {partsOf(children, TabCardChange)}
        </span>
      </span>
    </Typography>
  );
}
TabCardRoot.displayName = "TabCard";

/** What has changed since the card was last seen, in its tone: how many, a `badge` `Typography`, then its words. */
function TabCardChange({ tone, children }: { tone: "alert" | "warning" | "success"; children: ReactNode }) {
  return (
    <Typography variant="body" className={changeStyle} data-tone={tone}>
      {children}
    </Typography>
  );
}
TabCardChange.displayName = "TabCard.Change";

const tabCardGroupStyle = css({ display: "flex", gap: "var(--sw-gap-xl)" });

/** Tab cards side by side as a labelled group, each a toggle of its own. */
function TabCardGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={tabCardGroupStyle} role="group" aria-label={label}>
      {children}
    </div>
  );
}
TabCardGroup.displayName = "TabCard.Group";

export const TabCard = Object.assign(TabCardRoot, {
  Change: TabCardChange,
  Group: TabCardGroup,
});

// Molecules/Tab Group/Small: the tab on show joins the panel under it.
const tabGroupStyle = css({
  display: "flex",
  flexShrink: 0,
  backgroundColor: "var(--sw-surface-subdued)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "& > button": {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "var(--sw-gap-xs)",
    minWidth: "7.5rem",
    paddingBlock: "var(--sw-padding-sm)",
    paddingInline: "var(--sw-padding-md)",
    color: "var(--sw-glyph-default)",
    boxShadow: "inset -1px -1px 0 var(--sw-border-subdued)",
  },
  "& > button > [data-badge]": { alignSelf: "center" },
  "& > button[aria-selected=true]": {
    backgroundColor: "var(--sw-surface-default)",
    color: "var(--sw-glyph-selected)",
    boxShadow: "inset -1px 0 0 var(--sw-border-subdued)",
  },
});

/**
 * Molecules/Tab Group: Large (3518:3805) holds `TabCard`s, Small (4387:12868) holds `TabGroup.Tab`s, the current one
 * joining what's under it. The tab whose value it holds, or `defaultValue` until one's picked, is the current one.
 */
function TabGroupRoot<T extends string>({
  size = "large",
  label,
  value,
  defaultValue,
  onChange,
  children,
}: {
  size?: "large" | "small";
  label?: string;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  children: ReactNode;
}) {
  const [current, setCurrent] = useControllable<T | undefined>(value, defaultValue, onChange as (value: T | undefined) => void);
  return (
    <GroupContext value={{ value: current, onChange: setCurrent as (value: string) => void }}>
      <div className={size === "large" ? tabCardGroupStyle : tabGroupStyle} role="tablist" aria-label={label}>
        {children}
      </div>
    </GroupContext>
  );
}
TabGroupRoot.displayName = "TabGroup";

/** Atoms/Tabs: its icon and words go in as children. */
function TabGroupTab({ value, onClick, ...props }: Omit<ComponentProps<"button">, "value" | "color"> & { value: string }) {
  const group = use(GroupContext);
  return (
    <Typography
      tag="button"
      variant="subheading"
      type="button"
      role="tab"
      aria-selected={group?.value === value}
      onClick={(event) => {
        group?.onChange?.(value);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
TabGroupTab.displayName = "TabGroup.Tab";

export const TabGroup = Object.assign(TabGroupRoot, { Tab: TabGroupTab });
