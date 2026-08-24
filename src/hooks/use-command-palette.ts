"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useThemeStore } from "@/store/theme";
import { useEditorStore } from "@/store/editor";
import { publishComponent, saveGridLayout } from "@/app/actions/grid";
import { useGridDraftStore } from "@/store/grid-draft";
import {
  createDraft,
  saveDraft,
  publishPost,
  unpublishPost,
  deleteDraft,
  getDrafts,
} from "@/app/actions/post";
import type { Post } from "@/domain/post";
import { getEditUrl, getPostReadUrl } from "@/utils/post-urls";
import { getBackTarget, type BackTarget } from "@/utils/back-target";
import { isGridDraftDirty } from "@/utils/grid-draft";
import { hasShortcutModifier } from "@/utils/keyboard-shortcut";
import { openInNewTab } from "@/utils/open-in-new-tab";
import { notifyContentUpdated } from "@/utils/content-sync";
import { autosaveKey, clearAutosave } from "@/utils/editor-autosave";
import { createCover, saveCover } from "@/app/actions/cover";
import { useCoverDraftStore } from "@/store/cover-draft";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The editors, as one idea.
 *
 * They differ in what they buffer and where they write it, and in nothing else
 * that the palette can see: each has unsaved work, a way to commit it, and a
 * way to throw it away. Naming that here is what lets one Save command, one
 * Discard command and one unsaved-work question serve all three, instead of
 * three near-copies that have to be kept saying the same thing.
 */
export type EditorKind = "cover" | "grid" | "document" | null;

export interface CommandPaletteHandlers {
  isAdmin: boolean;
  isDark: boolean;
  isEditMode: boolean;
  /** The grid's edit route, which needs its own palette group. */
  isHomeEditMode: boolean;
  /** Publish a registered demo to the grid, unpinned. */
  handlePublishComponent: (componentId: string) => Promise<void>;
  /** Clear `publishedAt` on the post being edited, leaving it as a draft. */
  handleUnpublish: () => Promise<void>;
  /** Whether the post being edited is live — gates Unpublish. */
  isPublished: boolean;
  editCategory: Post["category"];
  drafts: Post[];
  /** The draft currently being viewed in renderer mode, or null. */
  currentDraft: Post | null;
  /**
   * The way out of this page, or null at the index. `label` is the whole
   * command — "Back to index" when you are reading, "Exit editor" when you are
   * editing, because those are different acts and one wording cannot be honest
   * about both.
   */
  backTarget: BackTarget | null;
  /** Leave for `backTarget` — asking first if that would lose unsaved work. */
  handleBack: () => void;
  /**
   * Which editor is open, if any — and so which set of exits applies. Also
   * names the palette's group, since "This Cover" / "This Page" / "This
   * Article" are the same heading in three wordings.
   */
  editorKind: EditorKind;
  /** Commit whatever editor is open and STAY in it. ⌘S, everywhere. */
  handleSaveChanges: () => Promise<void>;
  /** Abandon whatever editor is open and leave. */
  handleDiscardAndExit: () => void;
  handleThemeToggle: () => void;
  /** Open the cover playground — public, so this is offered logged out too. */
  handleCoverPlayground: () => void;
  /** On the playground — which is an editor, so it has the same exits. */
  isCoverPlayground: boolean;
  /**
   * Where a blocked exit was headed, or null. Non-null means the author asked
   * to leave an editor with unsaved work in it and has been asked what to do.
   */
  pendingExit: string | null;
  /** Write the open editor, then complete the exit that was blocked. */
  confirmExitSave: () => Promise<void>;
  /** Abandon the work and complete the exit. */
  confirmExitDiscard: () => void;
  /** Stay, with the work intact. */
  cancelExit: () => void;

