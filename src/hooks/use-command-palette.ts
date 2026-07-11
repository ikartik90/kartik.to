"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useThemeStore } from "@/store/theme";
import { useEditorStore } from "@/store/editor";
import {
  createDraft,
  saveDraft,
  publishPost,
  deleteDraft,
  getDrafts,
} from "@/app/actions/post";
import type { Post } from "@/domain/post";
import { getEditUrl, getPostReadUrl } from "@/utils/post-urls";
import { notifyContentUpdated } from "@/utils/content-sync";
import { autosaveKey, clearAutosave } from "@/utils/editor-autosave";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteHandlers {
  isAdmin: boolean;
  isDark: boolean;
  isEditMode: boolean;
  editCategory: Post["category"];
  drafts: Post[];
  /** The draft currently being viewed in renderer mode, or null. */
  currentDraft: Post | null;
  handleThemeToggle: () => void;
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
  const isAdmin = !!session?.user;

  const pathname = usePathname();
  const router = useRouter();

  const isEditMode =
    pathname === "/edit/new" || /^\/edit\/[^/]+$/.test(pathname);

  const editCategory = useEditorStore((state) => state.category);

  const { mode, setMode } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark =
    mounted &&
    (mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  // Drafts list — loaded when admin is logged in, refreshed on palette open
  const [drafts, setDrafts] = useState<Post[]>([]);

  useEffect(() => {
    if (!isAdmin) {
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

  const handleEditPage = () => {
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

  const handleNewBlogArticle = () => {
    close();
    window.open(getEditUrl("ARTICLE"), "_blank");
  };

  const handleNewWorkArticle = () => {
    close();
    window.open(getEditUrl("WORK"), "_blank");
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

  return {
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
  };
}
