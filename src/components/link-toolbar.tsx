"use client";

import { useEffect, useRef, useState } from "react";
import { inlineEditRow, menuIcon } from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import LinkIcon from "@/assets/icons/link.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import NewTabIcon from "@/assets/icons/new-tab.svg";
import StickyIcon from "@/assets/icons/sticky.svg";

// ---------------------------------------------------------------------------
// The link toolbar's two faces — what a link can have done to it, and the row
// its address is typed into — as parts rather than a surface, because two
// things wear them: a link inside a line of prose (`SelectionToolbar`, anchored
// to the selection) and a button standing on its own (`EditableButtonLink`,
// anchored to the button). The surface each floats on is the host's; what is
// on it is one toolbar, so the two cannot drift apart.
// ---------------------------------------------------------------------------

const iconStyle = menuIcon();

// The shared inline-edit shell — the collection's caption editor takes over its
// cell toolbar the same way.
const editRow = inlineEditRow();

export interface LinkActionsProps {
  onEdit: () => void;
  onOpen: () => void;
  onRemove: () => void;
  /** What removing takes away — the link from a run of text, or a whole button. */
  removeLabel?: string;
  /** False while there is nowhere to open — a button not linked yet. */
  canOpen?: boolean;
  /** Whether the link stays in view. Only a button can (Figma 425:905). */
  sticky?: boolean;
  /** Offers the sticky toggle; a host without it shows no toggle. */
  onToggleSticky?: () => void;
}

/** Edit ∣ Open ∣ Remove — what can be done to a link that exists. */
export function LinkActions({
  onEdit,
  onOpen,
  onRemove,
  removeLabel = "Remove link",
  canOpen = true,
  sticky = false,
  onToggleSticky,
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
      </OptionList.Toolbar>
    </OptionList>
  );
}

export interface LinkEditRowProps {
  /** The address the box opens on. */
  href?: string;
  /** Whether the link opens in a new tab, as the toggle opens on. */
  newTab?: boolean;
  /** Enter, with something in the box. The host decides what it accepts. */
  onApply: (href: string, newTab: boolean) => void;
  /** The host refused the last address it was given. */
  invalid?: boolean;
  /** The box changed — a refused address is being corrected. */
  onInput?: () => void;
}

/**
 * The address, being typed. Seeded when it mounts and focused with its text
 * selected, so a host shows a fresh one each time editing starts.
 */
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
      {/* The dividers sit outside the toolbar group so the slot's gap spaces
          them on both sides, as in Figma (424:857). */}
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
