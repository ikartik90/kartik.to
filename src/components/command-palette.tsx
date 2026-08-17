"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { css } from "../../styled-system/css";
import {
  dialogPanel,
  hotkey,
  menuIcon,
  menuItem,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";
import { hasShortcutModifier } from "@/utils/keyboard-shortcut";
import SearchIcon from "@/assets/icons/search.svg";
import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import EditIcon from "@/assets/icons/edit.svg";
import MetadataIcon from "@/assets/icons/metadata.svg";
import WriteIcon from "@/assets/icons/write.svg";
import WorkIcon from "@/assets/icons/work.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import SaveIcon from "@/assets/icons/save.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderColor: "border.divider",
  flexShrink: 0,
  color: "text.body",
});

const inputStyle = css({
  flex: "1 0 0",
  background: "none",
  border: "none",
  textStyle: "bodySmall",
  color: "text.body",
  focusVisibleRing: "none",
  _focusVisible: {
    boxShadow: "none",
    borderRadius: "unset",
  },
  _placeholder: {
    color: "text.body/25",
  },
});

const iconStyle = menuIcon();

const hotkeyHintStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  flexShrink: 0,
});

const hotkeyKeyStyle = hotkey({ surface: "menu" });

const hotkeyLabelStyle = css({
  textStyle: "caption",
  color: "text.body/50",
  whiteSpace: "nowrap",
});

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "md",
  overflowY: "auto",
});

const groupStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingInline: "sm",
});

const groupHeadingStyle = css({
  display: "flex",
  alignItems: "center",
  height: "24px",
  paddingInline: "md",
  textStyle: "caption",
  color: "text.body/50",
});

const itemStyle = menuItem();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Incrementing key forces Command to remount on each open, clearing search
  const [openKey, setOpenKey] = useState(0);

  const close = () => dialogRef.current?.close();

  const {
    isAdmin,
    isDark,
    isEditMode,
    editCategory,
    drafts,
    currentDraft,
    handleThemeToggle,
    handleEditPage,
    handleNewBlogArticle,
    handleNewWorkArticle,
    handleOpenDraft,
    handlePublish,
    handleSaveDraft,
    handleDiscardChanges,
    handleDiscardDraft,
  } = useCommandPalette(close, openKey);

  useEffect(() => {
    // Guarded rather than toggling: `showModal()` on an already-open dialog
    // throws, and a caller ringing the doorbell is asking for the palette, not
    // asking about it. Only the shortcut, which is also how you dismiss it,
    // toggles.
    function open() {
      if (dialogRef.current?.open) return;
      dialogRef.current?.showModal();
      setOpenKey((k) => k + 1);
    }
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K on Apple hardware, Ctrl K everywhere else — whichever key the
      // header's chip is offering on this platform.
      if (hasShortcutModifier(e) && e.key === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) {
          dialogRef.current.close();
        } else {
          open();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    const unsubscribe = subscribeCommandPalette(open);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unsubscribe();
    };
  }, []);

  return (
    <Dialog
      ref={dialogRef}
      align="top-center"
      aria-label="Command palette"
      className={dialogPanel({ size: "sm" })}
    >
      <Command key={openKey} loop className={css({ display: "contents" })}>
        {/* Input row */}
        <div className={inputRowStyle} data-command-input-row>
          <SearchIcon className={iconStyle} />
          <Command.Input
            autoFocus
            placeholder="Search…"
            className={inputStyle}
          />
          <div className={hotkeyHintStyle}>
            <kbd className={hotkeyKeyStyle}>Esc</kbd>
            <span className={hotkeyLabelStyle}>to exit</span>
          </div>
        </div>

        {/* Results */}
        <Command.List className={listStyle}>
          {/* Settings — always visible */}
          <Command.Group className={groupStyle}>
            <div className={groupHeadingStyle}>Settings</div>
            <Command.Item className={itemStyle} onSelect={handleThemeToggle}>
              {isDark ? (
                <LightIcon className={iconStyle} />
              ) : (
                <DarkIcon className={iconStyle} />
              )}
              {isDark ? "Switch to light theme" : "Switch to dark theme"}
            </Command.Item>
          </Command.Group>

          {/* Admin-only groups */}
          {isAdmin && (
            <>
              {/* This Article — only in edit mode */}
              {isEditMode ? (
                <Command.Group className={groupStyle}>
                  <div className={groupHeadingStyle}>
                    {editCategory === "WORK" ? "This Project" : "This Article"}
                  </div>
                  <Command.Item className={itemStyle} onSelect={handlePublish}>
                    <PublishIcon className={iconStyle} />
                    {editCategory === "WORK"
                      ? "Publish project"
                      : "Publish article"}
                  </Command.Item>
                  <Command.Item
                    className={itemStyle}
                    onSelect={handleSaveDraft}
                  >
                    <SaveIcon className={iconStyle} />
                    Save changes and exit
                  </Command.Item>
                  <Command.Item
                    className={itemStyle}
                    onSelect={handleDiscardChanges}
                  >
                    <TrashIcon className={iconStyle} />
                    Discard changes and exit
                  </Command.Item>
                </Command.Group>
              ) : (
                <>
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>This Page</div>
                    <Command.Item className={itemStyle} onSelect={handleEditPage}>
                      <EditIcon className={iconStyle} />
                      Edit page
                    </Command.Item>
                    <Command.Item
                      className={itemStyle}
                      onSelect={() => {
                        console.log("edit metadata");
                        close();
                      }}
                    >
                      <MetadataIcon className={iconStyle} />
                      Edit metadata
                    </Command.Item>
                    {currentDraft && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={handleDiscardDraft}
                      >
                        <TrashIcon className={iconStyle} />
                        Discard draft
                      </Command.Item>
                    )}
                  </Command.Group>

                  {/* Publish */}
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>Publish</div>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handleNewBlogArticle}
                    >
                      <WriteIcon className={iconStyle} />
                      New blog article…
                    </Command.Item>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handleNewWorkArticle}
                    >
                      <WorkIcon className={iconStyle} />
                      New work article…
                    </Command.Item>
                  </Command.Group>

                  {/* Drafts — the draft being viewed is omitted so the
                      current page never lists itself */}
                  {(() => {
                    const listableDrafts = drafts.filter(
                      (draft) => draft.id !== currentDraft?.id,
                    );
                    if (listableDrafts.length === 0) return null;
                    return (
                    <Command.Group className={groupStyle}>
                      <div className={groupHeadingStyle}>Drafts</div>
                      {listableDrafts.map((draft) => (
                        <Command.Item
                          key={draft.id}
                          className={itemStyle}
                          onSelect={() => handleOpenDraft(draft)}
                        >
                          {draft.category === "WORK" ? (
                            <WorkIcon className={iconStyle} />
                          ) : (
                            <WriteIcon className={iconStyle} />
                          )}
                          {draft.title ?? `Untitled ${draft.untitledIndex ?? ""}`}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </Command.List>
      </Command>
    </Dialog>
  );
}
