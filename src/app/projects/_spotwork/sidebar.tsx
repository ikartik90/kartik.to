"use client";

import {
  Children,
  createContext,
  isValidElement,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type FC,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { Wireframe } from "@/components/ui/wireframe";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable } from "./controllable";
import { Avatar } from "./data-table";
import { ItemContext, ListItem, useHeldBy, valueOf, type ListItemProps } from "./dropdown";
import { Presence, Typography, popoverRaw, useEscapeLayer } from "./ui";
import { ownPart, partsOf, refuseOthers, restOf, useOwner } from "./slots";
import ChevronRightIcon from "./assets/icons/medium/chevron-right.svg";

// What a rail hides until it opens: its items' words and chevrons, its groups' labels, its account's name and actions.
const RAILED = ":is([data-words], [data-chevron], [data-group-label] > *, [data-account] > button)";

// What opens a rail: the pointer, the keyboard, or its switcher's popover.
const OPENS = ":hover, :has(:focus-visible), :has([data-switcher][aria-expanded=true])";

// SW Curie's Navigation/Sidebar (5263:4863). Over the page it takes no room and slides out past its own shadow.
const sidebarStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  width: "var(--sw-width-nav-sidebar)",
  overflow: "hidden",
  backgroundColor: "var(--sw-surface-default)",
  borderInlineEnd: "1px solid var(--sw-border-subdued)",
  // At the window's right edge.
  "&[data-side=end]": { borderInlineEnd: "none", borderInlineStart: "1px solid var(--sw-border-subdued)" },
  transition:
    "transform 300ms cubic-bezier(0.22, 1, 0.36, 1), margin-inline-end 300ms cubic-bezier(0.22, 1, 0.36, 1)",
  "&[data-state=closed]": {
    marginInlineEnd: "calc(-1 * var(--sw-width-nav-sidebar))",
    transform: "translateX(calc(-100% - 10px))",
  },
  "&[data-floating]": {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    zIndex: 6,
    boxShadow: "var(--sw-overlay-shadow)",
    clipPath: "inset(0 -10px 0 0)",
  },
  // Shut, a rail of its items' icons beside the page, open over the page while hovered or reached by keyboard.
  "&[data-rail]": {
    transition:
      "width 300ms cubic-bezier(0.22, 1, 0.36, 1), margin-inline-end 300ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms cubic-bezier(0.22, 1, 0.36, 1)",
    [`& ${RAILED}`]: { transition: "opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)" },
    "& [data-group-label]": {
      transition:
        "grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1), padding-block-start 300ms cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
  "&[data-rail][data-state=closed]": {
    position: "relative",
    zIndex: 1,
    width: "var(--sw-width-nav-rail)",
    marginInlineEnd: 0,
    transform: "none",
    boxShadow: "none",
    clipPath: "none",
  },
  // Its width over the page, its room the rail's.
  [`&[data-rail]:is([data-floating][data-state=open], [data-state=closed]:is(${OPENS}))`]: {
    position: "relative",
    width: "var(--sw-width-nav-sidebar)",
    marginInlineEnd: "calc(var(--sw-width-nav-rail) - var(--sw-width-nav-sidebar))",
    boxShadow: "var(--sw-overlay-shadow)",
    clipPath: "inset(0 -10px 0 0)",
  },
  [`&[data-rail][data-state=closed]:is(${OPENS})`]: {
    transitionDelay: "150ms",
    [`& :is(${RAILED}, [data-group-label])`]: { transitionDelay: "150ms" },
  },
  [`&[data-rail][data-state=closed]:not(${OPENS})`]: {
    [`& ${RAILED}`]: { opacity: 0 },
    // A group's label gives up its room, leaving its rule.
    "& [data-group-label]": { gridTemplateRows: "0fr", paddingBlockStart: "1px" },
  },
});

const navGroupStyle = css({
  display: "grid",
  gridTemplateRows: "1fr",
  paddingBlockStart: "var(--sw-padding-sm)",
  paddingInline: "var(--sw-padding-md)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > div": { minHeight: 0, overflow: "hidden" },
  "&:first-child": { paddingBlockStart: "var(--sw-padding-none)", boxShadow: "none" },
});

// The sidebar's items, scrolling on their own above its footer.
const itemsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  flex: "1 1 auto",
  minHeight: 0,
  padding: "var(--sw-padding-md)",
  overflowX: "hidden",
  overflowY: "auto",
  "& > button": { flexShrink: 0 },
});

