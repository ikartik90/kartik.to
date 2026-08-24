"use client";

import { useEffect, useMemo, useState } from "react";
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
import { openInNewTab } from "@/utils/open-in-new-tab";
import { notifyContentUpdated } from "@/utils/content-sync";
import { autosaveKey, clearAutosave } from "@/utils/editor-autosave";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteHandlers {
  isAdmin: boolean;
  isDark: boolean;
  isEditMode: boolean;
  /** The grid's edit route, which needs its own palette group. */
  isHomeEditMode: boolean;
  /** Write the edited page and its layout, then return to `/`. */
  handlePublishHome: () => Promise<void>;
  /** Abandon both drafts and return to `/`. */
  handleDiscardHome: () => void;
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
  handleThemeToggle: () => void;
  /** Open the cover playground — public, so this is offered logged out too. */
  handleCoverPlayground: () => void;
  handleEditPage: () => void;
  handleNewBlogArticle: () => void;
  handleNewWorkArticle: () => void;
  handleOpenDraft: (draft: Post) => void;
  handlePublish: () => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  /** Revert unsaved edits to the last saved state and exit edit mode. */
  handleDiscardChanges: () => void;
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

  const handleSaveDraft = async () => {
    const { draftId, title, document, category } = useEditorStore.getState();
    close();
    clearAutosave(autosaveKey(draftId, category));
    try {
      if (!draftId) {
        const created = await createDraft({
          title: title || undefined,
          document,
          category,
        });
        router.replace(getPostReadUrl(created.category, created.slug));
        syncOtherTabs();
        setDrafts((prev) => [...prev, created]);
      } else {
        const updated = await saveDraft({
          id: draftId,
          title: title || undefined,
          document,
        });
        router.push(getPostReadUrl(updated.category, updated.slug));
        syncOtherTabs();
        setDrafts((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  // Edit mode: throw away unsaved edits and leave the editor. Nothing is
  // persisted, so the last saved version remains in the DB; navigating to the
  // read page (or home for an unsaved new draft) reveals that saved state.
  const handleDiscardChanges = () => {
    const slug = pathname.match(/^\/edit\/([^/?]+)/)?.[1];
    const { draftId, category } = useEditorStore.getState();
    close();
    clearAutosave(autosaveKey(draftId, category));
    useEditorStore.getState().reset();
    if (slug && slug !== "new") {
      router.push(getPostReadUrl(editCategory, slug));
    } else {
      router.push("/");
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
   * Commit the homepage and leave.
   *
   * TWO drafts, one press. The page is a document with a grid in it, and the
   * two are edited together but stored apart — the prose in the post's
   * `content`, the placements across the post and component tables. Saving
   * only one would publish half of what is on screen.
   *
   * Named for publishing rather than saving because the homepage is already
   * live: there is no draft state in between, so committing it IS publishing.
   */
  const handlePublishHome = async () => {
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
      useGridDraftStore.getState().reset();
      clearAutosave(autosaveKey(draftId, category));
      syncOtherTabs();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Failed to publish the homepage:", err);
    }
    close();
  };

  /**
   * Throw both drafts away and leave. Nothing was written by either — the
   * toolbar edits a layout draft rather than the database precisely so that
   * this can be a no-op.
   */
  const handleDiscardHome = () => {
    const { draftId, category } = useEditorStore.getState();
    useGridDraftStore.getState().reset();
    clearAutosave(autosaveKey(draftId, category));
    useEditorStore.getState().reset();
    close();
    router.push("/");
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
  };
}
