// @vitest-environment jsdom
import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { useCommandPalette } from "../use-command-palette";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { useEditorStore } from "@/store/editor";
import { useGridDraftStore } from "@/store/grid-draft";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

const mockSetMode = vi.fn();
vi.mock("@/store/theme", () => ({
  useThemeStore: () => ({ mode: "light", setMode: mockSetMode }),
}));

const mockPathname = vi.fn<() => string>().mockReturnValue("/");
const mockPush = vi.fn<() => void>();
const mockReplace = vi.fn<() => void>();
const mockRefresh = vi.fn<() => void>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}));

const mockNotifyContentUpdated = vi.fn();
vi.mock("@/utils/content-sync", () => ({
  notifyContentUpdated: () => mockNotifyContentUpdated(),
}));

const mockOpenInNewTab = vi.fn<(url: string) => void>();
vi.mock("@/utils/open-in-new-tab", () => ({
  openInNewTab: (url: string) => mockOpenInNewTab(url),
}));

// Every action module is stubbed, not just for isolation: they are
// `"use server"` files that import `@/lib/env`, which validates DATABASE_URL and
// friends at import time and throws in a test run that has no `.env`.
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  getShaderPreset: vi.fn(),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
}));

vi.mock("@/app/actions/grid", () => ({
  saveGridLayout: vi.fn().mockResolvedValue(undefined),
  publishComponent: vi.fn().mockResolvedValue("component-id"),
  setPinned: vi.fn(),
  moveGridItem: vi.fn(),
  unpublishComponent: vi.fn(),
}));

