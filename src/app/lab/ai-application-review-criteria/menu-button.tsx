"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from "react";
import { css, cva } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import SeparatorLine from "./icons/separator-menu.svg";

// Not portalled: everything outside the modal drawer is inert.

export interface MenuItem {
  icon: FC<SVGProps<SVGSVGElement>>;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  separated?: boolean;
}

const anchorStyle = css({ position: "relative", flexShrink: 0 });

const menu = cva({
  base: {
    position: "absolute",
    insetBlockStart: "calc(100% + 4px)",
    insetInlineEnd: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "8px",
    backgroundColor: "var(--cashby-surface)",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
    filter: "drop-shadow(0 0 10px var(--cashby-border))",
  },
  variants: {
    width: {
      narrow: { width: "200px" },
      wide: { width: "260px" },
    },
  },
});

const itemStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  width: "100%",
  padding: "8px",
  font: "var(--cashby-text-label)",
  color: "var(--cashby-ink)",
  textAlign: "start",
  whiteSpace: "nowrap",
  outline: "none",
  _hover: { backgroundColor: "var(--cashby-fill)" },
  _focusVisible: { backgroundColor: "var(--cashby-fill)" },
  "&[aria-disabled=true]": {
    color: "var(--cashby-ink-disabled)",
    _hover: { backgroundColor: "transparent" },
  },
});

const separatorStyle = css({ position: "relative", flexShrink: 0, height: 0 });
const separatorLineStyle = css({
  position: "absolute",
  insetBlockStart: "-0.25px",
  insetInlineStart: 0,
});

export interface MenuButtonProps {
  className: string;
  children: ReactNode;
  width: "narrow" | "wide";
  items: MenuItem[];
  triggerRef?: RefObject<HTMLButtonElement | null>;
  "aria-describedby"?: string;
}

export function MenuButton({
  className,
  children,
  width,
  items,
  triggerRef: givenTriggerRef,
  "aria-describedby": describedBy,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = givenTriggerRef ?? ownTriggerRef;
  const triggerId = useId();
  const menuId = useId();

  const dismiss = useCallback(() => {
    if (menuRef.current?.contains(document.activeElement))
      triggerRef.current?.focus();
    setOpen(false);
  }, [triggerRef]);

  // The trigger is exempt from "a press outside", so it can close what it opened.
  useDismiss({
    ref: menuRef,
    onDismiss: dismiss,
    ignoreSelector: `[data-menu-trigger="${triggerId}"]`,
    enabled: open,
  });

  useEffect(() => {
    if (open)
      menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const all = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ??
        []),
    ];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      all[(at + step + all.length) % all.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      all[event.key === "Home" ? 0 : all.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  // Refocus the trigger before acting, so a dialog it opens hands focus back there.
  function choose(item: MenuItem) {
    if (item.disabled) return;
    triggerRef.current?.focus();
    setOpen(false);
    item.onSelect?.();
  }

  return (
    <div className={anchorStyle}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        data-menu-trigger={triggerId}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((was) => !was)}
      >
        {children}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={menu({ width })}
          // Read by useModal: a backdrop press then closes only the menu.
          data-open-menu=""
          onKeyDown={handleKeyDown}
        >
          {items.map((item) => (
            <MenuRow
              key={item.label}
              item={item}
              onChoose={() => choose(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ item, onChoose }: { item: MenuItem; onChoose: () => void }) {
  const Icon = item.icon;
  return (
    <>
      {item.separated && (
        <div role="separator" className={separatorStyle}>
          <SeparatorLine aria-hidden className={separatorLineStyle} />
        </div>
      )}
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={itemStyle}
        aria-disabled={item.disabled || undefined}
        onClick={onChoose}
      >
        <Icon aria-hidden />
        {item.label}
      </button>
    </>
  );
}
