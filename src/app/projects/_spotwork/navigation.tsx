"use client";

import { createContext, use, useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { css } from "../../../../styled-system/css";
import type { SystemStyleObject } from "../../../../styled-system/types";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable } from "./controllable";
import { Avatar } from "./data-table";
import { ListItem, MenuItems, moveFocus, useHeldBy, type ListItemProps } from "./dropdown";
import { accountAvatarStyle, useSidebar } from "./sidebar";
import { ownPart, partsOf, refuseOthers, restOf } from "./slots";
import {
  Badge,
  Button,
  Presence,
  SegmentedControl,
  Typography,
  enterRaw,
  popoverRaw,
  useEscapeLayer,
  usePlacement,
} from "./ui";
import HamburgerIcon from "./assets/icons/medium/hamburger-menu.svg";
import Logo from "./assets/logo.svg";
import CloseIcon from "./assets/icons/medium/cross.svg";

// SW Curie's Navigation page (913:2017): the app's header and footer, the context menu, and the notifications.
// The sidebar and its items are sidebar.tsx's.

const headerStyle = css({
  position: "relative",
  zIndex: 5,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "3.75rem",
  padding: "var(--sw-padding-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
});

const brandStyle = css({
  display: "flex",
  alignItems: "center",
  paddingInlineStart: "var(--sw-padding-sm)",
});

// Figma flips the logo's paths in place; they're drawn upside down.
export const logoRaw = css.raw({ "& > svg": { transform: "scaleY(-1)" } });

const logoStyle = css(logoRaw, {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "11rem",
  height: "2.5rem",
});

const accountStyle = css({ display: "flex", alignItems: "center" });

/**
 * Molecules/Navigation/Header (5263:4984): its `Header.Menu` goes in before the logo, and the signed-in account's
 * `Avatar` (a face, or initials) at its end. Its bell is the sidebar footer's Notifications.
 */
function HeaderRoot({ ref, children }: { ref?: Ref<HTMLElement>; children?: ReactNode }) {
  const [avatar] = partsOf(children, Avatar);
  return (
    <header ref={ref} className={headerStyle}>
      <div className={brandStyle}>
        {restOf(children, Avatar)}
        <span className={logoStyle}>
          <Logo role="img" aria-label="Spotwork" />
        </span>
      </div>
      {avatar && (
        <div className={accountStyle}>
          <span className={accountAvatarStyle}>{avatar}</span>
        </div>
      )}
    </header>
  );
}
HeaderRoot.displayName = "Header";

/** The header's menu: the button opening the sidebar it `aria-controls`, or its `Sidebar.Provider`'s by itself. */
function HeaderMenu(props: Omit<ComponentProps<"button">, "children">) {
  const sidebar = useSidebar();
  return (
    <Button size="icon"
      aria-label="Menu"
      aria-expanded={sidebar?.open}
      aria-controls={sidebar?.id}
      data-nav-toggle=""
      onClick={sidebar ? () => sidebar.setOpen(!sidebar.open) : undefined}
      {...props}
    >
      <HamburgerIcon aria-hidden />
    </Button>
  );
}
HeaderMenu.displayName = "Header.Menu";

export const Header = Object.assign(HeaderRoot, { Menu: HeaderMenu });

// Whether a root's overlay is open, and whether its trigger opened it (so it may take the focus).
const OpenerContext = createContext<{ open: boolean; byTrigger: boolean; toggle: () => void; close: () => void } | null>(
  null,
);

// The trigger over its overlay, at its end; an overlay hung from the root hangs under the trigger.
const openerStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "var(--sw-gap-xs)",
});

