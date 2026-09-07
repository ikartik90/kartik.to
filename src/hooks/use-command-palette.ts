"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import {
  createShaderPreset,
  saveShaderPreset,
} from "@/app/actions/shader-preset";
import {
  hasUnsavedShaderPresetWork,
  useShaderPresetDraftStore,
} from "@/store/shader-preset-draft";
import { useIsAdmin } from "@/hooks/use-is-admin";

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
export type EditorKind = "shaderPreset" | "grid" | "document" | null;

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
   * names the palette's group, since "This Preset" / "This Page" / "This
   * Article" are the same heading in three wordings.
   */
  editorKind: EditorKind;
  /** Commit whatever editor is open and STAY in it. ⌘S, everywhere. */
  handleSaveChanges: () => Promise<void>;
  /** Abandon whatever editor is open and leave. */
  handleDiscardAndExit: () => void;
  handleThemeToggle: () => void;
  /** Open the shader playground — public, so this is offered logged out too. */
  handleShaderPlayground: () => void;
  /**
   * On the playground. Withholds ONE row — the one that would lead here — and
   * says nothing about whether an editor is open: that is `editorKind`, which
   * asks who is standing here as well as where.
   */
  isShaderPlayground: boolean;
  /** Open the calchemy playground — public on the same grounds as the shader one. */
  handleCalchemyPlayground: () => void;
  /** On it, and the same rule: its own row goes, the group stays. */
  isCalchemyPlayground: boolean;
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
  // Signed in, and the hydration guard that answer needs — see `useIsAdmin`.
  const isAdmin = useIsAdmin();

  // The same guard, for the theme. `isDark` reads `matchMedia`, which the
  // server cannot, so it has to hold its answer back for one render exactly as
  // the admin state does. Its own flag rather than the hook's, because what the
  // two are waiting for only looks like the same thing: one is waiting to be
  // allowed to differ from the server, the other for a browser API to exist.
  const [mounted, setMounted] = useState(false);
  // Deliberate mount-flag flip: the one-commit-later render is the whole point
  // of the hydration guard described above (see error #418).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

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

  // The playground, either freshly opened or reopened on a saved preset. Both,
  // because Save means "create" on one and "update" on the other but the group
  // offering it is the same group.
  const isShaderPlayground = /^\/playground\/shader(\/[^/]+)?$/.test(pathname);

  // The other playground, and a plainer case: it holds nothing unsaved, so
  // being on it is not being in an editor. It only takes its own row out of
  // the group — see `isCalchemyPlayground` at the call site.
  const isCalchemyPlayground = pathname === "/playground/calchemy";

  // ...which turns out to be the SHADER playground's case too, for whoever
  // cannot write to it.
  //
  // Being on it and editing a preset are two different facts, and the route
  // only ever established the first. A visitor can move every slider on the
  // page and still hold nothing that could be saved — there is no row of
  // theirs to write to, which is why `wouldLoseWork` already answers no for
  // them and why ⌘S is left to the browser. Calling it an editor anyway cost
  // them the two things this page is otherwise identical to Calchemy in
  // having: a way out named for what it does ("Back to index", not "Exit
  // editor" — there is nothing to finish with), and the sight of the other
  // playground while standing here.
  //
  // For the author it is an editor exactly as before, and the difference is
  // real rather than cosmetic: their exits decide what becomes of the buffer.
  const isShaderEditor = isShaderPlayground && isAdmin;

  // Which editor is open. Ordered most-specific first: `/edit/home` also
  // satisfies the generic edit-mode test, and it edits a GRID rather than a
  // document.
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
      // Every preset holding something, not just the one on screen. The strip
      // lets you move between presets freely and sets each draft aside as you
      // go, so "unsaved work" is no longer a fact about the open preset — and
      // an exit that only checked that one would drop the rest without asking.
      case "shaderPreset":
        return hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState());
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

  // ⌘/ — up a level: the page above THIS page, rather than whatever was
  // visited before it. Global, because the control it replaces was on the page
  // rather than in the palette: it has to work without opening anything. A
  // chord rather than a bare key so it fires wherever the cursor is, the
  // editor's prose included.
  //
  // It goes through the same gate as the command. A shortcut that skipped the
  // unsaved-work question would be a back door round it, and the faster route
  // is exactly the one an author takes without thinking.
  //
  // NOT ⌘[, which this began as: that is the key equivalent of Safari's
  // History ▸ Back menu item, and macOS runs menu key equivalents before the
  // event reaches web content, so the listener was never called there at all.
  // NOT ⌘I, which `article-editor` binds to italic. The editor's slash menu
  // does not contend — that opens on a TYPED `/` at the start of a block, and
  // a chord inserts no character.
  const handleBackRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!backTarget) return;
    function handleKeyDown(event: KeyboardEvent) {
      // Unshifted only: ⌘⇧/ is ⌘?, which macOS gives to the Help menu, and
      // browsers report the shifted key as "?".
      if (!hasShortcutModifier(event) || event.key !== "/") return;
      event.preventDefault();
      handleBackRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backTarget]);

  // Leaving the document entirely — a reload, a closed tab, a typed URL.
  //
  // The palette's own exits all ask before dropping buffered work, and ⌘/ goes
  // through the same gate. None of those is the only way out: every editor
  // here buffers in a store rather than the database, and an unload takes the
  // store with it. `beforeunload` is the only word the page gets in first.
  //
  // It does NOT catch the browser's Back. The App Router answers Back from
  // `popstate` and re-renders in place, so the document never unloads and this
  // never fires — the swipe, the toolbar button and ⌘← still leave without
  // asking. Closing that needs a history trap, which is a different thing than
  // this and has not been built.
  //
  // The predicate is read at fire time through a ref, not subscribed to, for
  // the same reason `wouldLoseWork` itself is: the palette has no business
  // re-rendering on every keystroke behind it.
  const wouldLoseWorkRef = useRef(wouldLoseWork);
  useEffect(() => {
    wouldLoseWorkRef.current = wouldLoseWork;
  });

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!wouldLoseWorkRef.current()) return;
      // Both spellings: `preventDefault` is the standard one, `returnValue` is
      // what older browsers read. The string is never shown — browsers have
      // used their own wording for years, precisely so a page cannot dress the
      // dialog up as something else.
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
  const handleShaderPlayground = () => {
    close();
    router.push("/playground/shader");
  };

  const handleCalchemyPlayground = () => {
    close();
    router.push("/playground/calchemy");
  };

  /**
   * Write the preset being tuned. Shared by ⌘S and by the palette's two save
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
  const persistShaderPreset = async (): Promise<boolean> => {
    const { shaderPresetId, title, shaderId, settings } =
      useShaderPresetDraftStore.getState();
    try {
      const saved = shaderPresetId
        ? await saveShaderPreset({ id: shaderPresetId, shaderId, settings })
        : await createShaderPreset({ title, shaderId, settings });
      // Adopt what was STORED rather than what was sent: the schema normalises
      // on the way in (six-digit colours padded, retired keys dropped), so this
      // is what makes the panel read the same as the row. It also clears the
      // dirty flag, which is what stops "Discard changes" offering to throw
      // away work that has just been written.
      // COMMIT rather than load: the draft on screen has just been written, so
      // it must not be set aside as unsaved work — see the store.
      useShaderPresetDraftStore.getState().commit({
        id: saved.id,
        title: saved.title ?? null,
        shaderId: saved.shaderId,
        settings: saved.settings,
        // Whether the row is on show, carried back with it. A save never
        // changes it — `saveShaderPreset` does not touch the column — but
        // reading it off what was stored is what keeps the panel's publish
        // button answering to the database rather than to a copy of it.
        publishedAt: saved.publishedAt,
      });
      // A preset that has just been created has an id the URL does not know
      // about yet, and a refresh would land back on the blank route having lost
      // it. `replace` rather than push: the blank route is where you WERE, not
      // a place to go back to.
      //
      // The native History API rather than the router, which is Next's own
      // supported shallow route (16.x docs, "Shallow routing on the client").
      // A router navigation here asks the server for a page whose whole job is
      // to fetch the preset and hand it down — the preset this draft is already
      // holding — and the playground remounts around the identical answer: the
      // shader torn down and recompiled, the panel rebuilt. Nothing needs
      // fetching; only the address bar was out of date.
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

  /**
   * Put the document being edited into its row, minting the row if it has none.
   *
   * The ONE place a document is written, because it has two callers that must
   * not differ about it. Saving writes the buffer and stays; publishing writes
   * the buffer and then throws the switch — and publishing used to do only the
   * second half. `handlePublish` wrote the document on the branch that MINTED
   * the post and nowhere else, so re-publishing an existing article flipped
   * `publishedAt` over whatever content the last save had left behind, and
   * every edit made since stayed in the buffer. The editor was correct and the
   * live page was stale, with nothing anywhere to say so.
   *
   * Returns the post as the row now holds it, or `null` when the write failed.
   * The caller needs the ROW rather than a boolean: publishing wants the id it
   * is about to flip and the slug it is about to navigate to, and reading those
   * off the store instead would be reading them from the copy that may not have
   * landed.
   *
   * Deliberately does NOT navigate, clear the local snapshot or mark the buffer
   * clean. Those are three different answers to "what happens next", and the
   * two callers give different ones — see each.
   */
  const writeDocument = async (): Promise<Post | null> => {
    const { draftId, title, document, category } = useEditorStore.getState();
    try {
      if (!draftId) {
        const created = await createDraft({
          title: title || undefined,
          document,
          category,
        });
        useEditorStore.getState().setDraftId(created.id);
        setDrafts((prev) => [...prev, created]);
        return created;
      }
      const updated = await saveDraft({
        id: draftId,
        title: title || undefined,
        document,
      });
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      return updated;
    } catch (err) {
      console.error("Failed to save draft:", err);
      return null;
    }
  };

  /**
   * The local snapshot for the session as it stands NOW.
   *
   * Read after the write rather than before it, because minting a post changes
   * the key: a brand-new draft autosaves under `new:<category>` and takes an id
   * only once the row exists. Both are dropped, so the pre-mint entry cannot
   * come back and restore a document the row has already superseded.
   */
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
    // Nothing was written, so there is nothing to publish and nowhere to go.
    // The buffer stays dirty and the local snapshot stays put: they are now the
    // only copies of the work, and the old order — clear the snapshot first,
    // then navigate to the read page regardless — destroyed one and walked away
    // from the other.
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

  /**
   * Write the document being edited, and STAY in the editor.
   *
   * It used to navigate to the read page, which was the same "thrown out
   * mid-session" fault ⌘S had on the preset: saving is how you keep going, not
   * how you finish. Leaving is `Back to …` or Discard, both of which say so.
   *
   * A draft that has never been written has no id and no slug, so the URL is
   * still `/edit/new` after one is minted for it. `replace` rather than `push`,
   * for the reason a first-saved preset replaces: `/edit/new` is where you
   * WERE, not a place to go back to — and a refresh from it would start a
   * second empty draft rather than reopening this one.
   */
  const persistDocument = async (): Promise<boolean> => {
    const { draftId, category } = useEditorStore.getState();
    const keyBefore = autosaveKey(draftId, category);

    const saved = await writeDocument();
    if (!saved) return false;

    if (!draftId) router.replace(getEditUrl(saved.category, saved.slug));
    // Clean again — which is what stops the unsaved-work question asking
    // about edits that have just been written. After the write, never before:
    // the snapshot is the last copy of anything the server has not taken.
    useEditorStore.getState().setDirty(false);
    dropAutosave(keyBefore);
    syncOtherTabs();
    return true;
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
    const { pins, spans, aspects, loggers, props, cards, inserts, removals } =
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
        props,
        cards,
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

  /** Drop the open editor's buffer. Nothing was written, so nothing is undone. */
  const discardEditor = () => {
    switch (editorKind) {
      case "shaderPreset":
        useShaderPresetDraftStore.getState().reset();
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

  // ⌘S / Ctrl S — the key the palette's Save row has been advertising with a
  // chip beside it. It has to be CLAIMED, or the browser answers first with
  // Save Page, which is never what someone means inside an editor: the row
  // said "this is what the key does" while the key opened a download dialog,
  // which is exactly the label-that-lies failure `keyboard-shortcut.ts` exists
  // to prevent.
  //
  // Bound on the same terms as the row it belongs to — only while an editor is
  // open, and only for someone who can actually write. A visitor pressing it in
  // the public playground keeps the browser's own behaviour, because taking the
  // key away and then doing nothing with it is worse than not taking it.
  const handleSaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleSaveRef.current = () => void handleSaveChanges();
  });

  useEffect(() => {
    if (!isAdmin || editorKind === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      // Lowercase only: ⌘⇧S is a different gesture, and browsers report the
      // shifted key as "S".
      if (!hasShortcutModifier(event) || event.key !== "s") return;
      event.preventDefault();
      handleSaveRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin, editorKind]);

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
    handleShaderPlayground,
    isShaderPlayground,
    handleCalchemyPlayground,
    isCalchemyPlayground,
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
