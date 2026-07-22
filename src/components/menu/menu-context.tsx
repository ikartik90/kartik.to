"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { matchesQuery, nextActiveId, type NavItem } from "./menu-navigation";

// ---------------------------------------------------------------------------
// Menu registry — the headless engine shared by both Menu roots (Listbox and
// Toolbar). Items self-register with their DOM node so the root can resolve
// their source order, apply the query filter, and drive a single virtual cursor
// (`activeId`) — the target for `aria-activedescendant` while real focus stays
// in the editor. This is where the real work lives; the compound components are
// a thin surface over it.
// ---------------------------------------------------------------------------

export interface MenuItemData {
  /** Stable unique id — also the `aria-activedescendant` target. */
  id: string;
  /** Text matched against the query (defaults to the label at the call site). */
  value: string;
  /** Extra match terms not shown as the visible label. */
  keywords?: string[];
  disabled?: boolean;
}

interface RegisteredItem extends MenuItemData {
  element: HTMLElement;
}

export interface MenuContextValue {
  /** The virtual cursor — the item `aria-activedescendant` points at, or null. */
  activeId: string | null;
  /** Park the cursor on a specific item (e.g. hover-preselect). */
  setActiveId: (id: string | null) => void;
  /** Register an item + its DOM node; returns the unregister cleanup. */
  registerItem: (item: MenuItemData, element: HTMLElement) => () => void;
  isActive: (id: string) => boolean;
  isVisible: (id: string) => boolean;
  /** Move the cursor forward (1) or backward (-1) over the visible items. */
  move: (direction: 1 | -1) => void;
  /** The visible item under the cursor — the Enter/select target. */
  getActiveItem: () => MenuItemData | null;
  /** Fire the active item's own click handler (the Enter target's `onSelect`). */
  activate: () => void;
  /** Visible items (query-matched) in DOM order. */
  getVisibleItems: () => MenuItemData[];
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenuContext(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) {
    throw new Error("Menu components must be rendered within a Menu root");
  }
  return ctx;
}

export interface MenuProviderProps {
  /** Current filter query (listbox). Toolbars leave this empty. */
  query?: string;
  /** Wrap the cursor around the ends when navigating. */
  loop?: boolean;
  /**
   * Keep a cursor parked on the first visible item and re-home it to the top
   * whenever the query changes — the listbox behaviour. Toolbars leave this
   * `false` so nothing is preselected until the user arrows or hovers.
   */
  autoActivateFirst?: boolean;
  children: React.ReactNode;
}

function stripElement({ element: _element, ...data }: RegisteredItem): MenuItemData {
  return data;
}

function byDomOrder(a: RegisteredItem, b: RegisteredItem): number {
  if (a.element === b.element) return 0;
  const rel = a.element.compareDocumentPosition(b.element);
  if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

export function MenuProvider({
  query = "",
  loop = false,
  autoActivateFirst = false,
  children,
}: MenuProviderProps) {
  // Items are held in state (not a ref) so ordering/visibility are honest
  // useMemo derivations and the registry change is a real render dependency.
  const [items, setItems] = useState<Map<string, RegisteredItem>>(
    () => new Map(),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const registerItem = useCallback((item: MenuItemData, element: HTMLElement) => {
    setItems((prev) => {
      const next = new Map(prev);
      next.set(item.id, { ...item, element });
      return next;
    });
    return () => {
      setItems((prev) => {
        if (!prev.has(item.id)) return prev;
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
    };
  }, []);

  // Visible items (query-matched) in DOM order — robust to items mounting in a
  // different order than they appear (conditional groups, injected items).
  const visibleItems = useMemo<RegisteredItem[]>(() => {
    return Array.from(items.values())
      .sort(byDomOrder)
      .filter((entry) => matchesQuery(entry.value, entry.keywords, query));
  }, [items, query]);

  const visibleIds = useMemo(
    () => new Set(visibleItems.map((entry) => entry.id)),
    [visibleItems],
  );

  const isActive = useCallback((id: string) => id === activeId, [activeId]);
  const isVisible = useCallback((id: string) => visibleIds.has(id), [visibleIds]);

  const move = useCallback(
    (direction: 1 | -1) => {
      const nav: NavItem[] = visibleItems.map((entry) => ({
        id: entry.id,
        disabled: entry.disabled,
      }));
      setActiveId((current) => nextActiveId(nav, current, direction, loop));
    },
    [visibleItems, loop],
  );

  const getActiveItem = useCallback((): MenuItemData | null => {
    if (activeId === null) return null;
    const found = visibleItems.find((entry) => entry.id === activeId);
    return found ? stripElement(found) : null;
  }, [activeId, visibleItems]);

  const getVisibleItems = useCallback(
    (): MenuItemData[] => visibleItems.map(stripElement),
    [visibleItems],
  );

  // Fire the cursor's option by clicking its DOM node — its own onClick runs the
  // caller's onSelect. Keeps select handlers out of the registry (they'd change
  // identity every render and thrash registration).
  const activate = useCallback(() => {
    if (activeId === null) return;
    visibleItems.find((entry) => entry.id === activeId)?.element.click();
  }, [activeId, visibleItems]);

  // Keep the cursor valid as items register/unregister or the query filters the
  // active item away. Applied during render — React's "adjust state when a prop
  // changes" pattern — rather than in an effect, which would cascade a re-render.
  // Listbox re-homes to the first visible item (and to the top whenever the
  // query changes); toolbar drops an orphaned cursor to null.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevItems, setPrevItems] = useState(items);
  if (query !== prevQuery || items !== prevItems) {
    const queryChanged = query !== prevQuery;
    setPrevQuery(query);
    setPrevItems(items);

    const firstVisible = visibleItems[0]?.id ?? null;
    let next = activeId;
    if (autoActivateFirst && queryChanged) {
      next = firstVisible;
    } else if (activeId !== null && !visibleIds.has(activeId)) {
      next = autoActivateFirst ? firstVisible : null;
    } else if (autoActivateFirst && activeId === null && firstVisible !== null) {
      next = firstVisible;
    }
    if (next !== activeId) setActiveId(next);
  }

  const value = useMemo<MenuContextValue>(
    () => ({
      activeId,
      setActiveId,
      registerItem,
      isActive,
      isVisible,
      move,
      getActiveItem,
      activate,
      getVisibleItems,
    }),
    [
      activeId,
      registerItem,
      isActive,
      isVisible,
      move,
      getActiveItem,
      activate,
      getVisibleItems,
    ],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

/**
 * Registers a Menu item with its root. Attach the returned `ref` to the item's
 * DOM node (used to resolve source order) and read `isActive` to reflect the
 * cursor. Re-registers only when the item's identity-bearing fields change.
 */
export function useRegisterItem(item: MenuItemData): {
  isActive: boolean;
  ref: (element: HTMLElement | null) => void;
} {
  const { registerItem, isActive } = useMenuContext();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const keywordsKey = (item.keywords ?? []).join(" ");

  useEffect(() => {
    if (!element) return;
    return registerItem(
      {
        id: item.id,
        value: item.value,
        keywords: item.keywords,
        disabled: item.disabled,
      },
      element,
    );
    // Depend on primitive fields (keywords via keywordsKey) rather than the item
    // object, whose identity changes every render and would thrash registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerItem, element, item.id, item.value, item.disabled, keywordsKey]);

  return { isActive: isActive(item.id), ref: setElement };
}
