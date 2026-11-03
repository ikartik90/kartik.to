"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FC, type SVGProps } from "react";
import { css, cx } from "../../../../../styled-system/css";
import { menuIcon, menuItem } from "../../../../../styled-system/recipes";
import { useDismiss } from "@/hooks/use-dismiss";
import WindowControls from "./icons/window-controls.svg";
import SidebarIcon from "./icons/sidebar.svg";
import BackIcon from "./icons/back.svg";
import ForwardIcon from "./icons/forward.svg";
import FavoritesIcon from "./icons/favorites.svg";
import HistoryIcon from "./icons/history.svg";
import PageIcon from "./icons/page.svg";
import LockIcon from "./icons/lock.svg";
import ReloadIcon from "./icons/reload.svg";
import ShareIcon from "./icons/share.svg";
import NewTabIcon from "./icons/new-tab.svg";
import TabsIcon from "./icons/tabs.svg";
import OverflowIcon from "./icons/overflow.svg";
import { FIELD_GAP, FIELD_MAX, ITEMS, MENU, MIN_GAP, hiddenItems, type Cluster, type ItemId } from "./fit";
import { LABELS } from "./labels";

// Safari's toolbar from the walkthrough videos (SW Curie 25726:30182), tinted with a project's accent. Short of room,
// the address field narrows to fit its URL, then the other items fold into a » menu.

export const BAR_HEIGHT = 44;

/** Where the window's page can go: back or forward, each only when there's a page there. */
export type BarHistory = { back?: () => void; forward?: () => void };

const ICONS: Record<ItemId, FC<SVGProps<SVGSVGElement>>> = {
  sidebar: SidebarIcon,
  back: BackIcon,
  forward: ForwardIcon,
  favorites: FavoritesIcon,
  history: HistoryIcon,
  share: ShareIcon,
  newTab: NewTabIcon,
  tabs: TabsIcon,
};

// The field's box around its URL: padding and gaps either side, and the page and reload icons.
const FIELD_CHROME = 8 * 4 + 14 + 13;

const barStyle = css({
  // Above the page in the window; the page should isolate its own layers.
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: "44px",
  paddingInline: "10px",
  backgroundColor: "var(--browser-bar-accent)",
  // Ruled off from the page as thinly as the window's outline, at half its strength, however the window is scaled
  // (`--window-scale`). The rule hangs below the bar on an opaque copy of it: a scale that puts the bar's edge and the
  // page's mid-pixel would otherwise show the window's ground between them.
  boxShadow:
    "0 calc(0.5px / var(--window-scale, 1)) 0 color-mix(in srgb, var(--colors-border-image-outline) 50%, transparent), 0 calc(0.5px / var(--window-scale, 1)) 0 var(--browser-bar-accent)",
  // The icons' white is currentColor (SVGR).
  color: "var(--browser-bar-glyph)",
  "--browser-bar-font": "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
});

const clusterStyle = css({ display: "flex", alignItems: "center", flexShrink: 0 });

const middleStyle = css({ display: "flex", alignItems: "center", flex: "0 1 auto", minWidth: 0 });

// Figma's 172: its icons and 100 of space before them, which goes before the field narrows.
const endStyle = css({ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: "0 1000 172px" });

const spacerStyle = css({ flex: "1 1 0" });

const glyphStyle = css({ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });

const fieldStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  // A width, not a basis, so its cluster sizes to it before both shrink.
  flex: "0 1 auto",
  width: "600px",
  minWidth: 0,
  height: "28px",
  paddingInline: "8px",
  borderRadius: "5px",
  backgroundColor: "rgb(0 0 0 / 0.1)",
});

const urlStyle = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "500 12px var(--browser-bar-font)",
  "& svg": { display: "inline-block", verticalAlign: "-1px" },
});

const buttonStyle = css({
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  cursor: "default",
  _disabled: { opacity: 0.4 },
});

