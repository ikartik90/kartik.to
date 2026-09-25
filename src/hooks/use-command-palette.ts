"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useThemeStore } from "@/store/theme";
import { useEditorStore } from "@/store/editor";
import { useMetadataPanelStore } from "@/store/metadata-panel";
import { saveGridLayout } from "@/app/actions/grid";
import { useGridDraftStore } from "@/store/grid-draft";
import {
  createDraft,
  saveDraft,
  publishPost,
  unpublishPost,
  deleteDraft,
  getDrafts,
  getPublishedProjects,
} from "@/app/actions/post";
import type { Post, PostCategory, PostLink } from "@/domain/post";
import {
  getEditUrl,
  getPostReadUrl,
  parsePostReadUrl,
} from "@/utils/post-urls";
import { getBackTarget, type BackTarget } from "@/utils/back-target";
import { isGridDraftDirty } from "@/utils/grid-draft";
import { pendingInsertFor } from "@/components/demo/registry";
import { hasShortcutModifier } from "@/utils/keyboard-shortcut";
import { openInNewTab } from "@/utils/open-in-new-tab";
import { notifyContentUpdated } from "@/utils/content-sync";
import { autosaveKey, clearAutosave } from "@/utils/editor-autosave";
import {
  createShaderPreset,
  saveShaderPreset,
} from "@/app/actions/shader-preset";
import {
  hasUnsavedShaderPresetWork,
  useShaderPresetDraftStore,
} from "@/store/shader-preset-draft";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { LAB_PAGES, type LabPage } from "@/data/lab-pages";

/** The open editor; one Save, Discard and unsaved-work check serve all three. */
export type EditorKind = "shaderPreset" | "grid" | "document" | null;

export interface CommandPaletteHandlers {
  isAdmin: boolean;
  isDark: boolean;
  isEditMode: boolean;
  isHomeEditMode: boolean;
  /** Adds a demo to the grid's draft, not live; the homepage's Save writes it. */
  handleNewWidget: (componentId: string) => void;
  handleUnpublish: () => Promise<void>;
  isPublished: boolean;
  editCategory: Post["category"];
  drafts: Post[];
  /** Published projects, minus the one being read. */
  projects: PostLink[];
  /** Lab prototypes, minus the one being read. */
  labPages: LabPage[];
  currentDraft: Post | null;
  backTarget: BackTarget | null;
  /** Leave for `backTarget` — asking first if that would lose unsaved work. */
  handleBack: () => void;
  editorKind: EditorKind;
  /** Commit whatever editor is open and STAY in it. ⌘S, everywhere. */
  handleSaveChanges: () => Promise<void>;
  handleDiscardAndExit: () => void;
  handleThemeToggle: () => void;
  handleShaderPlayground: () => void;
  isShaderPlayground: boolean;
  handleCalchemyPlayground: () => void;
  isCalchemyPlayground: boolean;
  handleIconsPlayground: () => void;
  isIconsPlayground: boolean;
  /** Admin only: the testimonials aren't cleared for display, and the page 404s for others. */
  handleTestimonials: () => void;
  isTestimonials: boolean;
  /** Where an exit blocked by unsaved work was headed, or null. */
  pendingExit: string | null;
  confirmExitSave: () => Promise<void>;
  confirmExitDiscard: () => void;
  cancelExit: () => void;

  handleEditPage: () => void;
  /** Only inside an editor: metadata changes are buffered and written by its Save. */
  canEditMetadata: boolean;
  handleEditMetadata: () => void;
  /** Starts a new post under `category`, in a new tab. */
  handleNewPost: (category: PostCategory) => void;
  handleOpenDraft: (draft: Post) => void;
  handleOpenProject: (project: PostLink) => void;
  handleOpenLabPage: (page: LabPage) => void;
  handlePublish: () => Promise<void>;
  handleDiscardDraft: () => Promise<void>;
}

