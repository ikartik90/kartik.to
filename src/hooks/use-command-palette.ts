"use client";

import { useEffect, useState } from "react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteHandlers {
  isAdmin: boolean;
  isDark: boolean;
  isEditMode: boolean;
  drafts: Post[];
  handleThemeToggle: () => void;
  handleEditPage: () => void;
  handleNewBlogArticle: () => void;
  handlePublish: () => Promise<void>;
  handleSaveDraft: () => Promise<void>;
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
export function useCommandPalette(close: () => void): CommandPaletteHandlers {
  const { data: session } = authClient.useSession();
  const isAdmin = !!session?.user;

  const pathname = usePathname();
  const router = useRouter();

  // Edit mode: any writing/new or writing/*/edit route
  const isEditMode =
    pathname === "/writing/new" || /^\/writing\/[^/]+\/edit$/.test(pathname);

  const { mode, setMode } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark =
    mounted &&
    (mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  // Drafts list — loaded when admin is logged in, refreshed on every close
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
  }, [isAdmin]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleThemeToggle = () => {
    setMode(isDark ? "light" : "dark");
    close();
  };

  const handleEditPage = () => {
    close();
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
    window.open("/writing/new", "_blank");
  };

  const handlePublish = async () => {
    const { draftId, title, document } = useEditorStore.getState();
    close();
    try {
      let id = draftId;
      if (!id) {
        // Auto-save first if this is a new unsaved article
        const created = await createDraft({ title: title || undefined, document });
        id = created.id;
        useEditorStore.getState().setDraftId(id);
      }
      const published = await publishPost(id);
      useEditorStore.getState().reset();
      router.push(`/writing/${published.slug}`);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  const handleSaveDraft = async () => {
    const { draftId, title, document } = useEditorStore.getState();
    close();
    try {
      if (!draftId) {
        const created = await createDraft({ title: title || undefined, document });
        useEditorStore.getState().setDraftId(created.id);
        useEditorStore.getState().setDirty(false);
        router.replace(`/writing/${created.slug}/edit`);
        setDrafts((prev) => [...prev, created]);
      } else {
        const updated = await saveDraft({
          id: draftId,
          title: title || undefined,
          document,
        });
        useEditorStore.getState().setDirty(false);
        setDrafts((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  };

  const handleDiscardDraft = async () => {
    const { draftId } = useEditorStore.getState();
    close();
    try {
      if (draftId) {
        await deleteDraft(draftId);
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      }
      useEditorStore.getState().reset();
      router.push("/");
    } catch (err) {
      console.error("Failed to discard draft:", err);
    }
  };

  return {
    isAdmin,
    isDark,
    isEditMode,
    drafts,
    handleThemeToggle,
    handleEditPage,
    handleNewBlogArticle,
    handlePublish,
    handleSaveDraft,
    handleDiscardDraft,
  };
}
