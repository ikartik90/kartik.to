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
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { OFFER } from "@/components/theme-toggle";
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
import ComponentIcon from "@/assets/icons/component.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import ShaderIcon from "@/assets/icons/shader.svg";

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

  // The palette owns its own component picker rather than reaching for the
  // grid's: "New component…" has to work from any page, and the grid only
  // exists on one of them.
  const [pickingComponent, setPickingComponent] = useState(false);

  // Anything that removes published work asks first, in the same dialog the
  // grid uses to retire a component. One piece of state rather than a flag per
  // action: the question is identical in shape every time and only the wording
  // differs.
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const {
    isAdmin,
    isDark,
    isEditMode,
    isHomeEditMode,
    handlePublishHome,
    handleDiscardHome,
    handlePublishComponent,
    handleUnpublish,
    isPublished,
    editCategory,
    drafts,
    currentDraft,
    handleThemeToggle,
    handleCoverPlayground,
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
    <>
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
                {isDark ? OFFER.light : OFFER.dark}
              </Command.Item>
            </Command.Group>

            {/* Playground — always visible, like Settings above it. Nothing
                here writes to the site: the playground reads a shader table,
                draws a canvas and hands back a JSX tag, so there is no session
                to have and nothing for a gate to protect. It is also the only
                way in, which is why it sits above the admin groups rather than
                at the foot of a list a visitor never sees the rest of. */}
            <Command.Group className={groupStyle}>
              <div className={groupHeadingStyle}>Playground</div>
              <Command.Item
                className={itemStyle}
                onSelect={handleCoverPlayground}
              >
                <ShaderIcon className={iconStyle} />
                Cover Playground
              </Command.Item>
            </Command.Group>

            {/* Admin-only groups */}
            {isAdmin && (
              <>
                {/* The grid's edit route — a grid has no title and no buffered
                    document, so none of an article's exits apply to it. */}
                {isHomeEditMode ? (
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>This Page</div>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handlePublishHome}
                    >
                      <PublishIcon className={iconStyle} />
                      Publish and exit
                    </Command.Item>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handleDiscardHome}
                    >
                      <TrashIcon className={iconStyle} />
                      Discard and exit
                    </Command.Item>
                  </Command.Group>
                ) : isEditMode ? (
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>
                      {editCategory === "WORK"
                        ? "This Project"
                        : "This Article"}
                    </div>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handlePublish}
                    >
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
                    {/* Only a live post has something to withdraw. */}
                    {isPublished && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={() => {
                          const noun =
                            editCategory === "WORK" ? "Project" : "Article";
                          setConfirm({
                            title: `Unpublish ${noun}`,
                            message: `You are about to unpublish this ${noun.toLowerCase()}. Do you want to proceed?`,
                            confirmLabel: "Unpublish",
                            onConfirm: () => void handleUnpublish(),
                          });
                          close();
                        }}
                      >
                        <UnpublishIcon className={iconStyle} />
                        {editCategory === "WORK"
                          ? "Unpublish project"
                          : "Unpublish article"}
                      </Command.Item>
                    )}
                  </Command.Group>
                ) : (
                  <>
                    <Command.Group className={groupStyle}>
                      <div className={groupHeadingStyle}>This Page</div>
                      <Command.Item
                        className={itemStyle}
                        onSelect={handleEditPage}
                      >
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
                          onSelect={() => {
                            setConfirm({
                              title: "Delete Draft",
                              message:
                                "You are about to permanently delete this draft. Do you want to proceed?",
                              confirmLabel: "Delete",
                              onConfirm: () => void handleDiscardDraft(),
                            });
                            close();
                          }}
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
                      {/* Published, but NOT pinned — unlike the grid's own [+],
                        which places a component at a seat you chose. Arriving
                        from the palette there is no seat in mind, so it takes
                        whatever chronology gives it. */}
                      <Command.Item
                        className={itemStyle}
                        onSelect={() => {
                          setPickingComponent(true);
                          close();
                        }}
                      >
                        <ComponentIcon className={iconStyle} />
                        New component…
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
                              {draft.title ??
                                `Untitled ${draft.untitledIndex ?? ""}`}
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

      {/* Sibling of the palette, not a child: the picker is a modal of its own
          and the palette closes on the way into it. */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel ?? ""}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      <ComponentInsertDialog
        open={pickingComponent}
        onClose={() => setPickingComponent(false)}
        onInsert={(componentId) => {
          void handlePublishComponent(componentId);
          setPickingComponent(false);
        }}
      />
    </>
  );
}