export function useCommandPalette(
  close: () => void,
  openKey = 0,
): CommandPaletteHandlers {
  const isAdmin = useIsAdmin();

  // Hydration guard for `isDark`, which reads matchMedia.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const pathname = usePathname();
  const router = useRouter();

  const isEditMode =
    pathname === "/edit/new" ||
    (/^\/edit\/[^/]+$/.test(pathname) && pathname !== "/edit/testimonials");

  const isHomeEditMode = pathname === "/edit/home";

  const isShaderPlayground = /^\/playground\/shader(\/[^/]+)?$/.test(pathname);

  const isCalchemyPlayground = pathname === "/playground/calchemy";

  const isIconsPlayground = pathname === "/playground/icons";

  const isTestimonials = pathname === "/edit/testimonials";

  // Only an admin has a preset to save, so only for them is the shader playground an editor.
  const isShaderEditor = isShaderPlayground && isAdmin;

  // Most specific first: `/edit/home` also passes the edit-mode test but edits the grid.
  const editorKind: EditorKind = isShaderEditor
    ? "shaderPreset"
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

  const [drafts, setDrafts] = useState<Post[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      // Syncs to the external auth session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts([]);
      return;
    }
    let ignore = false;
    getDrafts()
      .then((data) => {
        if (!ignore) setDrafts(data);
      })
      .catch(() => {
        if (!ignore) setDrafts([]);
      });
    return () => {
      ignore = true;
    };
  }, [isAdmin, openKey]);

  // Fetched on mount and on every open; the palette survives client navigation.
  const [projects, setProjects] = useState<PostLink[]>([]);

  useEffect(() => {
    let ignore = false;
    getPublishedProjects()
      .then((data) => {
        if (!ignore) setProjects(data);
      })
      .catch(() => {
        if (!ignore) setProjects([]);
      });
    return () => {
      ignore = true;
    };
  }, [openKey]);

  const listableProjects = useMemo(
    () =>
      projects.filter(
        (project) => getPostReadUrl("WORK", project.slug) !== pathname,
      ),
    [projects, pathname],
  );

  const labPages = Object.values(LAB_PAGES).filter(
    (page) => page.path !== pathname,
  );

  // The unpublished post being read here, if any.
  const currentDraft = useMemo(() => {
    if (isEditMode) return null;
    const address = parsePostReadUrl(pathname);
    if (!address) return null;
    return (
      drafts.find(
        (d) => d.category === address.category && d.slug === address.slug,
      ) ?? null
    );
  }, [isEditMode, pathname, drafts]);

  const [pendingExit, setPendingExit] = useState<string | null>(null);

  /**
   * Admin only: a visitor has nowhere to save. Read through getState() at press time
   * so the palette doesn't re-render on every edit behind it.
   */
  const wouldLoseWork = () => {
    if (!isAdmin) return false;
    switch (editorKind) {
      // Any preset holding unsaved work, not just the one on screen.
      case "shaderPreset":
        return hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState());
      // The homepage has two drafts, grid and document; either can be dirty.
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

  const exitHref = (): string => {
    if (editorKind === "document") {
      // The post as last saved (the index if never saved), not the sidebar's unsaved address.
      const saved = useEditorStore.getState().savedAddress;
      if (saved) return getPostReadUrl(saved.category, saved.slug);
    }
    return "/";
  };

  /** "Exit editor" (to the saved post) while editing, else "Back to …". */
  const backTarget = useMemo<BackTarget | null>(() => {
    if (editorKind) return { href: exitHref(), label: "Exit editor" };
    const target = getBackTarget(pathname);
    return target && { href: target.href, label: `Back to ${target.label}` };
    // `exitHref` closes over the same route values this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKind, pathname, editCategory]);

  const handleBack = () => {
    if (!backTarget) return;
    // Read now, not off the memo: the editor records its saved address after this renders.
    const href = editorKind ? exitHref() : backTarget.href;
    if (wouldLoseWork()) {
      close();
      setPendingExit(href);
      return;
    }
    close();
    router.push(href);
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

  // ⌘/ goes up a level, through the same unsaved-work gate. Not ⌘[ (Safari's Back menu
  // takes it before the page does) nor ⌘I (italic in the editor).
  const handleBackRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!backTarget) return;
    function handleKeyDown(event: KeyboardEvent) {
      // Unshifted only: ⌘⇧/ is macOS's Help menu, reported as "?".
      if (!hasShortcutModifier(event) || event.key !== "/") return;
      event.preventDefault();
      handleBackRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backTarget]);

  // Guards reload, close and typed URLs; the App Router's Back never unloads, so isn't caught.
  // Read through a ref so the palette doesn't re-render on every keystroke.
  const wouldLoseWorkRef = useRef(wouldLoseWork);
  useEffect(() => {
    wouldLoseWorkRef.current = wouldLoseWork;
  });

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!wouldLoseWorkRef.current()) return;
      // Both spellings: preventDefault is standard, returnValue is for older browsers.
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const syncOtherTabs = () => {
    notifyContentUpdated();
  };

  const handleThemeToggle = () => {
    setMode(isDark ? "light" : "dark");
    close();
  };

  const handleShaderPlayground = () => {
    close();
    router.push("/playground/shader");
  };

  const handleCalchemyPlayground = () => {
    close();
    router.push("/playground/calchemy");
  };

  const handleIconsPlayground = () => {
    close();
    router.push("/playground/icons");
  };

  const handleTestimonials = () => {
    close();
    router.push("/edit/testimonials");
  };

  /**
   * Creates or updates by the draft's id (the URL can lag). Returns false on failure so
   * callers don't navigate away from unsaved work.
   */
  const persistShaderPreset = async (): Promise<boolean> => {
    const { shaderPresetId, title, shaderId, settings } =
      useShaderPresetDraftStore.getState();
    try {
      const saved = shaderPresetId
        ? await saveShaderPreset({ id: shaderPresetId, shaderId, settings })
        : await createShaderPreset({ title, shaderId, settings });
      // Commit what was stored (the schema normalises), which also clears dirty;
      // commit rather than load, so it isn't set aside as unsaved work.
      useShaderPresetDraftStore.getState().commit({
        id: saved.id,
        title: saved.title ?? null,
        shaderId: saved.shaderId,
        settings: saved.settings,
        publishedAt: saved.publishedAt,
      });
      // A new preset's id goes into the URL via history.replaceState (Next's shallow
      // routing): a router navigation would refetch and remount the shader for nothing.
      if (!shaderPresetId) {
        window.history.replaceState(null, "", `/playground/shader/${saved.id}`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save the preset:", err);
      return false;
    }
  };

  const handleEditPage = () => {
    const address = parsePostReadUrl(pathname);
    close();
    if (address) {
      router.push(getEditUrl(address.category, address.slug));
      return;
    }
    requestAnimationFrame(() => {
      const target =
        (document.querySelector("main") as HTMLElement | null) ?? document.body;

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

  // A real anchor navigation, not window.open, which can be pop-up blocked. See openInNewTab.
  const handleNewPost = (category: PostCategory) => {
    close();
    openInNewTab(getEditUrl(category));
  };

  const canEditMetadata =
    isAdmin && (editorKind === "document" || editorKind === "grid");

  const handleEditMetadata = () => {
    close();
    useMetadataPanelStore.getState().setOpen(true);
  };

  const handleOpenDraft = (draft: Post) => {
    close();
    router.push(getPostReadUrl(draft.category, draft.slug));
  };

  const handleOpenProject = (project: PostLink) => {
    close();
    router.push(getPostReadUrl("WORK", project.slug));
  };

  const handleOpenLabPage = (page: LabPage) => {
    close();
    router.push(page.path);
  };

  /**
   * The one place a document is written; save and publish both go through it. Returns the
   * saved row or null, and leaves navigating, snapshots and the dirty flag to callers.
   */
  const writing = useRef<Promise<Post | null> | null>(null);

  const writeDocument = (): Promise<Post | null> => {
    // One write at a time, or a second ⌘S would mint the post twice.
    writing.current ??= writeDocumentNow().finally(() => {
      writing.current = null;
    });
    return writing.current;
  };

  const writeDocumentNow = async (): Promise<Post | null> => {
    const { draftId, title, document, category, slug, description } =
      useEditorStore.getState();
    // Metadata goes in the same write, so an address and its page can't land apart.
    const metadata = {
      category,
      ...(slug !== null ? { slug } : {}),
      description,
    };
    try {
      const saved = draftId
        ? await saveDraft({
            id: draftId,
            title: title || undefined,
            document,
            ...metadata,
          })
        : await createDraft({
            title: title || undefined,
            document,
            ...metadata,
          });
      const store = useEditorStore.getState();
      if (!draftId) store.setDraftId(saved.id);
      // Set directly, not via setSlug: it's the saved value, not an edit.
      if (slug === null) useEditorStore.setState({ slug: saved.slug });
      store.setSavedAddress({ category: saved.category, slug: saved.slug });
      setDrafts((prev) =>
        draftId
          ? prev.map((d) => (d.id === saved.id ? saved : d))
          : [...prev, saved],
      );
      return saved;
    } catch (err) {
      console.error("Failed to save draft:", err);
      return null;
    }
  };

  /** Clears both autosave keys: minting a post changes the key from `new:<category>` to its id. */
  const dropAutosave = (keyBefore: string) => {
    clearAutosave(keyBefore);
    const after = useEditorStore.getState();
    clearAutosave(autosaveKey(after.draftId, after.category));
  };

  const handlePublish = async () => {
    const { draftId, category } = useEditorStore.getState();
    const keyBefore = autosaveKey(draftId, category);
    close();

    const saved = await writeDocument();
    // Write failed: keep the dirty buffer and snapshot, the only copies of the work.
    if (!saved) return;

    try {
      const published = await publishPost(saved.id);
      useEditorStore.getState().setDirty(false);
      dropAutosave(keyBefore);
      router.push(getPostReadUrl(published.category, published.slug));
      syncOtherTabs();
      setDrafts((prev) => prev.filter((d) => d.id !== saved.id));
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  /** Saves and stays in the editor. */
  const persistDocument = async (): Promise<boolean> => {
    const {
      draftId,
      category,
      savedAddress: before,
    } = useEditorStore.getState();
    const keyBefore = autosaveKey(draftId, category);

    const saved = await writeDocument();
    if (!saved) return false;

    // Follow the post to its new address, or a refresh would look where it no longer is.
    if (
      !before ||
      before.slug !== saved.slug ||
      before.category !== saved.category
    ) {
      router.replace(getEditUrl(saved.category, saved.slug));
    }
    // After the write, never before: the snapshot is the last copy of unwritten work.
    useEditorStore.getState().setDirty(false);
    dropAutosave(keyBefore);
    syncOtherTabs();
    return true;
  };

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
   * Saves the homepage's two drafts (document and grid) together, and stays. The page is
   * live, so this publishes.
   */
  const persistGrid = async (): Promise<boolean> => {
    const { draftId, title, document, category, description } =
      useEditorStore.getState();
    const { pins, spans, aspects, loggers, props, cards, inserts, removals } =
      useGridDraftStore.getState();
    try {
      if (draftId) {
        await saveDraft({
          id: draftId,
          title: title || undefined,
          document,
          description,
        });
      }
      await saveGridLayout({
        pins,
        spans,
        aspects,
        loggers,
        props,
        cards,
        inserts,
        removals,
      });
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

  /** Returns whether it landed, so a caller can decline to navigate after a failed write. */
  const persistEditor = async (): Promise<boolean> => {
    switch (editorKind) {
      case "shaderPreset":
        return persistShaderPreset();
      case "grid":
        return persistGrid();
      case "document":
        return persistDocument();
      default:
        return true;
    }
  };

  /** Drops the buffer and its autosave, which the editor would otherwise restore on next open. */
  const discardEditor = () => {
    const { draftId, category } = useEditorStore.getState();
    useMetadataPanelStore.getState().setOpen(false);
    switch (editorKind) {
      case "shaderPreset":
        useShaderPresetDraftStore.getState().reset();
        return;
      case "grid":
        clearAutosave(autosaveKey(draftId, category));
        useGridDraftStore.getState().reset();
        useEditorStore.getState().reset();
        return;
      case "document":
        clearAutosave(autosaveKey(draftId, category));
        useEditorStore.getState().reset();
        return;
    }
  };

  const handleSaveChanges = async () => {
    close();
    await persistEditor();
  };

  // Claim ⌘S, or the browser's Save Page answers. Only for an admin in an editor; visitors
  // keep the browser's behaviour.
  const handleSaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleSaveRef.current = () => void handleSaveChanges();
  });

  useEffect(() => {
    if (!isAdmin || editorKind === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      // Lowercase only: ⌘⇧S is a different gesture, reported as "S".
      if (!hasShortcutModifier(event) || event.key !== "s") return;
      event.preventDefault();
      handleSaveRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, editorKind]);

  /** No confirmation: choosing this is the answer. */
  const handleDiscardAndExit = () => {
    const href = exitHref();
    discardEditor();
    close();
    router.push(href);
  };

  const handleNewWidget = (componentId: string) => {
    useGridDraftStore.getState().addInsert(pendingInsertFor(componentId, null));
  };

  return {
    isAdmin,
    isDark,
    isEditMode,
    isHomeEditMode,
    handleNewWidget,
    handleUnpublish,
    isPublished,
    editCategory,
    drafts,
    projects: listableProjects,
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
  };
}
