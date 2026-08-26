"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { css, cx } from "../../styled-system/css";
import {
  dialogPanel,
  hotkey,
  menuIcon,
  menuItem,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useHasCursor } from "@/hooks/use-has-cursor";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { OFFER } from "@/components/theme-toggle";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";
import { takePaletteIntent } from "@/utils/palette-intent";
import { hasShortcutModifier } from "@/utils/keyboard-shortcut";
import SearchIcon from "@/assets/icons/search.svg";
import CrossIcon from "@/assets/icons/cross.svg";
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
import ReturnIcon from "@/assets/icons/return.svg";
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
  // 16px on a touch device, and NOT because the field wants to be bigger there.
  // Mobile Safari zooms the page in on any field it focuses whose text is under
  // 16px, and the palette is already sized for the viewport it is in — so the
  // zoom does not reveal anything, it just leaves the page scrolled sideways at
  // a scale the reader has to pinch back out of. Sizing the text past the
  // threshold is what declines it; the 14px row is the cursor's, where no
  // browser does this.
  textStyle: "bodyLarge",
  _hasCursor: { textStyle: "bodySmall" },
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

// The way out, on a device that has to be able to press it.
//
// An icon button pads its 20px glyph by 4px, so left alone the cross would sit
// 4px further from the edge than the Esc chip it stands in for. The negative
// inset pulls the BOX out by that padding, leaving the glyph on the row's own
// `paddingInline` — the same margin the search icon keeps at the other end.
const closeButtonStyle = css({ marginInlineEnd: "-sm" });

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