const menuStyle = css({
  position: "absolute",
  insetBlockStart: "100%",
  insetInlineEnd: "10px",
  display: "flex",
  flexDirection: "column",
  padding: "sm",
  whiteSpace: "nowrap",
  borderRadius: "sm",
  backgroundColor: "bg.canvas",
  boxShadow:
    "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

const menuRowStyle = css({
  fontFamily: "var(--browser-bar-font)",
  border: "none",
  background: "none",
  _hover: { backgroundColor: "field.bg.hover" },
});

const menuGlyphStyle = css({ display: "flex", alignItems: "center", justifyContent: "center" });

// With a history, back and forward follow it, each off with nowhere to go.
const navigates = (id: ItemId): id is keyof BarHistory => id === "back" || id === "forward";

function Item({ id, first, history }: { id: ItemId; first: boolean; history?: BarHistory }) {
  const item = ITEMS.find((entry) => entry.id === id)!;
  const Icon = ICONS[id];
  const style = { width: item.width, height: item.height, marginInlineStart: first ? 0 : item.gap };
  if (history && navigates(id))
    return (
      <button
        type="button"
        aria-label={LABELS[id]}
        disabled={!history[id]}
        className={cx(glyphStyle, buttonStyle)}
        style={style}
        onClick={history[id]}
      >
        <Icon aria-hidden />
      </button>
    );
  return (
    <span aria-hidden className={glyphStyle} style={style}>
      <Icon />
    </span>
  );
}

function shown(cluster: Cluster, hidden: ItemId[]) {
  return ITEMS.filter((item) => item.cluster === cluster && !hidden.includes(item.id)).map((item) => item.id);
}

export function BrowserBar({
  url,
  accent,
  glyph = "#fff",
  history,
}: {
  url: string;
  /** The bar's tint: any CSS colour. */
  accent: string;
  /** Its icons and URL. */
  glyph?: string;
  /** Its back and forward's moves; without it they're pictures. */
  history?: BarHistory;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const address = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<ItemId[]>([]);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    const node = bar.current;
    const text = address.current;
    if (!node || !text) return;
    const fit = () => {
      const width = node.clientWidth;
      const next = hiddenItems(width, Math.min(text.scrollWidth + FIELD_CHROME, FIELD_MAX));
      setHidden((current) => (current.join() === next.join() ? current : next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [url]);

  useDismiss({ ref: menu, onDismiss: close, ignoreSelector: "[data-browser-bar-overflow]", enabled: open });
  // An enclosing dialog takes Escape before `useDismiss` sees it, and passes it on as this event.
  useEffect(() => {
    const node = menu.current;
    if (!open || !node) return;
    node.addEventListener("escape-layer", close);
    return () => node.removeEventListener("escape-layer", close);
  }, [open, close]);

  const start = shown("start", hidden);
  const middle = shown("middle", hidden);
  const end = shown("end", hidden);
  const folded = ITEMS.filter((item) => hidden.includes(item.id));

  return (
    <div
      ref={bar}
      className={barStyle}
      style={{ "--browser-bar-accent": accent, "--browser-bar-glyph": glyph } as CSSProperties}
    >
      <div className={clusterStyle}>
        <WindowControls aria-hidden />
        {start.map((id) => (
          <Item key={id} id={id} first={false} history={history} />
        ))}
      </div>
      <span className={spacerStyle} style={{ minWidth: MIN_GAP }} />
      <div className={middleStyle}>
        {middle.map((id, i) => (
          <Item key={id} id={id} first={i === 0} history={history} />
        ))}
        <div className={fieldStyle} style={{ marginInlineStart: middle.length ? FIELD_GAP : 0 }} aria-hidden>
          <span className={glyphStyle} style={{ width: 14, height: 14 }}>
            <PageIcon />
          </span>
          <span ref={address} className={urlStyle}>
            <LockIcon /> {url}
          </span>
          <span className={glyphStyle} style={{ width: 13, height: 14 }}>
            <ReloadIcon />
          </span>
        </div>
      </div>
      <span className={spacerStyle} style={{ minWidth: MIN_GAP }} />
      <div className={endStyle}>
        {end.map((id, i) => (
          <Item key={id} id={id} first={i === 0} history={history} />
        ))}
        {folded.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            data-browser-bar-overflow=""
            className={cx(glyphStyle, buttonStyle)}
            style={{ width: MENU.width, height: 17, marginInlineStart: end.length ? MENU.gap : 0 }}
            onClick={() => setOpen((value) => !value)}
          >
            <OverflowIcon />
          </button>
        )}
      </div>
      {open && folded.length > 0 && (
        <div ref={menu} className={menuStyle} data-escape-layer="">
          {folded.map((item) => {
            const Icon = ICONS[item.id];
            const follows = !!history && navigates(item.id);
            const go = follows ? history[item.id as keyof BarHistory] : undefined;
            return (
              <button
                key={item.id}
                type="button"
                tabIndex={-1}
                disabled={follows && !go}
                className={cx(menuItem(), menuRowStyle)}
                onClick={() => {
                  close();
                  go?.();
                }}
              >
                <span className={cx(menuIcon(), menuGlyphStyle)}>
                  <Icon />
                </span>
                {LABELS[item.id]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
