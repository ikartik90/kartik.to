"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  inlineEditRow,
  menuIcon,
  toolbarSwatch,
} from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import LinkIcon from "@/assets/icons/link.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import NewTabIcon from "@/assets/icons/new-tab.svg";
import StickyIcon from "@/assets/icons/sticky.svg";
import type { ButtonLinkColor } from "@/domain/nodes";

const iconStyle = menuIcon();

const editRow = inlineEditRow();

const swatchGroupStyle = css({ display: "contents" });

const COLORS: { value: ButtonLinkColor; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "accent", label: "Accent" },
];

export interface LinkActionsProps {
  onEdit: () => void;
  onOpen: () => void;
  onRemove: () => void;
  removeLabel?: string;
  canOpen?: boolean;
  /** Whether the link stays in view; only a button can. */
  sticky?: boolean;
  onToggleSticky?: () => void;
  color?: ButtonLinkColor;
  onColorChange?: (color: ButtonLinkColor) => void;
}

/** Edit, Open, Remove, and for a button, Sticky and its colour. */
export function LinkActions({
  onEdit,
  onOpen,
  onRemove,
  removeLabel = "Remove link",
  canOpen = true,
  sticky = false,
  onToggleSticky,
  color = "neutral",
  onColorChange,
}: LinkActionsProps) {
  return (
    <OptionList direction="inline">
      <OptionList.Toolbar aria-label="Link actions">
        <OptionList.Option aria-label="Edit link" onClick={onEdit}>
          <EditIcon aria-hidden />
        </OptionList.Option>
        <OptionList.Option
          aria-label="Open link"
          disabled={!canOpen}
          onClick={onOpen}
        >
          <GotoIcon aria-hidden />
        </OptionList.Option>
        <OptionList.Option aria-label={removeLabel} onClick={onRemove}>
          <TrashIcon aria-hidden />
        </OptionList.Option>
        {onToggleSticky && (
          <>
            <OptionList.Divider />
            <OptionList.Option
              aria-label="Sticky"
              pressed={sticky}
              onClick={onToggleSticky}
            >
              <StickyIcon aria-hidden />
            </OptionList.Option>
          </>
        )}
        {onColorChange && (
          <>
            <OptionList.Divider />
            <div
              role="radiogroup"
              aria-label="Button colour"
              className={swatchGroupStyle}
            >
              {COLORS.map(({ value, label }) => (
                <OptionList.Option
                  key={value}
                  role="radio"
                  aria-label={label}
                  aria-checked={color === value}
                  onClick={() => onColorChange(value)}
                >
                  <span className={toolbarSwatch({ tone: value })} />
                </OptionList.Option>
              ))}
            </div>
          </>
        )}
      </OptionList.Toolbar>
    </OptionList>
  );
}

export interface LinkEditRowProps {
  href?: string;
  newTab?: boolean;
  onApply: (href: string, newTab: boolean) => void;
  invalid?: boolean;
  onInput?: () => void;
}

/** Seeded on mount, so a host remounts it each time editing starts. */
export function LinkEditRow({
  href: initial,
  newTab: initialNewTab = false,
  onApply,
  invalid,
  onInput,
}: LinkEditRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState(initial ?? "");
  const [newTab, setNewTab] = useState(initialNewTab);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className={editRow.root}>
      <LinkIcon className={iconStyle} aria-hidden />
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        placeholder="https://..."
        aria-label="Link URL"
        aria-invalid={invalid || undefined}
        className={editRow.input}
        value={href}
        onChange={(e) => {
          setHref(e.target.value);
          onInput?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const trimmed = href.trim();
            if (trimmed) onApply(trimmed, newTab);
          }
        }}
      />
      <div className={editRow.options}>
        <OptionList direction="inline">
          <OptionList.Divider />
          <OptionList.Toolbar aria-label="Link options">
            <OptionList.Option
              aria-label="Open in new tab"
              pressed={newTab}
              onClick={() => setNewTab((was) => !was)}
            >
              <NewTabIcon aria-hidden />
            </OptionList.Option>
          </OptionList.Toolbar>
          <OptionList.Divider />
        </OptionList>
      </div>
      <div className={editRow.hint} aria-hidden>
        <span className={editRow.hintKey}>Esc</span>
        <span className={editRow.hintLabel}>to exit</span>
      </div>
    </div>
  );
}