// The row's own shortcut, held against the far end of it — the item says where
// it goes, the chip says how to get there without opening this at all. Drawn
// only where there is a keyboard to take the offer up; see `hasCursor`.
const itemHotkeyStyle = cx(
  hotkey({ surface: "menu" }),
  css({ marginInlineStart: "auto" }),
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Incrementing key forces Command to remount on each open, clearing search
  const [openKey, setOpenKey] = useState(0);

  const close = () => dialogRef.current?.close();

  /**
   * Which palette this device gets.
   *
   * The same field either way — what differs is whether it TAKES the focus, and
   * what the row says beside it. On a keyboard search is the palette: ⌘K then
   * type, so the field is focused because the next thing that happens is
   * typing. A phone opened this to TAP something; the field is there to be
   * tapped, and a field that grabs focus on open answers a question nobody
   * asked by filling half the screen with a keyboard.
   *
   * It decides the row's other two seats for the same reason. The Esc hint
   * names a key the device does not have, so a touch visitor gets a close
   * button that does what Esc does; and the shortcut chips on the rows below
   * name keys nothing can press, so they are withheld there too — the same
   * split `_hasCursor` makes of the header's own ⌘K chip.
   */
  const hasCursor = useHasCursor();

  /**
   * Whether the palette is up.
   *
   * Only here to gate the field's `autoFocus`. `useHasCursor` settles one commit
   * after hydration, which on a cursor device mounts the field for the first
   * time while the dialog is still CLOSED — and an `autoFocus` honoured there
   * would pull focus off the page the reader is actually on. Gating it on this
   * costs nothing at open time, when the whole `Command` remounts anyway.
   */
  const [isOpen, setIsOpen] = useState(false);

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
    handlePublishComponent,
    handleUnpublish,
    isPublished,
    editCategory,
    drafts,
    currentDraft,
    backTarget,
    handleBack,
    handleThemeToggle,
    handleCoverPlayground,
    isCoverPlayground,
    editorKind,
    handleSaveChanges,
    handleDiscardAndExit,
    pendingExit,
    confirmExitSave,
    confirmExitDiscard,
    cancelExit,
    handleEditPage,
    handleNewBlogArticle,
    handleNewWorkArticle,
    handleOpenDraft,
    handlePublish,
    handleDiscardDraft,
  } = useCommandPalette(close, openKey);

  // The chip names the key this visitor's keyboard actually has — ⌘[ on Apple
  // hardware, Ctrl [ on a PC — which is the same shortcut the hook listens for
  // on each.
  const backShortcut = useShortcutLabel("[");
  const saveShortcut = useShortcutLabel("S");

  /**
   * Whether the palette should offer to take you somewhere at all.
   *
   * Two reasons it should not, and they are different reasons for the same
   * answer. Inside an EDITOR, leaving is not a thing you simply do: it decides
   * what becomes of the buffered work, which is exactly why "Back to …" is
   * withheld there too — the exits an editor offers each say what happens to
   * the document, and a bare destination would answer that by throwing it away
   * without saying so. And on the playground ITSELF there is nowhere to go: a
   * command to the page you are standing on is a row that does nothing, the
   * same rule the Drafts group follows in omitting the draft being viewed.
   *
   * Settings is not covered by this and should not be — it changes the page you
   * are on rather than taking you off it.
   */
  /**
   * The open editor's heading — one heading in three wordings, because "This
   * Cover" / "This Page" / "This Article" all name the same thing: whatever is
   * being edited right now.
   */
  const editorTitle =
    editorKind === "cover"
      ? "This Cover"
      : editorKind === "grid"
        ? "This Page"
        : editCategory === "WORK"
          ? "This Project"
          : "This Article";

  const offersDestinations =
    !isEditMode && !isHomeEditMode && !isCoverPlayground;

  useEffect(() => {
    // Guarded rather than toggling: `showModal()` on an already-open dialog
    // throws, and a caller ringing the doorbell is asking for the palette, not
    // asking about it. Only the shortcut, which is also how you dismiss it,
    // toggles.
    function open() {
      if (dialogRef.current?.open) return;
      dialogRef.current?.showModal();
      setIsOpen(true);
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
    // A ⌘K pressed while this page was still hydrating was recorded by the
    // head script and is answered here — late, but not lost.
    if (takePaletteIntent()) open();
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
        onClose={() => setIsOpen(false)}
      >
        <Command key={openKey} loop className={css({ display: "contents" })}>
          {/* Input row — the same field on both devices, and a way out that is
              named as the key that does it where there is a key and drawn as
              the button that does it where there is not. */}
          <div className={inputRowStyle} data-command-input-row>
            <SearchIcon className={iconStyle} />
            <Command.Input
              // Focused on a keyboard, where typing is what happens next.
              // Waiting on a phone, where it is there to be TAPPED. See
              // `isOpen` for why the cursor half is not simply `autoFocus`.
              autoFocus={isOpen && hasCursor}
              placeholder="Search…"
              className={inputStyle}
            />
            {hasCursor ? (
              <div className={hotkeyHintStyle}>
                <kbd className={hotkeyKeyStyle}>Esc</kbd>
                <span className={hotkeyLabelStyle}>to exit</span>
              </div>
            ) : (
              <Button
                variant="icon"
                className={closeButtonStyle}
                aria-label="Close"
                onClick={close}
              >
                <CrossIcon />
              </Button>
            )}
          </div>

          {/* Results */}
          <Command.List className={listStyle}>
            {/* Navigate — the way out of here, which used to be an icon
                button in the page's left gutter. First, because leaving is the
                one thing every page can do and the one thing a reader who
                opened this by accident is looking for. */}
            {backTarget && (
              <Command.Group className={groupStyle}>
                <div className={groupHeadingStyle}>Navigate</div>
                <Command.Item className={itemStyle} onSelect={handleBack}>
                  <ReturnIcon className={iconStyle} />
                  {backTarget.label}
                  {hasCursor && (
                    <kbd className={itemHotkeyStyle}>{backShortcut}</kbd>
                  )}
                </Command.Item>
              </Command.Group>
            )}

            {/* Admin-only groups */}
            {isAdmin && (
              <>
                {/* Whatever editor is open, said the same way in all three.
                    They differ in what they buffer and where it goes, and in
                    nothing the author can see from here: each has unsaved work,
                    a way to commit it and a way to throw it away.

                    Save STAYS PUT — ⌘S means "commit and carry on" everywhere
                    else and must here too. Discard exits, and belongs here
                    rather than in Navigate because it is a decision about the
                    WORK: you are not going somewhere, you are throwing
                    something away and the leaving follows from it.

                    There is deliberately no save-and-exit. That one IS just
                    navigation, and "Exit editor" above already offers it — it
                    asks about unsaved work on the way out, and answering "Save
                    changes and exit" there is this same command. Two doors to
                    one room would have to agree forever.

                    Publish and Unpublish are a document's alone here. The
                    homepage is already live; a cover HAS a publication now, but
                    its control is the one in the properties panel's header,
                    beside Reset — both act on the saved row rather than on the
                    page you are looking at, and two doors to one room would
                    have to agree forever. */}
                {editorKind ? (
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>{editorTitle}</div>
                    {editorKind === "document" && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={handlePublish}
                      >
                        <PublishIcon className={iconStyle} />
                        {editCategory === "WORK"
                          ? "Publish project"
                          : "Publish article"}
                      </Command.Item>
                    )}
                    {/* The chip sits on THIS one, because this is what the key
                        does. ⌘S commits and leaves you in the editor — hanging
                        it off an exit would be a label that lies, the failure
                        `keyboard-shortcut.ts` exists to prevent. */}
                    <Command.Item
                      className={itemStyle}
                      onSelect={() => void handleSaveChanges()}
                    >
                      <SaveIcon className={iconStyle} />
                      Save changes
                      {hasCursor && (
                        <kbd className={itemHotkeyStyle}>{saveShortcut}</kbd>
                      )}
                    </Command.Item>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handleDiscardAndExit}
                    >
                      <TrashIcon className={iconStyle} />
                      Discard changes and exit
                    </Command.Item>
                    {/* Only a live post has something to withdraw. */}
                    {editorKind === "document" && isPublished && (
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

            {/* Playground — down here with Settings for the reason Settings is:
                it is not about the page you are on. Nothing in it writes to the
                site either — it reads a shader table, draws a canvas and hands
                back a JSX tag — so unlike the groups above it there is no
                session to have and nothing for a gate to protect. A
                destination, so it leads the furniture.

                Withheld while you are editing, and once you have arrived —
                see `offersDestinations`. */}
            {offersDestinations && (
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
            )}

            {/* Settings — always visible, and last: it is the palette's
                furniture rather than anything this page is about. */}
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
          </Command.List>
        </Command>
      </Dialog>

      {/* Leaving a cover with unsaved work in it. THREE answers, because all
          three are things the author might mean and none is a rewording of
          another: keep it and go, drop it and go, or stay. Rendered here beside
          the other modals for the same reason they are — the palette has
          already closed by the time this opens. */}
      <ConfirmDialog
        open={pendingExit !== null}
        title="Unsaved Changes"
        message="You have unsaved changes to this cover. How do you want to proceed?"
        confirmLabel="Save changes and exit"
        onConfirm={() => void confirmExitSave()}
        alternate={{ label: "Discard changes", onClick: confirmExitDiscard }}
        onClose={cancelExit}
      />

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
