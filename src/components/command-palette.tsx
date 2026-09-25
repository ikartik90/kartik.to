"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { css, cx } from "../../styled-system/css";
import {
  commandGroup,
  commandHeader,
  commandList,
  dialogPanel,
  hotkey,
  menuIcon,
  menuItem,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "@/components/confirm-dialog";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useHasCursor } from "@/hooks/use-has-cursor";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { OFFER } from "@/components/theme-toggle";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";
import { takePaletteIntent } from "@/utils/palette-intent";
import { parseCommandLine } from "@/utils/palette-command";
import { resolvePaletteCommand } from "@/data/palette-commands";
import { SITE_PAGES } from "@/data/site-paths";
import { POST_CATEGORIES } from "@/data/post-categories";
import type { PostCategory } from "@/domain/post";
import { hasShortcutModifier } from "@/utils/keyboard-shortcut";
import SearchIcon from "@/assets/icons/search.svg";
import CrossIcon from "@/assets/icons/cross.svg";
import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import EditIcon from "@/assets/icons/edit.svg";
import MetadataIcon from "@/assets/icons/metadata.svg";
import WriteIcon from "@/assets/icons/write.svg";
import WorkIcon from "@/assets/icons/work.svg";
import PageIcon from "@/assets/icons/page.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import SaveIcon from "@/assets/icons/save.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import ComponentIcon from "@/assets/icons/component.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import ReturnIcon from "@/assets/icons/return.svg";
import ShaderIcon from "@/assets/icons/shader.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CalendarIcon from "@/assets/icons/calendar.svg";
import ConsoleIcon from "@/assets/icons/console.svg";

const inputRowStyle = commandHeader();