/** `name`'s Root, holding whether its overlay is open, and its Trigger, an icon button opening it as a `popup`. */
function opener(name: string, popup: "menu" | "dialog") {
  function Root({
    open,
    defaultOpen = false,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) {
    const [shown, setShown] = useControllable(open, defaultOpen, onOpenChange);
    const [byTrigger, setByTrigger] = useState(false);
    const toggle = () => {
      setByTrigger(true);
      setShown(!shown);
    };
    return (
      <div className={openerStyle}>
        <OpenerContext value={{ open: shown, byTrigger, toggle, close: () => setShown(false) }}>{children}</OpenerContext>
      </div>
    );
  }
  Root.displayName = `${name}.Root`;

  function Trigger({ onClick, ...props }: Omit<ComponentProps<"button">, "aria-haspopup" | "aria-expanded">) {
    const root = use(OpenerContext);
    return (
      <Button size="icon"
        aria-haspopup={popup}
        aria-expanded={root?.open}
        data-row-menu-toggle={popup === "menu" ? "" : undefined}
        onClick={(event) => {
          root?.toggle();
          onClick?.(event);
        }}
        {...props}
      />
    );
  }
  Trigger.displayName = `${name}.Trigger`;

  return { Root, Trigger };
}

// Under its root's trigger, at its end.
const underTriggerRaw = css.raw({ insetBlockStart: "calc(100% + var(--sw-gap-xs))", insetInlineEnd: 0 });

const popoverMenuRaw = css.raw(popoverRaw, { width: "12.75rem" });

type MenuProps = {
  label: string;
  onClose?: () => void;
  trigger?: HTMLElement;
  /** Focuses the first item as it opens. */
  autoFocus?: boolean;
  css?: SystemStyleObject;
  children: ReactNode;
};

/**
 * Molecules/Navigation/Context Menu (7678:20123): its `PopoverMenu.Item`s, hung beside the `trigger` that opened it, or where
 * `css` puts it. It closes on Escape, a press outside it or its trigger (`data-row-menu-toggle`), and before an item's
 * `onClick`. In a `PopoverMenu.Root` it shows while the root holds it open, under its `PopoverMenu.Trigger`;
 * open from the start, a press outside leaves it open until the trigger is used.
 */
function PopoverMenuRoot({ onClose, autoFocus, ...props }: MenuProps) {
  refuseOthers(props.children, PopoverMenuItem);
  const root = use(OpenerContext);
  if (!root) return <Menu {...props} autoFocus={autoFocus ?? true} onClose={onClose ?? (() => {})} />;
  const close = () => {
    root.close();
    onClose?.();
  };
  return (
    <Presence>
      {root.open && <Menu {...props} autoFocus={autoFocus ?? root.byTrigger} onClose={close} under kept={!root.byTrigger} />}
    </Presence>
  );
}
PopoverMenuRoot.displayName = "PopoverMenu";

function Menu({
  label,
  onClose,
  trigger,
  autoFocus,
  under,
  kept,
  css: place,
  children,
}: Omit<MenuProps, "onClose"> & { onClose: () => void; under?: boolean; kept?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const placement = usePlacement(root, trigger ?? null);
  useEscapeLayer(root, true, onClose);
  useDismiss({ ref: root, onDismiss: onClose, ignoreSelector: "[data-row-menu-toggle]", dismissOnOutsidePointer: !kept });
  useEffect(() => {
    if (autoFocus) root.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <div
      ref={root}
      className={css(popoverMenuRaw, under && underTriggerRaw, place)}
      style={placement}
      role="menu"
      aria-label={label}
      data-dashboard-overlay=""
      data-escape-layer=""
      onKeyDown={moveFocus}
    >
      <MenuItems of={PopoverMenuItem} onPick={onClose}>
        {children}
      </MenuItems>
    </div>
  );
}

/** A popover menu's item: small and rounded, doing what it says. */
function PopoverMenuItem(props: Omit<ListItemProps, "type" | "role" | "nav" | "size">) {
  useHeldBy(PopoverMenuItem);
  return <ListItem {...props} role="menuitem" type="menu" size="small" />;
}
PopoverMenuItem.displayName = "PopoverMenu.Item";

const menuOpener = opener("PopoverMenu", "menu");

export const PopoverMenu = Object.assign(PopoverMenuRoot, {
  Root: menuOpener.Root,
  Trigger: menuOpener.Trigger,
  Item: ownPart(PopoverMenuItem),
});

const noticeStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "var(--sw-gap-xs)",
  paddingBlock: "var(--sw-padding-md)",
  paddingInline: "var(--sw-padding-xl)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  "& > div": { display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-md)" },
  "& [data-dot]": { display: "flex", alignItems: "center", flexShrink: 0, width: "0.5rem", height: "1.5rem" },
  "& [data-dot][role=img]::before": {
    content: '""',
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-surface-badge-alert)",
  },
  "& > div > [data-typography]": { flex: "1 1 auto", minWidth: 0 },
  "& > span": { display: "flex", paddingInline: "var(--sw-padding-xxl)", whiteSpace: "nowrap" },
});

const paneStyle = css(enterRaw, {
  display: "flex",
  flexDirection: "column",
  width: "var(--sw-width-overlay-small)",
  height: "34.25rem",
  overflow: "hidden",
  border: "1px solid var(--sw-border-subdued)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  "& > div:first-child": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBlockStart: "var(--sw-padding-xl)",
    paddingInline: "var(--sw-padding-xl)",
  },
  "& > div:nth-child(2)": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--sw-padding-xl)",
    boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  },
  "& > ul": {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  },
});

/** What a notification is about: a worker who hasn't checked in or has left the job site, or who cancelled. */
export type NoticeType = "missingCheckIn" | "cancellation";

type Shown = NoticeType | "all";

const PaneContext = createContext({
  shown: "all" as Shown,
  allRead: false,
  unread: { all: 0, missingCheckIn: 0, cancellation: 0 } as Record<Shown, number>,
  setShown: (_shown: Shown) => {},
  onMarkAllAsRead: () => {},
  onClose: () => {},
});

type NoticeProps = { type: NoticeType; unread?: boolean; children: ReactNode };

const isShown = (type: NoticeType, shown: Shown) => shown === "all" || type === shown;

type PaneProps = { onMarkAllAsRead?: () => void; onClose?: () => void; children: ReactNode };

/**
 * Notifications (Figma's Organisms/Notification/Notification Pane, 6728:11563): its `Header`, its `Toolbar`, then its
 * `List` of `Item`s of the type its `Filter` picks, all of them first. Without `onMarkAllAsRead` it marks them
 * read itself. In a `Notifications.Root` it shows while the root holds it open, under its `Notifications.Trigger`,
 * still read when it opens again.
 */