  handleEditPage: () => void;
  handleNewBlogArticle: () => void;
  handleNewWorkArticle: () => void;
  handleOpenDraft: (draft: Post) => void;
  handlePublish: () => Promise<void>;
  /** Permanently delete the draft currently being viewed. */
  handleDiscardDraft: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Owns all command palette business logic.
 * Accepts `close` as a parameter so the hook stays decoupled from the dialog
 * DOM ref, which belongs to the component that renders the <Dialog>.
 */
export function useCommandPalette(
  close: () => void,
  openKey = 0,
): CommandPaletteHandlers {
  const { data: session } = authClient.useSession();

  // The admin session lives client-side (localStorage), invisible to the server,
  // so the server always renders the logged-out tree. Gate every admin-only
  // affordance behind `mounted` so the first client render matches that server
  // HTML; the admin UI then appears one commit later. Without this guard the
  // extra admin nodes on the first client render diverge from the server markup
  // and React aborts hydration with error #418. (Same guard as `isDark` below.)
  const [mounted, setMounted] = useState(false);
  // Deliberate mount-flag flip: the one-commit-later render is the whole point
  // of the hydration guard described above (see error #418).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isAdmin = mounted && !!session?.user;

  const pathname = usePathname();
  const router = useRouter();

  const isEditMode =
    pathname === "/edit/new" || /^\/edit\/[^/]+$/.test(pathname);

  // The grid only exists on the homepage, so its controls are only offered
  // there. Every other page would be advertising a mode it cannot enter.
  const isHome = pathname === "/";
  // `/edit/home` matches the generic edit-mode test above, but it is editing a
  // GRID, not a document — no title, no draft, nothing buffered to save — so it
  // needs its own branch or it would be offered an article's exits.
  const isHomeEditMode = pathname === "/edit/home";

  // The playground, either freshly opened or reopened on a saved cover. Both,
  // because Save means "create" on one and "update" on the other but the group
  // offering it is the same group.
  const isCoverPlayground = /^\/playground\/cover(\/[^/]+)?$/.test(pathname);

  // Which editor is open. Ordered most-specific first: `/edit/home` also
  // satisfies the generic edit-mode test, and it edits a GRID rather than a
  // document.
  const editorKind: EditorKind = isCoverPlayground
    ? "cover"
    : isHomeEditMode
      ? "grid"
      : isEditMode
        ? "document"
        : null;

  const editCategory = useEditorStore((state) => state.category);
  const isPublished = useEditorStore((state) => state.isPublished);

  const { mode, setMode } = useThemeStore();

  const isDark =
    mounted &&
    (mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  // Drafts list — loaded when admin is logged in, refreshed on palette open
  const [drafts, setDrafts] = useState<Post[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      // Clear any cached drafts when the admin session goes away — this syncs
      // client state to the (external) auth session, not a render-derived value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts([]);
      return;
    }
    let ignore = false;
    getDrafts()
      .then((data) => { if (!ignore) setDrafts(data); })
      .catch(() => { if (!ignore) setDrafts([]); });
    return () => { ignore = true; };
  }, [isAdmin, openKey]);

  // The draft (unpublished post) currently being viewed in renderer mode, if
  // the pathname matches a known draft's read URL. null in edit mode or when
  // the viewed post is published.
  const currentDraft = useMemo(() => {
    if (isEditMode) return null;
    const articleSlug = pathname.match(/^\/writing\/([^/]+)$/)?.[1];
    if (articleSlug) {
      return (
        drafts.find(
          (d) => d.category === "ARTICLE" && d.slug === articleSlug,
        ) ?? null
      );
    }
    const workSlug = pathname.match(/^\/work\/([^/]+)$/)?.[1];
    if (workSlug) {
      return (
        drafts.find((d) => d.category === "WORK" && d.slug === workSlug) ?? null
      );
    }
    return null;
  }, [isEditMode, pathname, drafts]);

  // Where an exit was headed when it was stopped for unsaved work. One piece of
  // state rather than a boolean plus a destination: the question only exists
  // because somewhere was being gone to, and the two can never be out of step
  // if there is only one of them.
  const [pendingExit, setPendingExit] = useState<string | null>(null);

  /**
   * Whether leaving right now would lose something.
   *
   * Gated on `isAdmin` as well as on the buffer, because a visitor has nowhere
   * to save TO: their work is ephemeral by definition, and stopping them on the
   * way out would put a question in front of them whose best answer — "Save
   * changes and exit" — cannot be carried out.
   *
   * Read at press time through `getState()` rather than subscribed to, so the
   * palette does not re-render on every keystroke or slider move behind it.
   */
  const wouldLoseWork = () => {
    if (!isAdmin) return false;
    switch (editorKind) {
      case "cover":
        return useCoverDraftStore.getState().isDirty;
      // TWO drafts, one page — the homepage is a document with a grid in it and
      // either half can be the dirty one. See `persistGrid`.
      case "grid":
        return (
          isGridDraftDirty(useGridDraftStore.getState()) ||
          useEditorStore.getState().isDirty
        );
      case "document":
        return useEditorStore.getState().isDirty;
      default:
        return false;
    }
  };