const inputStyle = css({
  flex: "1 0 0",
  background: "none",
  border: "none",
  // 16px on touch: Mobile Safari zooms into any focused field under 16px.
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

const closeButtonStyle = css({ marginInlineEnd: "-sm" });

const hotkeyKeyStyle = hotkey({ surface: "menu" });

const hotkeyLabelStyle = css({
  textStyle: "caption",
  color: "text.body/50",
  whiteSpace: "nowrap",
});

const listStyle = commandList();

const groupStyle = commandGroup();

const groupHeadingStyle = css({
  display: "flex",
  alignItems: "center",
  height: "24px",
  paddingInline: "md",
  textStyle: "caption",
  color: "text.body/50",
});

const itemStyle = menuItem();

const itemHotkeyStyle = cx(
  hotkey({ surface: "menu" }),
  css({ marginInlineStart: "auto" }),
);

const CATEGORY_ROWS: Record<
  PostCategory,
  { Icon: React.FC<React.SVGProps<SVGSVGElement>>; create?: string }
> = {
  ARTICLE: { Icon: WriteIcon, create: "New blog article…" },
  WORK: { Icon: WorkIcon, create: "New work article…" },
  PROTOTYPE: { Icon: PageIcon, create: "New prototype…" },
  PAGE: { Icon: WriteIcon },
};

const NEW_POST_ROWS = (
  Object.entries(CATEGORY_ROWS) as [
    PostCategory,
    (typeof CATEGORY_ROWS)[PostCategory],
  ][]
).flatMap(([category, { Icon, create }]) =>
  create ? [{ category, Icon, label: create }] : [],
);

function CategoryIcon({ category }: { category: PostCategory }) {
  const { Icon } = CATEGORY_ROWS[category];
  return <Icon className={iconStyle} />;
}

export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped on each open to remount Command and clear its state.
  const [openKey, setOpenKey] = useState(0);

  const close = () => dialogRef.current?.close();

  const hasCursor = useHasCursor();

  /** Gates `autoFocus`: `useHasCursor` settles after hydration, while the dialog is still closed. */
  const [isOpen, setIsOpen] = useState(false);

  const [search, setSearch] = useState("");

  /** Null for an ordinary search; "" is a bare `>`, so compare against null. */
  const commandLine = parseCommandLine(search);

  /** Resolved only for a name typed in full; see `data/palette-commands.ts`. */
  const command =
    commandLine === null ? null : resolvePaletteCommand(commandLine);

  const [pickingWidget, setPickingWidget] = useState(false);

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmIcon: ConfirmDialogProps["confirmIcon"];
    onConfirm: () => void;
  } | null>(null);

  const {
    isAdmin,
    isDark,
    handleNewWidget,
    handleUnpublish,
    isPublished,
    editCategory,
    drafts,
    projects,
    labPages,
    currentDraft,
    backTarget,
    handleBack,
    handleThemeToggle,
    handleShaderPlayground,
    isShaderPlayground,
    handleCalchemyPlayground,
    isCalchemyPlayground,
    handleIconsPlayground,
    isIconsPlayground,
    handleTestimonials,
    isTestimonials,
    editorKind,
    handleSaveChanges,
    handleDiscardAndExit,
    pendingExit,
    confirmExitSave,
    confirmExitDiscard,
    cancelExit,
    handleEditPage,
    canEditMetadata,
    handleEditMetadata,
    handleNewPost,
    handleOpenDraft,
    handleOpenProject,
    handleOpenLabPage,
    handlePublish,
    handleDiscardDraft,
  } = useCommandPalette(close, openKey);

  // Not ⌘[: Safari never hands that one over.
  const backShortcut = useShortcutLabel("/");
  const saveShortcut = useShortcutLabel("S");

  const noun = POST_CATEGORIES[editCategory].label;

  const editorTitle =
    editorKind === "shaderPreset"
      ? "This Preset"
      : editorKind === "grid"
        ? "This Page"
        : `This ${noun}`;

  const offersDestinations = editorKind === null;

  useEffect(() => {
    // Guarded: `showModal()` throws on an open dialog. Only the shortcut toggles.
    function open() {
      if (dialogRef.current?.open) return;
      dialogRef.current?.showModal();
      setIsOpen(true);
      // The field's text is ours, so the remount doesn't clear it.
      setSearch("");
      setOpenKey((k) => k + 1);
    }
    function handleKeyDown(e: KeyboardEvent) {
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
    // Answers a ⌘K the head script recorded during hydration.
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
        <Command
          key={openKey}
          loop
          // Command rows are already matched by name; cmdk would filter them against the `>`.
          shouldFilter={commandLine === null}
          className={css({ display: "contents" })}
        >
          <div className={inputRowStyle} data-command-input-row>
            <SearchIcon className={iconStyle} />
            <Command.Input
              autoFocus={isOpen && hasCursor}
              value={search}
              onValueChange={setSearch}
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

          <Command.List className={listStyle}>
            {/* Names are looked up, never evaluated, and nothing renders until one is typed in full, so commands stay hidden. */}
            {commandLine !== null ? (
              command && (
                <Command.Group className={groupStyle}>
                  <div className={groupHeadingStyle}>Command</div>
                  <Command.Item
                    className={itemStyle}
                    onSelect={() => {
                      // Closed first: these commands leave the page.
                      close();
                      void command.run();
                    }}
                  >
                    <ConsoleIcon className={iconStyle} />
                    {command.name}
                    {hasCursor && <kbd className={itemHotkeyStyle}>↵</kbd>}
                  </Command.Item>
                </Command.Group>
              )
            ) : (
              <>
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

                {isAdmin && (
                  <>
                    {editorKind ? (
                      <Command.Group className={groupStyle}>
                        <div className={groupHeadingStyle}>{editorTitle}</div>
                        {editorKind === "document" && (
                          <Command.Item
                            className={itemStyle}
                            onSelect={handlePublish}
                          >
                            <PublishIcon className={iconStyle} />
                            Publish {noun.toLowerCase()}
                          </Command.Item>
                        )}
                        {editorKind === "grid" && (
                          <Command.Item
                            className={itemStyle}
                            onSelect={() => {
                              setPickingWidget(true);
                              close();
                            }}
                          >
                            <ComponentIcon className={iconStyle} />
                            New widget…
                          </Command.Item>
                        )}
                        {canEditMetadata && (
                          <Command.Item
                            className={itemStyle}
                            onSelect={handleEditMetadata}
                          >
                            <MetadataIcon className={iconStyle} />
                            Edit metadata
                          </Command.Item>
                        )}
                        <Command.Item
                          className={itemStyle}
                          onSelect={() => void handleSaveChanges()}
                        >
                          <SaveIcon className={iconStyle} />
                          Save changes
                          {hasCursor && (
                            <kbd className={itemHotkeyStyle}>
                              {saveShortcut}
                            </kbd>
                          )}
                        </Command.Item>
                        <Command.Item
                          className={itemStyle}
                          onSelect={handleDiscardAndExit}
                        >
                          <TrashIcon className={iconStyle} />
                          Discard changes and exit
                        </Command.Item>
                        {editorKind === "document" && isPublished && (
                          <Command.Item
                            className={itemStyle}
                            onSelect={() => {
                              setConfirm({
                                title: `Unpublish ${noun}`,
                                message: `You are about to unpublish this ${noun.toLowerCase()}. Do you want to proceed?`,
                                confirmLabel: "Unpublish",
                                confirmIcon: UnpublishIcon,
                                onConfirm: () => void handleUnpublish(),
                              });
                              close();
                            }}
                          >
                            <UnpublishIcon className={iconStyle} />
                            Unpublish {noun.toLowerCase()}
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
                          {currentDraft && (
                            <Command.Item
                              className={itemStyle}
                              onSelect={() => {
                                setConfirm({
                                  title: "Delete Draft",
                                  message:
                                    "You are about to permanently delete this draft. Do you want to proceed?",
                                  confirmLabel: "Delete",
                                  confirmIcon: TrashIcon,
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

                        <Command.Group className={groupStyle}>
                          <div className={groupHeadingStyle}>Publish</div>
                          {NEW_POST_ROWS.map(({ category, Icon, label }) => (
                            <Command.Item
                              key={category}
                              className={itemStyle}
                              onSelect={() => handleNewPost(category)}
                            >
                              <Icon className={iconStyle} />
                              {label}
                            </Command.Item>
                          ))}
                        </Command.Group>

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
                                  <CategoryIcon category={draft.category} />
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

                {offersDestinations &&
                  projects.length + labPages.length > 0 && (
                    <Command.Group className={groupStyle}>
                      <div className={groupHeadingStyle}>Projects</div>
                      {projects.map((project) => (
                        <Command.Item
                          key={project.slug}
                          className={itemStyle}
                          onSelect={() => handleOpenProject(project)}
                        >
                          <WorkIcon className={iconStyle} />
                          {project.title ?? "Untitled"}
                        </Command.Item>
                      ))}
                      {labPages.map((page) => (
                        <Command.Item
                          key={page.path}
                          className={itemStyle}
                          onSelect={() => handleOpenLabPage(page)}
                        >
                          <WorkIcon className={iconStyle} />
                          {page.title}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                {isAdmin && offersDestinations && !isTestimonials && (
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>Inbox</div>
                    <Command.Item
                      className={itemStyle}
                      onSelect={handleTestimonials}
                    >
                      <QuoteIcon className={iconStyle} />
                      Testimonials
                    </Command.Item>
                  </Command.Group>
                )}

                {offersDestinations && (
                  <Command.Group className={groupStyle}>
                    <div className={groupHeadingStyle}>Playgrounds</div>
                    {!isShaderPlayground && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={handleShaderPlayground}
                      >
                        <ShaderIcon className={iconStyle} />
                        {SITE_PAGES.shader.title}
                      </Command.Item>
                    )}
                    {!isCalchemyPlayground && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={handleCalchemyPlayground}
                      >
                        <CalendarIcon className={iconStyle} />
                        {SITE_PAGES.calchemy.title}
                      </Command.Item>
                    )}
                    {!isIconsPlayground && (
                      <Command.Item
                        className={itemStyle}
                        onSelect={handleIconsPlayground}
                      >
                        <ComponentIcon className={iconStyle} />
                        {SITE_PAGES.icons.title}
                      </Command.Item>
                    )}
                  </Command.Group>
                )}

                <Command.Group className={groupStyle}>
                  <div className={groupHeadingStyle}>Settings</div>
                  <Command.Item
                    className={itemStyle}
                    onSelect={handleThemeToggle}
                  >
                    {isDark ? (
                      <LightIcon className={iconStyle} />
                    ) : (
                      <DarkIcon className={iconStyle} />
                    )}
                    {isDark ? OFFER.light : OFFER.dark}
                  </Command.Item>
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </Dialog>

      <ConfirmDialog
        open={pendingExit !== null}
        title="Unsaved Changes"
        message="You have unsaved changes to this preset. How do you want to proceed?"
        confirmLabel="Save changes and exit"
        confirmIcon={SaveIcon}
        onConfirm={() => void confirmExitSave()}
        alternate={{
          label: "Discard changes",
          icon: TrashIcon,
          onClick: confirmExitDiscard,
        }}
        onClose={cancelExit}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel ?? ""}
        confirmIcon={confirm?.confirmIcon ?? TrashIcon}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      {/* Grid only: a closed <dialog> still renders its contents, which would put the demo library in every page. */}
      {editorKind === "grid" && (
        <ComponentInsertDialog
          open={pickingWidget}
          onClose={() => setPickingWidget(false)}
          onInsert={(componentId) => {
            handleNewWidget(componentId);
            setPickingWidget(false);
          }}
        />
      )}
    </>
  );
}