function NotificationsRoot({ onMarkAllAsRead, onClose, children }: PaneProps) {
  const root = use(OpenerContext);
  const [allRead, setAllRead] = useState(false);
  const pane = (
    <Pane
      allRead={allRead}
      onMarkAllAsRead={onMarkAllAsRead ?? (() => setAllRead(true))}
      onClose={() => {
        root?.close();
        onClose?.();
      }}
    >
      {children}
    </Pane>
  );
  return root ? <Presence>{root.open && pane}</Presence> : pane;
}
NotificationsRoot.displayName = "Notifications";

function Pane({ allRead, onMarkAllAsRead, onClose, children }: Required<PaneProps> & { allRead: boolean }) {
  const [shown, setShown] = useState<Shown>("all");
  const items = partsOf(children, NotificationsList).flatMap((list) =>
    partsOf((list.props as { children: ReactNode }).children, NotificationsItem),
  );
  const count = (shown: Shown) =>
    allRead ? 0 : items.filter(({ props }) => isShown((props as NoticeProps).type, shown) && (props as NoticeProps).unread).length;
  const unread = { all: count("all"), missingCheckIn: count("missingCheckIn"), cancellation: count("cancellation") };
  return (
    <div className={paneStyle} role="dialog" aria-label="Notifications">
      <PaneContext value={{ shown, allRead, unread, setShown, onMarkAllAsRead, onClose }}>{children}</PaneContext>
    </div>
  );
}

/** The pane's title, a `Typography`, and its `Close`. */
function NotificationsHeader({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
NotificationsHeader.displayName = "Notifications.Header";

/** Closes the pane. */
function NotificationsClose() {
  return (
    <Button size="icon" aria-label="Close" onClick={use(PaneContext).onClose}>
      <CloseIcon aria-hidden />
    </Button>
  );
}
NotificationsClose.displayName = "Notifications.Close";

/** Its `Filter`, then its `MarkAllAsRead`. */
function NotificationsToolbar({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
NotificationsToolbar.displayName = "Notifications.Toolbar";

/** A small Segmented Control whose segments, `all`, `missingCheckIn` and `cancellation`, pick which type of item shows. */
function NotificationsFilter({ children }: { children: ReactNode }) {
  const { shown, setShown } = use(PaneContext);
  return (
    <SegmentedControl value={shown} onChange={setShown} size="small">
      {children}
    </SegmentedControl>
  );
}
NotificationsFilter.displayName = "Notifications.Filter";

/** How many items of `type`, or of every type without one, are unread, if any. */
function NotificationsUnreadCount({ type }: { type?: NoticeType }) {
  const count = use(PaneContext).unread[type ?? "all"];
  return count > 0 && <Badge aria-hidden={false}>{count}</Badge>;
}
NotificationsUnreadCount.displayName = "Notifications.UnreadCount";

/** A Tertiary button that marks every item read. */
function NotificationsMarkAllAsRead({ children }: { children: ReactNode }) {
  return (
    <Button size="small" emphasis="tertiary" onClick={use(PaneContext).onMarkAllAsRead}>
      {children}
    </Button>
  );
}
NotificationsMarkAllAsRead.displayName = "Notifications.MarkAllAsRead";

/** The pane's items, scrolling under its toolbar. */
function NotificationsList({ children }: { children: ReactNode }) {
  return <ul>{children}</ul>;
}
NotificationsList.displayName = "Notifications.List";

/**
 * Molecules/Notification/Notification Content (6728:11376): its words, then its time, each a `Typography`, shown
 * while the `Filter` picks its `type`.
 */
function NotificationsItem({ type, unread: given, children }: NoticeProps) {
  const { shown, allRead } = use(PaneContext);
  const unread = given && !allRead;
  const [words, time] = partsOf(children, Typography);
  if (!isShown(type, shown)) return null;
  return (
    <li>
      <div className={noticeStyle}>
        <div>
          {unread ? <span data-dot="" role="img" aria-label="Unread" /> : <span data-dot="" />}
          {words}
        </div>
        <span>{time}</span>
      </div>
    </li>
  );
}
NotificationsItem.displayName = "Notifications.Item";

const paneOpener = opener("Notifications", "dialog");

/** The pane's bell, neutral like the header's. */
function NotificationsTrigger(props: ComponentProps<typeof paneOpener.Trigger>) {
  return <paneOpener.Trigger data-neutral="" {...props} />;
}
NotificationsTrigger.displayName = "Notifications.Trigger";

export const Notifications = Object.assign(NotificationsRoot, {
  Root: paneOpener.Root,
  Trigger: NotificationsTrigger,
  Header: NotificationsHeader,
  Close: NotificationsClose,
  Toolbar: NotificationsToolbar,
  Filter: NotificationsFilter,
  UnreadCount: NotificationsUnreadCount,
  MarkAllAsRead: NotificationsMarkAllAsRead,
  List: NotificationsList,
  Item: NotificationsItem,
});
