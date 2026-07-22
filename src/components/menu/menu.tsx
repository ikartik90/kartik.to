"use client";

import { useEffect } from "react";
import { css, cx } from "../../../styled-system/css";
import {
  menuItem,
  selectionPopoverDivider,
  selectionPopoverItem,
} from "../../../styled-system/recipes";
import { MenuProvider, useMenuContext, useRegisterItem } from "./menu-context";

// ---------------------------------------------------------------------------
// Menu — the compound components that sit inside a Popover. Two roots:
//   • Menu.Listbox (+ Menu.Option) — a filterable, arrow-navigable pick-one list
//     backed by the registry. The slash menu.
//   • Menu.Toolbar (+ Menu.Group, Menu.Button) — a pointer-first row of buttons
//     with independent pressed state. The selection / link / bullet / number
//     toolbars. No cursor/keyboard: capturing arrows would collide with caret
//     movement over the live editor selection.
// ---------------------------------------------------------------------------

// Module-level pointer tracker — captured before any menu mounts so a listbox
// can preselect the option already under the cursor when it opens.
let pointerX = -1;
let pointerY = -1;
if (typeof document !== "undefined") {
  document.addEventListener(
    "mousemove",
    (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    },
    { passive: true },
  );
}

// --- Listbox ---------------------------------------------------------------

interface MenuListboxProps {
  /** Filter query — options whose value/keywords don't match are hidden. */
  query?: string;
  /** Wrap the cursor at the ends. */
  loop?: boolean;
  children: React.ReactNode;
}

function ListboxController({ children }: { children: React.ReactNode }) {
  const { move, activate, setActiveId } = useMenuContext();

  // Arrow/Enter drive the virtual cursor while focus stays in the editor.
  // Escape is owned by the Popover shell (useDismiss), so it isn't handled here.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          activate();
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [move, activate]);

  // Preselect the option already under the pointer when the menu opens.
  useEffect(() => {
    if (typeof document.elementFromPoint !== "function") return;
    const raf = requestAnimationFrame(() => {
      const id = document
        .elementFromPoint(pointerX, pointerY)
        ?.closest<HTMLElement>("[data-menu-option-id]")
        ?.getAttribute("data-menu-option-id");
      if (id) setActiveId(id);
    });
    return () => cancelAnimationFrame(raf);
  }, [setActiveId]);

  return <>{children}</>;
}

function MenuListbox({ query = "", loop = true, children }: MenuListboxProps) {
  return (
    <MenuProvider query={query} loop={loop} autoActivateFirst>
      <ListboxController>{children}</ListboxController>
    </MenuProvider>
  );
}

// --- Option (listbox item) -------------------------------------------------

interface MenuOptionProps {
  /** Stable unique id (within this menu). */
  id: string;
  /** Text matched against the query — usually the visible label. */
  value: string;
  keywords?: string[];
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

function MenuOption({
  id,
  value,
  keywords,
  disabled,
  onSelect,
  className,
  children,
  "aria-label": ariaLabel,
}: MenuOptionProps) {
  const { ref, isActive } = useRegisterItem({ id, value, keywords, disabled });
  const { setActiveId, isVisible } = useMenuContext();

  return (
    <button
      ref={ref}
      data-menu-option-id={id}
      type="button"
      role="option"
      aria-selected={isActive}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      data-active={isActive ? "true" : undefined}
      // Registered even while hidden so the registry filters nav consistently;
      // `hidden` keeps a non-matching option out of view and the a11y tree.
      hidden={!isVisible(id)}
      className={className ? cx(menuItem(), className) : menuItem()}
      onPointerEnter={() => {
        if (!disabled) setActiveId(id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

// --- Toolbar ---------------------------------------------------------------

function MenuToolbar({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// --- Group (toolbar divider group) -----------------------------------------

function MenuGroup({ children }: { children: React.ReactNode }) {
  // display:contents keeps the buttons in the toolbar's flex row; the leading
  // divider separates this group from the preceding one.
  return (
    <div className={css({ display: "contents" })}>
      <span className={selectionPopoverDivider()} aria-hidden />
      {children}
    </div>
  );
}

// --- Button (toolbar item) -------------------------------------------------

/** Prevent a button press from collapsing the editor's text selection/caret.
 *  A per-control focus policy — buttons must not steal the selection, so it
 *  lives here with Menu.Button rather than on the (focus-agnostic) shell. */
const preserveSelection = (e: React.MouseEvent) => e.preventDefault();

interface MenuButtonProps {
  ariaLabel: string;
  /** Toggle state — omit for plain action buttons (no aria-pressed). */
  pressed?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

function MenuButton({
  ariaLabel,
  pressed,
  onClick,
  className,
  children,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      className={
        className
          ? cx(selectionPopoverItem(), className)
          : selectionPopoverItem()
      }
      aria-label={ariaLabel}
      aria-pressed={pressed}
      data-active={pressed ? "true" : undefined}
      onMouseDown={preserveSelection}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const Menu = {
  Listbox: MenuListbox,
  Option: MenuOption,
  Toolbar: MenuToolbar,
  Group: MenuGroup,
  Button: MenuButton,
};