  /** Where leaving the open editor puts you. */
  const exitHref = (): string => {
    if (editorKind === "document") {
      // The post as it stands SAVED — which for a draft never written is
      // nowhere, so the index.
      const slug = pathname.match(/^\/edit\/([^/?]+)/)?.[1];
      if (slug && slug !== "new") return getPostReadUrl(editCategory, slug);
    }
    return "/";
  };

  /**
   * The way out of this page, and what the command calls it.
   *
   * "Exit editor" while one is open, rather than "Back to …". They are
   * different acts: reading a post and going up to the index is navigation,
   * whereas leaving an editor is finishing with it, and the destination is the
   * post as it stands SAVED rather than an ancestor in the path. One wording
   * cannot be honest about both.
   *
   * Offered in edit mode at all, which it was not: the command used to be
   * withheld there so a bare "back" could not throw buffered work away
   * silently. Withholding it also removed "save and go", which is usually what
   * was meant — so it is offered, and it asks. See `wouldLoseWork`.
   */
  const backTarget = useMemo<BackTarget | null>(() => {
    if (editorKind) return { href: exitHref(), label: "Exit editor" };
    const target = getBackTarget(pathname);
    return target && { href: target.href, label: `Back to ${target.label}` };
    // `exitHref` closes over the same route values this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKind, pathname, editCategory]);

  const handleBack = () => {
    if (!backTarget) return;
    if (wouldLoseWork()) {
      // Asked, not withheld. The command used to be hidden while editing so a
      // bare "back" could not throw work away silently — but hiding it also
      // removes "save and go", which is usually what the author meant. The
      // question restores both answers.
      close();
      setPendingExit(backTarget.href);
      return;
    }
    close();
    router.push(backTarget.href);
  };

  const confirmExitSave = async () => {
    const href = pendingExit;
    setPendingExit(null);
    if (href && (await persistEditor())) router.push(href);
  };

  const confirmExitDiscard = () => {
    const href = pendingExit;
    setPendingExit(null);
    discardEditor();
    if (href) router.push(href);
  };

  const cancelExit = () => setPendingExit(null);

  useEffect(() => {
    handleBackRef.current = handleBack;
  });

  // ⌘[ / Ctrl [ — the same gesture the browser reads as "back", claimed so it
  // lands on the page above THIS page rather than on whatever was visited
  // before it. Global, because the control it replaces was on the page rather
  // than in the palette: it has to work without opening anything.
  // ⌘[ goes through the same gate as the command. A shortcut that skipped the
  // unsaved-work question would be a back door round it, and the faster route
  // is exactly the one an author takes without thinking.
  const handleBackRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!backTarget) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!hasShortcutModifier(event) || event.key !== "[") return;
      event.preventDefault();
      handleBackRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backTarget]);

  const syncOtherTabs = () => {
    notifyContentUpdated();
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleThemeToggle = () => {
    setMode(isDark ? "light" : "dark");
    close();
  };

  // Same tab, plain `push` — unlike the editors below, which open in a new one
  // because they are a place you go to WRITE and then come back from. The
  // playground is somewhere you go to look, and the way back is the index link
  // it already draws.
  const handleCoverPlayground = () => {
    close();
    router.push("/playground/cover");
  };

  /**
   * Write the cover being tuned. Shared by ⌘S and by the palette's two save
   * commands, which differ ONLY in where they leave you afterwards.
   *
   * Create or update is decided by whether the draft carries an id, not by the
   * route: the route is where you ARE, and after a create the two disagree for
   * exactly as long as it takes the URL to catch up. The store is what knows.
   *
   * Reads the draft through `getState()` rather than a subscription, the same
   * way `handlePublishHome` reads the grid's: this runs once, on a press, and
   * subscribing would re-render the palette on every slider move behind it.
   *
   * Returns whether it landed, so a caller that means to navigate afterwards
   * can decline to — leaving on a failed write would strand the work on a page
   * the author can no longer see.
   */
  const persistCover = async (): Promise<boolean> => {
    const { coverId, title, shaderId, settings } = useCoverDraftStore.getState();
    try {
      const saved = coverId
        ? await saveCover({ id: coverId, shaderId, settings })
        : await createCover({ title, shaderId, settings });
      // Adopt what was STORED rather than what was sent: the schema normalises
      // on the way in (six-digit colours padded, retired keys dropped), so this
      // is what makes the panel read the same as the row. It also clears the
      // dirty flag, which is what stops "Discard changes" offering to throw
      // away work that has just been written.
      useCoverDraftStore.getState().load({
        id: saved.id,
        title: saved.title ?? null,
        shaderId: saved.shaderId,
        settings: saved.settings,
      });
      // A cover that has just been created has an id the URL does not know
      // about yet, and a refresh would land back on the blank route having lost
      // it. `replace` rather than `push`: the blank route is where you WERE,
      // not a place to go back to.
      if (!coverId) {
        router.replace(`/playground/cover/${saved.id}`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save the cover:", err);
      return false;
    }
  };

  const handleEditPage = () => {
    // The homepage IS the grid, and it is edited the way everything else is:
    // by going to its edit route.
    if (isHome) {
      close();
      router.push("/edit/home");
      return;
    }
    const articleSlug = pathname.match(/^\/writing\/([^/]+)$/)?.[1];
    const workSlug = pathname.match(/^\/work\/([^/]+)$/)?.[1];
    close();
    if (articleSlug) {
      router.push(getEditUrl("ARTICLE", articleSlug));
      return;
    }
    if (workSlug) {
      router.push(getEditUrl("WORK", workSlug));
      return;
    }
    requestAnimationFrame(() => {
      const target =
        (document.querySelector("main") as HTMLElement | null) ??
        document.body;

      target.contentEditable = "true";
      target.focus();

      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent?.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });

      const firstText = walker.nextNode();
      if (firstText) {
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  };

  // Open the editor in a new tab via a real anchor navigation, not
  // `window.open` — the latter is silently pop-up-blocked in some browsers even
  // from a user gesture, so the command would appear to do nothing. See
  // openInNewTab.
  const handleNewBlogArticle = () => {
    close();
    openInNewTab(getEditUrl("ARTICLE"));
  };

  const handleNewWorkArticle = () => {
    close();
    openInNewTab(getEditUrl("WORK"));
  };

  const handleOpenDraft = (draft: Post) => {
    close();
    router.push(getPostReadUrl(draft.category, draft.slug));
  };

  const handlePublish = async () => {
    const { draftId, title, document, category } = useEditorStore.getState();
    close();
    // The in-progress work is about to be persisted server-side — drop the
    // local autosave so it can't later override the saved copy on refresh.
    clearAutosave(autosaveKey(draftId, category));
    try {
      let id = draftId;
      if (!id) {
        const created = await createDraft({
          title: title || undefined,
          document,
          category,
        });
        id = created.id;
        useEditorStore.getState().setDraftId(id);
      }
      const published = await publishPost(id);
      router.push(getPostReadUrl(published.category, published.slug));
      syncOtherTabs();
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  /**
   * Write the document being edited, and STAY in the editor.
   *
   * It used to navigate to the read page, which was the same "thrown out
   * mid-session" fault ⌘S had on the cover: saving is how you keep going, not
   * how you finish. Leaving is `Back to …` or Discard, both of which say so.
   *
   * A draft that has never been written has no id and no slug, so the URL is
   * still `/edit/new` after one is minted for it. `replace` rather than `push`,
   * for the reason a first-saved cover replaces: `/edit/new` is where you WERE,
   * not a place to go back to — and a refresh from it would start a second
   * empty draft rather than reopening this one.
   */
  const persistDocument = async (): Promise<boolean> => {
    const { draftId, title, document, category } = useEditorStore.getState();
    clearAutosave(autosaveKey(draftId, category));
    try {
      if (!draftId) {
        const created = await createDraft({
          title: title || undefined,
          document,
          category,
        });
        useEditorStore.getState().setDraftId(created.id);
        router.replace(getEditUrl(created.category, created.slug));
        setDrafts((prev) => [...prev, created]);
      } else {
        const updated = await saveDraft({
          id: draftId,
          title: title || undefined,
          document,
        });
        setDrafts((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
      // Clean again — which is what stops the unsaved-work question asking
      // about edits that have just been written.
      useEditorStore.getState().setDirty(false);
      syncOtherTabs();
      return true;
    } catch (err) {
      console.error("Failed to save draft:", err);
      return false;
    }
  };

  // Renderer mode: permanently delete the draft being viewed, then go home.
  const handleDiscardDraft = async () => {
    if (!currentDraft) return;
    const { id, category } = currentDraft;
    close();
    clearAutosave(autosaveKey(id, category));
    try {
      await deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      router.push("/");
      syncOtherTabs();
    } catch (err) {
      console.error("Failed to discard draft:", err);
    }
  };

  /**
   * Retire the post being edited. Distinct from discarding it: this leaves the
   * writing intact and merely stops serving it, which is why it is offered
   * beside Publish rather than beside the delete.
   */
  const handleUnpublish = async () => {
    const id = useEditorStore.getState().draftId;
    if (!id) return;
    try {
      await unpublishPost(id);
      syncOtherTabs();
      router.refresh();
    } catch (err) {
      console.error("Failed to unpublish:", err);
    }
    close();
  };

  /**
   * Publish a registered demo as a project of its own.
   *
   * Unpinned, unlike the grid's own [+], which places one at a seat you picked.
   * Arriving from the palette there is no seat in mind, so it takes whatever
   * chronology gives it.
   */
  /**
   * Commit the homepage, and STAY on it.
   *
   * TWO drafts, one press. The page is a document with a grid in it, and the
   * two are edited together but stored apart — the prose in the post's
   * `content`, the placements across the post and component tables. Saving only
   * one would publish half of what is on screen.
   *
   * The homepage is already live, so there is no draft state in between and
   * committing it IS publishing. The command still reads "Save changes",
   * because that is what it does and because an article that is already
   * published saves to a live page in exactly the same way — one wording for
   * one act.
   */
  const persistGrid = async (): Promise<boolean> => {
    const { draftId, title, document, category } = useEditorStore.getState();
    const { pins, spans, aspects, loggers, inserts, removals } =
      useGridDraftStore.getState();
    try {
      if (draftId) {
        await saveDraft({ id: draftId, title: title || undefined, document });
      }
      await saveGridLayout({
        pins,
        spans,
        aspects,
        loggers,
        inserts,
        removals,
      });
      // Both buffers are on disk now, so both have to read clean or the exit
      // question would ask about work that has just been written.
      useGridDraftStore.getState().reset();
      useEditorStore.getState().setDirty(false);
      clearAutosave(autosaveKey(draftId, category));
      syncOtherTabs();
      router.refresh();
      return true;
    } catch (err) {
      console.error("Failed to save the homepage:", err);
      return false;
    }
  };

  /**
   * Write the open editor, and return whether it landed.
   *
   * The boolean is what lets a caller that means to navigate afterwards decline
   * to: leaving on a failed write would strand the work on a page the author
   * can no longer see.
   */
  const persistEditor = async (): Promise<boolean> => {
    switch (editorKind) {
      case "cover":
        return persistCover();
      case "grid":
        return persistGrid();
      case "document":
        return persistDocument();
      default:
        return true;
    }
  };

  /** Drop the open editor's buffer. Nothing was written, so nothing is undone. */
  const discardEditor = () => {
    switch (editorKind) {
      case "cover":
        useCoverDraftStore.getState().reset();
        return;
      case "grid":
        useGridDraftStore.getState().reset();
        useEditorStore.getState().reset();
        return;
      case "document":
        useEditorStore.getState().reset();
        return;
    }
  };

  /** ⌘S, and the Save command beside it: commit, and carry on working. */
  const handleSaveChanges = async () => {
    close();
    await persistEditor();
  };

  /**
   * Abandon the open editor and go, without being asked to confirm it.
   *
   * No question, unlike the one Back raises: this command IS the answer to that
   * question, said up front, and asking again would be asking whether you meant
   * what you just chose. Nothing was written either — every editor here buffers
   * in a store and touches the database only on save — so there is no published
   * state for it to undo.
   */
  const handleDiscardAndExit = () => {
    const { draftId, category } = useEditorStore.getState();
    const href = exitHref();
    clearAutosave(autosaveKey(draftId, category));
    discardEditor();
    close();
    router.push(href);
  };

  const handlePublishComponent = async (componentId: string) => {
    try {
      await publishComponent({ componentId });
      router.refresh();
    } catch (err) {
      console.error("Failed to publish component:", err);
    }
  };

  return {
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
  };
}