// At the sidebar's foot, under its items.
const footerStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  flexShrink: 0,
  padding: "var(--sw-padding-none) var(--sw-padding-md) var(--sw-padding-md)",
});

// The account's avatar at 36, in a 40 box.
export const accountAvatarStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "2.5rem",
  height: "2.5rem",
  "& > [data-avatar]": { width: "2.25rem", height: "2.25rem" },
});

// The account's or the switcher's avatar centred on a rail's icons, its name level with the items' words.
const avatarRowRaw = css.raw({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  paddingInline: "var(--sw-padding-xxs)",
  "& > [data-words]": { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

// Ruled off from the footer's items across the sidebar, out into the footer's padding; as much room above as the footer
// leaves below.
const accountStyle = css(avatarRowRaw, {
  marginInline: "calc(-1 * var(--sw-padding-md))",
  paddingInline: "calc(var(--sw-padding-md) + var(--sw-padding-xxs))",
  paddingBlockStart: "var(--sw-padding-md)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > button": { flexShrink: 0 },
});

// Ruled off from the items under it as the account is from those over it, its avatar md from the rule and the top.
const headStyle = css({
  flexShrink: 0,
  paddingBlock: "var(--sw-padding-sm)",
  paddingInline: "var(--sw-padding-md)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
});

// A page's top padding, centring its title's line on the first item: the head (its and its switcher's padding round the
// avatar's box), the items' padding, then half the item's height less half the title's line. Follows `headStyle`,
// `switcherStyle`, `accountAvatarStyle`, `itemsStyle`, the nav item's height and `--sw-text-style-10`.
export const pageTopRaw = css.raw({
  paddingBlockStart:
    "calc(2 * var(--sw-padding-sm) + 2 * var(--sw-padding-xxs) + 2.5rem + var(--sw-padding-md) + (2.5rem - 2.75rem) / 2)",
});

// Lit as the items are, while pointed at or open; its chevron xs from its end, level with the items'.
const switcherStyle = css(avatarRowRaw, {
  width: "100%",
  paddingBlock: "var(--sw-padding-xxs)",
  borderRadius: "var(--sw-radius-xs)",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  cursor: "pointer",
  outline: "none",
  "&:is(:hover, :focus-visible, [aria-expanded=true])": { backgroundColor: "var(--sw-hover-shade)" },
  "& > [data-chevron]": { flexShrink: 0, marginInlineEnd: "var(--sw-margin-xxs)" },
});

// Beside the sidebar, level with its switcher; its records ruled off from each other, not from its edge, each pill at
// its line's end.
const switcherPopoverStyle = css(popoverRaw, {
  gap: "var(--sw-gap-none)",
  width: "20rem",
  marginInlineStart: "var(--sw-gap-xs)",
  "& > :first-child": { boxShadow: "none" },
  "& [data-line] > [data-shape=pill]": { marginInlineStart: "auto" },
});

export type Icon = FC<SVGProps<SVGSVGElement>>;

// Whether the sidebar is open, for it and the `Header.Menu` that opens it.
const OpenContext = createContext<{ id: string; open: boolean; setOpen: (open: boolean) => void } | null>(null);

/** The `Sidebar.Provider` around the caller, if any. */
export const useSidebar = () => use(OpenContext);

/** Holds whether its sidebar is open, from `defaultOpen` unless `open` is given, for the sidebar and its opener. */
function SidebarProvider({
  open,
  defaultOpen = true,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  const [shown, setShown] = useControllable(open, defaultOpen, onOpenChange);
  return <OpenContext value={{ id, open: shown, setOpen: setShown }}>{children}</OpenContext>;
}
SidebarProvider.displayName = "Sidebar.Provider";

// The current item's value, and how an item becomes it.
const PickContext = createContext<{ current?: string; pick: (value: string) => void } | null>(null);

type NavItem = ReactElement<{ value?: string; selected?: boolean; onClick?: () => void; children?: ReactNode }>;

const placeholderStyle = css({ flexShrink: 0 });

/**
 * Atoms/Navigation/Nav Item: a sidebar's item, rounded, the current page while selected. A `placeholder` keeps its
 * place as a faded skeleton of itself, out of reach.
 */
function SidebarItem({ placeholder, ...props }: Omit<ListItemProps, "type" | "role" | "nav"> & { placeholder?: boolean }) {
  useHeldBy(SidebarItem);
  const item = <ListItem {...props} nav type="menu" />;
  return placeholder ? (
    <Wireframe opacity={25} className={placeholderStyle}>
      {item}
    </Wireframe>
  ) : (
    item
  );
}
SidebarItem.displayName = "Sidebar.Item";

/**
 * Each `Sidebar.Item` among `children`: selected as it says, or else while its value is the sidebar's. `actions` only
 * do what they say, never becoming the current page.
 */
function NavItems({ actions, children }: { actions?: boolean; children: ReactNode }) {
  const sidebar = use(PickContext);
  refuseOthers(children, SidebarItem);
  return Children.map(children, (child) => {
    if (!isValidElement(child) || child.type !== SidebarItem) return child;
    const item = child as NavItem;
    const value = valueOf(item);
    const pick = () => {
      if (!actions) sidebar?.pick(value);
      item.props.onClick?.();
    };
    const selected = item.props.selected ?? (!actions && sidebar?.current === value);
    return <ItemContext value={{ of: SidebarItem, selected, pick }}>{item}</ItemContext>;
  });
}

type SidebarProps<T extends string> = Omit<ComponentProps<"nav">, "aria-label" | "defaultValue" | "onChange"> & {
  label: string;
  /** Slides shut, out of reach, when false; without it (or a provider) the sidebar is always open. */
  open?: boolean;
  /** Over the page, taking no room. */
  floating?: boolean;
  /** Shut, it stays a rail of its items' icons, opening over the page while hovered. */
  rail?: boolean;
  /** The current item's value; without it, `defaultValue` until an item is picked. */
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
};

/**
 * Molecules/Navigation/Sidebar (5263:4863): its `Sidebar.Item`s, and `Sidebar.Group`s of more under a head; a
 * `Sidebar.Switcher` heads it and a `Sidebar.Footer` ends it.
 */
function SidebarRoot<T extends string>({
  label,
  open,
  floating,
  rail,
  value,
  defaultValue,
  onChange,
  id,
  children,
  ...props
}: SidebarProps<T>) {
  const provider = useSidebar();
  const shown = open ?? provider?.open;
  const [current, setCurrent] = useControllable<T | undefined>(value, defaultValue, onChange as (value?: T) => void);
  const nav = useRef<HTMLElement>(null);
  const was = useRef({ current, shown });
  // A pick that opens or shuts it lands there at once, so the page picked opens in the room it keeps.
  useLayoutEffect(() => {
    const moved = was.current.current !== current && was.current.shown !== shown;
    was.current = { current, shown };
    if (moved) for (const transition of nav.current?.getAnimations?.() ?? []) transition.finish();
  }, [current, shown]);
  return (
    <PickContext value={{ current, pick: setCurrent as (value: string) => void }}>
      <nav
        ref={nav}
        className={sidebarStyle}
        id={id ?? provider?.id}
        aria-label={label}
        inert={shown === false && !rail}
        data-state={shown === undefined ? undefined : shown ? "open" : "closed"}
        data-floating={floating ? "" : undefined}
        data-rail={rail ? "" : undefined}
        {...props}
      >
        {partsOf(children, SidebarSwitcher)}
        <div className={itemsStyle}>
          <NavItems>{restOf(children, SidebarSwitcher, SidebarFooter)}</NavItems>
        </div>
        {partsOf(children, SidebarFooter)}
      </nav>
    </PickContext>
  );
}
SidebarRoot.displayName = "Sidebar";

// Inside a `Sidebar.Group`, where its label may sit.
const GroupContext = createContext<object | null>(null);
const GROUP = {};

/** Its `Sidebar.Item`s under its `Sidebar.GroupLabel`, side by side with the sidebar's other items. */
function SidebarGroup({ children }: { children?: ReactNode }) {
  return (
    <GroupContext value={GROUP}>
      {partsOf(children, SidebarGroupLabel)}
      <NavItems>{restOf(children, SidebarGroupLabel)}</NavItems>
    </GroupContext>
  );
}
SidebarGroup.displayName = "Sidebar.Group";

/** A group's head: its `Typography`, ruled off from the items above unless it starts the sidebar. */
function SidebarGroupLabel({ children }: { children: ReactNode }) {
  useOwner(GroupContext, SidebarGroupLabel);
  return (
    <div className={navGroupStyle} data-group-label="">
      <div>{children}</div>
    </div>
  );
}
SidebarGroupLabel.displayName = "Sidebar.GroupLabel";

// Inside a `Sidebar.Footer`, where the account may sit.
const FooterContext = createContext<object | null>(null);
const FOOTER = {};

/** Under the sidebar's items: its own `Sidebar.Item`s, actions that never become the current page, then the account. */
function SidebarFooter({ children }: { children?: ReactNode }) {
  useOwner(PickContext, SidebarFooter);
  return (
    <FooterContext value={FOOTER}>
      <div className={footerStyle}>
        <NavItems actions>{restOf(children, SidebarAccount)}</NavItems>
        {partsOf(children, SidebarAccount)}
      </div>
    </FooterContext>
  );
}
SidebarFooter.displayName = "Sidebar.Footer";

/** The signed-in account: its `Avatar`, its name as a `Typography`, then its actions (`Button`s). */
function SidebarAccount({ children }: { children: ReactNode }) {
  useOwner(FooterContext, SidebarAccount);
  return (
    <div className={accountStyle} data-account="">
      <span className={accountAvatarStyle}>{partsOf(children, Avatar)}</span>
      <span data-words="">{partsOf(children, Typography)}</span>
      {restOf(children, Avatar, Typography)}
    </div>
  );
}
SidebarAccount.displayName = "Sidebar.Account";

type SwitcherProps = {
  /** Its popover's name. */
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

/**
 * At the sidebar's head, what its pages are for (a team, say): its `Avatar` and its name as a `Typography`, then a
 * chevron. Pressed, it opens its other children in a popover beside the sidebar, level with it, which Escape, a press
 * outside it or the switcher again closes; a rail stays open while it's open.
 */
function SidebarSwitcher({ label, open, defaultOpen = false, onOpenChange, children }: SwitcherProps) {
  useOwner(PickContext, SidebarSwitcher);
  const [shown, setShown] = useControllable(open, defaultOpen, onOpenChange);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  // Out of the sidebar, which clips what it holds.
  const host = trigger?.closest("nav")?.parentElement;
  return (
    <div className={headStyle}>
      <button
        ref={setTrigger}
        type="button"
        className={switcherStyle}
        aria-haspopup="dialog"
        aria-expanded={shown}
        data-switcher=""
        onClick={() => setShown(!shown)}
      >
        <span className={accountAvatarStyle}>{partsOf(children, Avatar)}</span>
        <span data-words="">{partsOf(children, Typography)}</span>
        <ChevronRightIcon aria-hidden data-chevron="" />
      </button>
      {trigger &&
        host &&
        createPortal(
          <Presence>
            {shown && (
              <SwitcherPopover label={label} trigger={trigger} onClose={() => setShown(false)}>
                {restOf(children, Avatar, Typography)}
              </SwitcherPopover>
            )}
          </Presence>,
          host,
        )}
    </div>
  );
}
SidebarSwitcher.displayName = "Sidebar.Switcher";

function SwitcherPopover({
  label,
  trigger,
  onClose,
  children,
}: {
  label: string;
  trigger: HTMLElement;
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const frame = root.current?.offsetParent;
    const nav = trigger.closest("nav");
    if (!(frame instanceof HTMLElement) || !nav) return;
    // In the frame's own pixels, whatever the app is scaled by or the frame scrolled to, following the sidebar as it
    // widens.
    const at = () => {
      const box = frame.getBoundingClientRect();
      const scale = box.width / frame.offsetWidth || 1;
      const top = (trigger.getBoundingClientRect().top - box.top) / scale + frame.scrollTop - frame.clientTop;
      const left = (nav.getBoundingClientRect().right - box.left) / scale + frame.scrollLeft - frame.clientLeft;
      setPlace({ top, left, right: "auto", bottom: "auto" });
    };
    at();
    const observer = new ResizeObserver(at);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [trigger]);
  useEffect(() => root.current?.querySelector("button")?.focus({ preventScroll: true }), []);
  useEscapeLayer(root, true, onClose);
  useDismiss({ ref: root, onDismiss: onClose, ignoreSelector: "[data-switcher]" });
  return (
    <div
      ref={root}
      className={switcherPopoverStyle}
      style={place}
      role="dialog"
      aria-label={label}
      data-escape-layer=""
    >
      {children}
    </div>
  );
}

export const Sidebar = Object.assign(SidebarRoot, {
  Provider: SidebarProvider,
  Group: SidebarGroup,
  GroupLabel: ownPart(SidebarGroupLabel, "Sidebar.Group"),
  Item: ownPart(SidebarItem),
  Switcher: ownPart(SidebarSwitcher),
  Footer: ownPart(SidebarFooter),
  Account: ownPart(SidebarAccount, "Sidebar.Footer"),
});