vi.mock("@/app/actions/post", () => ({
  getDrafts: vi.fn().mockResolvedValue([]),
  createDraft: vi.fn().mockResolvedValue({
    id: "new-id",
    slug: "my-draft",
    title: "My Draft",
    category: "ARTICLE",
    content: { type: "doc", content: [] },
    publishedAt: null,
    untitledIndex: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  saveDraft: vi.fn().mockResolvedValue({
    id: "existing-id",
    slug: "existing-draft",
    title: "Existing",
    category: "ARTICLE",
    content: { type: "doc", content: [] },
    publishedAt: null,
    untitledIndex: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  publishPost: vi.fn().mockResolvedValue({
    id: "existing-id",
    slug: "my-article",
    title: "My Article",
    category: "ARTICLE",
    content: { type: "doc", content: [] },
    publishedAt: new Date(),
    untitledIndex: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCommandPalette", () => {
  let close: Mock<() => void>;

  beforeEach(() => {
    close = vi.fn<() => void>();
    mockSetMode.mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockRefresh.mockClear();
    mockNotifyContentUpdated.mockClear();
    mockOpenInNewTab.mockClear();
    mockPathname.mockReturnValue("/");
    mockUseSession.mockReturnValue({ data: null });

    // jsdom does not implement matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // isAdmin
  // -------------------------------------------------------------------------

  describe("isAdmin", () => {
    it("is false when there is no session", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isAdmin).toBe(false);
    });

    it("is true when session has a user", () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isAdmin).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isEditMode
  // -------------------------------------------------------------------------

  describe("isEditMode", () => {
    it("is false on the home route", () => {
      mockPathname.mockReturnValue("/");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isEditMode).toBe(false);
    });

    it("is true on /edit/new", () => {
      mockPathname.mockReturnValue("/edit/new");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isEditMode).toBe(true);
    });

    it("is true on /edit/my-slug", () => {
      mockPathname.mockReturnValue("/edit/my-slug");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isEditMode).toBe(true);
    });

    it("is false on a plain article route", () => {
      mockPathname.mockReturnValue("/writing/my-slug");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isEditMode).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // The shader playground
  // -------------------------------------------------------------------------

  describe("isShaderPlayground", () => {
    it("is true on the bare playground route", () => {
      mockPathname.mockReturnValue("/playground/shader");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isShaderPlayground).toBe(true);
    });

    it("is true on a saved preset's route", () => {
      mockPathname.mockReturnValue("/playground/shader/abc123");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isShaderPlayground).toBe(true);
    });

    it("is false elsewhere", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isShaderPlayground).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // ⌘S
  //
  // The palette's Save row carries a ⌘S chip. For a while nothing listened for
  // the key, so the browser answered it with Save Page — a chip advertising a
  // shortcut that opened a download dialog.
  // ---------------------------------------------------------------------------
  describe("the save shortcut", () => {
    // The gesture is ⌘S on Apple hardware and Ctrl S everywhere else, so a test
    // that presses it has to say which keyboard it is pressing it on — the
    // listener refuses the other platform's modifier deliberately (see
    // `keyboard-shortcut.ts`).
    const stubApple = () =>
      Object.defineProperty(navigator, "userAgentData", {
        value: { platform: "macOS" },
        configurable: true,
      });

    // This file does not unmount between tests, and a hook that stays mounted
    // keeps its window listener — so without this the first press is answered
    // by every render that came before it as well.
    afterEach(() => {
      cleanup();
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    });

    const pressSave = () => {
      const event = new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      return event;
    };

    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/shader");
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });
      mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
      stubApple();
    });

    it("saves the open editor, and takes the key off the browser", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      await act(async () => {
        event = pressSave();
      });

      expect(createShaderPreset).toHaveBeenCalledOnce();
      // Unclaimed, this is the browser's Save Page dialog.
      expect(event.defaultPrevented).toBe(true);
    });

    // Claiming a key and then doing nothing with it is worse than leaving it
    // alone: the browser's own behaviour is at least a behaviour.
    it("leaves the key alone away from an editor", async () => {
      mockPathname.mockReturnValue("/");
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      await act(async () => {
        event = pressSave();
      });

      expect(createShaderPreset).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("leaves the key alone for a visitor, who has nothing to save to", async () => {
      mockUseSession.mockReturnValue({ data: null });
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      await act(async () => {
        event = pressSave();
      });

      expect(createShaderPreset).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // ⌘⇧S is a different gesture, and the browser reports the shifted key as
    // an uppercase "S".
    it("does not answer the shifted key", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      renderHook(() => useCommandPalette(close));

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "S",
            metaKey: true,
            shiftKey: true,
            cancelable: true,
          }),
        );
      });

      expect(createShaderPreset).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // ⌘J
  //
  // This was ⌘[ — the gesture the browser itself reads as "back", claimed so it
  // would land on the page above THIS one. Safari never allowed that: ⌘[ is the
  // key equivalent of its History ▸ Back menu item, and macOS runs menu key
  // equivalents before the event reaches the page at all, so the listener was
  // never called and the chip advertised a shortcut that could not fire.
  // ---------------------------------------------------------------------------
  describe("the back shortcut", () => {
    const stubApple = () =>
      Object.defineProperty(navigator, "userAgentData", {
        value: { platform: "macOS" },
        configurable: true,
      });

    afterEach(() => {
      cleanup();
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    });

    const press = (key: string, extra: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", {
        key,
        metaKey: true,
        cancelable: true,
        ...extra,
      });
      window.dispatchEvent(event);
      return event;
    };

    beforeEach(() => {
      // An ancestor exists here, and it is the index — so a press has somewhere
      // to go, and `mockPush` says where.
      mockPathname.mockReturnValue("/writing/my-post");
      stubApple();
    });

    it("goes up a level, and takes the key off the browser", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("j");
      });

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(event.defaultPrevented).toBe(true);
    });

    // The old binding, left to the browser deliberately: in Safari it is Back
    // and the page cannot have it, and everywhere else Back is still a sane
    // answer to it. Claiming it in one browser and not another is worse than
    // claiming it nowhere.
    it("leaves ⌘[ alone", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("[");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // ⌘⇧J is a different gesture, and browsers report the shifted key as "J".
    it("does not answer the shifted key", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("J", { shiftKey: true });
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // Claiming a key and then doing nothing with it is worse than leaving it
    // alone — the same rule ⌘S follows off an editor.
    it("leaves the key alone at the index, which has nothing behind it", () => {
      mockPathname.mockReturnValue("/");
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("j");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // -----------------------------------------------------------------------
    // The bare `<`
    //
    // A chevron, typed without a modifier, the way Google Photos takes ⇧D and
    // GitHub takes `t`. It reads as the thing it does, which no ⌘-chord here
    // manages — and it costs the character `<` everywhere the visitor is not
    // typing, which is the whole of a page being read.
    // -----------------------------------------------------------------------
    const pressBare = (target: EventTarget) => {
      const event = new KeyboardEvent("keydown", {
        key: "<",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };

    it("goes up a level on a bare `<`", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = pressBare(document.body);
      });

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(event.defaultPrevented).toBe(true);
    });

    // In a field `<` is a character somebody meant to type, and a shortcut that
    // ate it would be unusable — the palette's own search box included.
    it("leaves `<` to a field being typed into", () => {
      const input = document.createElement("input");
      document.body.append(input);
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = pressBare(input);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      input.remove();
    });

    // The article editor is contenteditable rather than a field, and it is the
    // surface most likely to be typing a bracket in earnest.
    it("leaves `<` to a contenteditable", () => {
      const editable = document.createElement("div");
      Object.defineProperty(editable, "isContentEditable", { value: true });
      document.body.append(editable);
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = pressBare(editable);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      editable.remove();
    });

    // ⌘< is a different gesture, and not this one. A bare-key shortcut that
    // fired with a chord modifier down would answer for chords it was never
    // given — ⌘< among them, which is the browser's to define.
    it("does not answer `<` with a chord modifier held", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = (() => {
          const e = new KeyboardEvent("keydown", {
            key: "<",
            shiftKey: true,
            metaKey: true,
            bubbles: true,
            cancelable: true,
          });
          document.body.dispatchEvent(e);
          return e;
        })();
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("leaves the bare key alone at the index, which has nothing behind it", () => {
      mockPathname.mockReturnValue("/");
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = pressBare(document.body);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // The platform's own modifier only: Ctrl J on a Mac is not this gesture.
    it("refuses the other platform's modifier", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("j", { metaKey: false, ctrlKey: true });
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Leaving the document entirely
  //
  // The palette's own exits all ask before dropping buffered work, but they are
  // not the only way out: a reload, a closed tab, a typed URL. Those unload the
  // document, and every editor here buffers in a store — so without a word from
  // `beforeunload` the work goes with it, unasked.
  // ---------------------------------------------------------------------------
  describe("the unload guard", () => {
    const fireUnload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };

    afterEach(() => {
      cleanup();
      useEditorStore.getState().reset();
      useShaderPresetDraftStore.getState().reset();
    });

    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      useEditorStore.getState().reset();
      mockPathname.mockReturnValue("/edit/existing-draft");
    });

    it("stops an unload that would drop a dirty document", () => {
      useEditorStore.setState({ isDirty: true });
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(true);
    });

    // The dialog is the browser's, unstyled and unskippable, so it has to earn
    // its place: raised over a saved document it is pure obstruction.
    it("lets a clean document go", () => {
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(false);
    });

    it("lets an unload go where there is no editor open", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      useEditorStore.setState({ isDirty: true });
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(false);
    });

    // The same reasoning `wouldLoseWork` gives: a visitor has nowhere to save
    // to, so stopping them asks a question whose best answer cannot be carried
    // out. Their buffer is ephemeral by definition.
    it("lets a visitor go, having nowhere to save to", () => {
      mockUseSession.mockReturnValue({ data: null });
      useEditorStore.setState({ isDirty: true });
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(false);
    });

    // Every preset holding something, not just the one on screen — the strip
    // sets each draft aside as you move between them.
    it("stops an unload that would drop tuned presets", () => {
      mockPathname.mockReturnValue("/playground/shader");
      useShaderPresetDraftStore.setState({ isDirty: true });
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(true);
    });
  });

  describe("handleSaveChanges — the preset", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/shader");
      window.history.replaceState(null, "", "/playground/shader");
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.saveShaderPreset as Mock).mockReset();
    });

    // Create or update is decided by the DRAFT, not the route — after a create
    // the two disagree until the navigation lands, and the store is what knows.
    it("creates when the draft has never been saved", async () => {
      const { createShaderPreset, saveShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(createShaderPreset).toHaveBeenCalledOnce();
      expect(saveShaderPreset).not.toHaveBeenCalled();
      // The saved row's id comes back into the draft, so a second ⌘S updates
      // the preset just written rather than creating a duplicate of it.
      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe(
        "preset-1",
      );
    });

    it("updates the preset the draft was opened on", async () => {
      const { createShaderPreset, saveShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().load({
        id: "preset-9",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
        publishedAt: null,
      });
      (saveShaderPreset as Mock).mockResolvedValue({
        id: "preset-9",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(saveShaderPreset).toHaveBeenCalledWith(
        expect.objectContaining({ id: "preset-9" }),
      );
      expect(createShaderPreset).not.toHaveBeenCalled();
    });

    // A failed write must not look like a successful one. The palette closes
    // either way (the press was received), but the draft keeps its work and the
    // page does not navigate away from it.
    // ⌘S is a SAVE, not an exit. The whole point of the shortcut is to keep
    // working, so the one thing it must never do is navigate.
    it("stays on the page", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockPush).not.toHaveBeenCalled();
    });

    // Saving a never-saved preset gives it an id, and the URL has to catch up or
    // a refresh would land back on the blank route and lose the connection.
    // `replace`, not `push`: the blank route is not a place to go back to.
    it("takes on the new preset's URL without adding a history entry", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      // Corrected in PLACE, not navigated to: the draft already holds the preset
      // that was just written, and asking the router for its route would fetch
      // that same preset back and remount the playground around it.
      expect(window.location.pathname).toBe("/playground/shader/preset-1");
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not re-write the URL when updating a preset already open", async () => {
      const { saveShaderPreset } = await import("@/app/actions/shader-preset");
      mockPathname.mockReturnValue("/playground/shader/preset-9");
      useShaderPresetDraftStore.getState().load({
        id: "preset-9",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
        publishedAt: null,
      });
      (saveShaderPreset as Mock).mockResolvedValue({
        id: "preset-9",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      window.history.replaceState(null, "", "/playground/shader/preset-9");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(window.location.pathname).toBe("/playground/shader/preset-9");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("leaves the draft clean, so there is nothing left to discard", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().setParam("scale", 2);
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    });

    it("keeps the draft when the write fails", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      (createShaderPreset as Mock).mockRejectedValue(new Error("nope"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(useShaderPresetDraftStore.getState().settings.params.scale).toBe(
        2,
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("leaving a dirty preset", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/shader");
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.saveShaderPreset as Mock).mockReset();
    });

    it("goes straight back when nothing has been tuned", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(result.current.pendingExit).toBeNull();
    });

    // The whole point: unsaved work must not leave silently. #94 solved this by
    // withholding the command; asking is the better answer, because "I want to
    // go and I want to keep it" is a thing the author can now say.
    // A visitor has nowhere to save TO, so their tuning is ephemeral by
    // definition and stopping them on the way out would offer an answer
    // ("Save changes and exit") that cannot be carried out.
    it("does not stop a visitor who has no way to save", () => {
      mockUseSession.mockReturnValue({ data: null });
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("asks instead of navigating when there is unsaved work", () => {
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).toBe("/");
    });

    it("saves and then leaves when that is the answer", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().setParam("scale", 2);
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      await act(() => result.current.confirmExitSave());

      expect(createShaderPreset).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("leaves without writing when the answer is discard", async () => {
      const { createShaderPreset, saveShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.confirmExitDiscard());

      expect(createShaderPreset).not.toHaveBeenCalled();
      expect(saveShaderPreset).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    });

    // Cancel is not a quieter discard — the tuning has to survive it intact.
    it("keeps the work and stays put when cancelled", () => {
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.cancelExit());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).toBeNull();
      expect(useShaderPresetDraftStore.getState().settings.params.scale).toBe(
        2,
      );
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
    });

    // A preset just written is clean, so the same press now simply goes.
    it("stops asking once the work has been saved", async () => {
      const { createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().setParam("scale", 2);
      (createShaderPreset as Mock).mockResolvedValue({
        id: "preset-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useShaderPresetDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  describe("handleDiscardAndExit — the preset", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/shader");
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.saveShaderPreset as Mock).mockReset();
    });

    // Nothing was ever written, so this is a no-op plus a navigation — the same
    // shape as the grid's "Discard and exit".
    it("drops the draft and leaves without writing", async () => {
      const { saveShaderPreset, createShaderPreset } = await import(
        "@/app/actions/shader-preset"
      );
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
      expect(saveShaderPreset).not.toHaveBeenCalled();
      expect(createShaderPreset).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    // It IS the answer to the unsaved-work question, said up front — so it must
    // not turn round and ask the question again.
    it("does not stop to confirm what was just chosen", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useShaderPresetDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  // -------------------------------------------------------------------------
  // One rule across every editor
  // -------------------------------------------------------------------------

  describe("handleSaveChanges — the same command in all three editors", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useEditorStore.getState().reset();
      useGridDraftStore.getState().reset();
      useShaderPresetDraftStore.getState().reset();
    });

    // The point of the whole change: ⌘S commits and leaves you where you were,
    // in every editor. An article editor that navigated to the read page was
    // the same "thrown out mid-session" bug the preset had.
    it("keeps you in the document editor", async () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      const { saveDraft } = await import("@/app/actions/post");
      expect(saveDraft).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    // A brand-new draft has no id until it is written, so the URL has to catch
    // up — replace, not push, exactly as a first-saved preset does.
    it("takes on the new draft's edit URL without a history entry", async () => {
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockReplace).toHaveBeenCalledWith(
        "/edit/my-draft?category=ARTICLE",
      );
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("keeps you in the grid editor", async () => {
      mockPathname.mockReturnValue("/edit/home");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      const { saveGridLayout } = await import("@/app/actions/grid");
      expect(saveGridLayout).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("leaves the document editor clean once written", async () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setTitle("Changed");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(useEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe("leaving a dirty editor — one question everywhere", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useEditorStore.getState().reset();
      useGridDraftStore.getState().reset();
      useShaderPresetDraftStore.getState().reset();
    });

    // #94 withheld Back in edit mode so a bare "back" could not discard
    // silently. Asking is the better answer: it keeps "save and go", which is
    // usually what was meant.
    it("offers the way back from a document editor now", () => {
      mockPathname.mockReturnValue("/edit/my-post");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.backTarget).not.toBeNull();
    });

    it("asks before leaving a document with unsaved edits", () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setTitle("Changed");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).not.toBeNull();
    });

    it("asks before leaving the grid with unsaved placements", () => {
      mockPathname.mockReturnValue("/edit/home");
      useGridDraftStore.getState().setPin("post:1", 3);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).not.toBeNull();
    });

    it("does not ask when the editor holds nothing unsaved", () => {
      mockPathname.mockReturnValue("/edit/home");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalled();
    });

    it("saves the right editor when that is the answer", async () => {
      mockPathname.mockReturnValue("/edit/home");
      useGridDraftStore.getState().setPin("post:1", 3);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      await act(() => result.current.confirmExitSave());

      const { saveGridLayout } = await import("@/app/actions/grid");
      expect(saveGridLayout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleThemeToggle
  // -------------------------------------------------------------------------

  describe("handleThemeToggle", () => {
    it("calls setMode('dark') when currently in light mode", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleThemeToggle());
      expect(mockSetMode).toHaveBeenCalledWith("dark");
    });

    it("calls close after toggling", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleThemeToggle());
      expect(close).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // handleEditPage
  // -------------------------------------------------------------------------

  describe("handleEditPage", () => {
    let main: HTMLElement;

    beforeEach(() => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      vi.spyOn(window, "getSelection").mockReturnValue({
        removeAllRanges: vi.fn<() => void>(),
        addRange: vi.fn<() => void>(),
      } as unknown as Selection);

      main = document.createElement("main");
      main.textContent = "Page content";
      document.body.appendChild(main);
    });

    afterEach(() => {
      if (main.parentNode) main.parentNode.removeChild(main);
    });

    it("calls close immediately", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(close).toHaveBeenCalledOnce();
    });

    it("navigates to the article editor on a published writing route", () => {
      mockPathname.mockReturnValue("/writing/my-article");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith(
        "/edit/my-article?category=ARTICLE",
      );
      expect(main.contentEditable).not.toBe("true");
    });

    it("navigates to the project editor on a published work route", () => {
      mockPathname.mockReturnValue("/work/my-project");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith("/edit/my-project?category=WORK");
    });

    // The homepage is edited the way everything else is — by going to its edit
    // route — not by flipping a mode in place. It must NOT fall through to the
    // contentEditable branch, which would make the cards' text directly
    // editable.
    it("opens the grid's edit route from the homepage", () => {
      mockPathname.mockReturnValue("/");
      const { result } = renderHook(() => useCommandPalette(close));

      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith("/edit/home");
      expect(main.contentEditable).not.toBe("true");
    });

    it("returns to the homepage on discarding the grid's layout", () => {
      mockPathname.mockReturnValue("/edit/home");
      const { result } = renderHook(() => useCommandPalette(close));

      act(() => result.current.handleDiscardAndExit());
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("sets contentEditable on <main>", () => {
      // A page that is neither the grid nor a post: the homepage now has real
      // editing of its own and never reaches this branch.
      mockPathname.mockReturnValue("/about");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(main.contentEditable).toBe("true");
    });

    it("falls back to document.body when no <main> exists", () => {
      // A page that is neither the grid nor a post: the homepage now has real
      // editing of its own and never reaches this branch.
      mockPathname.mockReturnValue("/about");
      main.parentNode?.removeChild(main);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(document.body.contentEditable).toBe("true");
      document.body.contentEditable = "inherit";
    });

    it("places the caret at position 0 of the first text node", () => {
      // A page that is neither the grid nor a post: the homepage now has real
      // editing of its own and never reaches this branch.
      mockPathname.mockReturnValue("/about");
      const addRange = vi.fn<(range: Range) => void>();
      vi.spyOn(window, "getSelection").mockReturnValue({
        removeAllRanges: vi.fn<() => void>(),
        addRange,
      } as unknown as Selection);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());

      expect(addRange).toHaveBeenCalledOnce();
      const range = addRange.mock.calls[0][0];
      expect(range.startOffset).toBe(0);
      expect(range.collapsed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // handleNewBlogArticle
  // -------------------------------------------------------------------------

  describe("handleNewBlogArticle", () => {
    it("closes the palette and opens the article editor in a new tab", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewBlogArticle());
      expect(close).toHaveBeenCalledOnce();
      expect(mockOpenInNewTab).toHaveBeenCalledWith(
        "/edit/new?category=ARTICLE",
      );
    });

    // Regression: window.open is silently pop-up-blocked in some browsers, so
    // the command must route through the anchor-based helper instead.
    it("does not use window.open", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewBlogArticle());
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleNewWorkArticle", () => {
    it("closes the palette and opens the work editor in a new tab", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWorkArticle());
      expect(close).toHaveBeenCalledOnce();
      expect(mockOpenInNewTab).toHaveBeenCalledWith("/edit/new?category=WORK");
    });

    it("does not use window.open", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWorkArticle());
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleOpenDraft
  // -------------------------------------------------------------------------

  describe("handleOpenDraft", () => {
    it("calls close and navigates to the draft preview", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() =>
        result.current.handleOpenDraft({
          id: "draft-1",
          slug: "my-draft",
          category: "ARTICLE",
          title: "Draft",
          content: { type: "doc", content: [] },
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      expect(close).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/writing/my-draft");
    });

    it("navigates to /work for WORK drafts", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() =>
        result.current.handleOpenDraft({
          id: "draft-2",
          slug: "my-project",
          category: "WORK",
          title: "Project",
          content: { type: "doc", content: [] },
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/work/my-project");
    });
  });

  // -------------------------------------------------------------------------
  // A document, through the same two commands every editor uses
  // -------------------------------------------------------------------------

  describe("handleSaveChanges — a document", () => {
    beforeEach(async () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      useEditorStore.getState().reset();
      const post = await import("@/app/actions/post");
      (post.createDraft as Mock).mockClear();
      (post.saveDraft as Mock).mockClear();
    });

    it("creates a draft that has never been written", async () => {
      mockPathname.mockReturnValue("/edit/new");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      const { createDraft } = await import("@/app/actions/post");
      expect(createDraft).toHaveBeenCalled();
      // The new id goes into the store, so a second ⌘S updates rather than
      // creating a second draft of the same work.
      expect(useEditorStore.getState().draftId).toBe("new-id");
    });

    it("updates one that has", async () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      const { saveDraft, createDraft } = await import("@/app/actions/post");
      expect(saveDraft).toHaveBeenCalled();
      expect(createDraft).not.toHaveBeenCalled();
    });

    it("tells the other tabs, which are showing the old copy", async () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockNotifyContentUpdated).toHaveBeenCalled();
    });
  });

  describe("handleDiscardAndExit — a document", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      useEditorStore.getState().reset();
    });

    // Nothing was persisted, so the last SAVED version is still in the
    // database — and the read page is where you see it.
    it("returns to the post as it stands saved", async () => {
      useEditorStore.setState({
        title: "Existing",
        draftId: "existing-id",
        category: "ARTICLE",
        document: { type: "doc", content: [] },
        isDirty: true,
      });
      mockPathname.mockReturnValue("/edit/existing-draft");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(close).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/writing/existing-draft");
      expect(useEditorStore.getState().draftId).toBeNull();
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    // A draft never written has no read page to return to.
    it("goes home from an unsaved new draft, deleting nothing", async () => {
      const { deleteDraft } = await import("@/app/actions/post");
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(deleteDraft).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // currentDraft + handleDiscardDraft (renderer mode: delete)
  // -------------------------------------------------------------------------

  describe("currentDraft", () => {
    const draftPost = {
      id: "draft-1",
      slug: "my-draft",
      title: "My Draft",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      publishedAt: null,
      untitledIndex: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(async () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as Mock).mockResolvedValue([draftPost]);
    });

    it("is the matching draft when viewing its read page", async () => {
      mockPathname.mockReturnValue("/writing/my-draft");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.currentDraft?.id).toBe("draft-1");
    });

    it("is null when the viewed article is not a draft", async () => {
      mockPathname.mockReturnValue("/writing/some-published-post");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.currentDraft).toBeNull();
    });

    it("is null in edit mode", async () => {
      mockPathname.mockReturnValue("/edit/my-draft");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.currentDraft).toBeNull();
    });

    it("handleDiscardDraft deletes the viewed draft and navigates home", async () => {
      const { deleteDraft } = await import("@/app/actions/post");
      mockPathname.mockReturnValue("/writing/my-draft");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});

      await act(async () => {
        await result.current.handleDiscardDraft();
      });

      expect(deleteDraft).toHaveBeenCalledWith("draft-1");
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(mockNotifyContentUpdated).toHaveBeenCalledOnce();
    });
  });
});
