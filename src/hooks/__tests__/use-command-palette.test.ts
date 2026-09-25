// @vitest-environment jsdom
import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { useCommandPalette } from "../use-command-palette";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { useEditorStore } from "@/store/editor";
import { useGridDraftStore } from "@/store/grid-draft";
import { useMetadataPanelStore } from "@/store/metadata-panel";
import { autosaveKey } from "@/utils/editor-autosave";
import { isGridDraftDirty } from "@/utils/grid-draft";

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

// Stubbed: action modules import @/lib/env, which throws at import time without a .env.
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  getShaderPreset: vi.fn(),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
}));

vi.mock("@/app/actions/grid", () => ({
  saveGridLayout: vi.fn().mockResolvedValue(undefined),
  setPinned: vi.fn(),
  moveGridItem: vi.fn(),
  unpublishComponent: vi.fn(),
}));

vi.mock("@/app/actions/post", () => ({
  getDrafts: vi.fn().mockResolvedValue([]),
  getPublishedProjects: vi.fn().mockResolvedValue([]),
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

  describe("editorKind on the testimonials board", () => {
    it("is no editor", () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      mockPathname.mockReturnValue("/edit/testimonials");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.editorKind).toBeNull();
      expect(result.current.isEditMode).toBe(false);
    });
  });

  describe("editorKind on the playground", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/playground/shader");
    });

    // Nothing unmounts between tests here, and a mounted hook keeps its ⌘S listener.
    afterEach(cleanup);

    it("is no editor at all for a visitor, who has nowhere to save to", () => {
      const { result } = renderHook(() => useCommandPalette(close));

      expect(result.current.editorKind).toBeNull();
    });

    it("is the preset editor for the author, who does", () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      const { result } = renderHook(() => useCommandPalette(close));

      expect(result.current.editorKind).toBe("shaderPreset");
    });

    it("says the same on a saved preset's own route", () => {
      mockPathname.mockReturnValue("/playground/shader/abc123");
      const { result } = renderHook(() => useCommandPalette(close));

      expect(result.current.editorKind).toBeNull();
    });

    it("names the visitor's way out as navigation", () => {
      const { result } = renderHook(() => useCommandPalette(close));

      expect(result.current.backTarget?.label).toBe("Back to index");
    });

    it("names the author's as finishing with the editor", () => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      const { result } = renderHook(() => useCommandPalette(close));

      expect(result.current.backTarget?.label).toBe("Exit editor");
    });
  });

  describe("the save shortcut", () => {
    // The listener only answers the platform's own modifier, so tests pin macOS.
    const stubApple = () =>
      Object.defineProperty(navigator, "userAgentData", {
        value: { platform: "macOS" },
        configurable: true,
      });

    // Nothing unmounts between tests here, and a mounted hook keeps its window listener.
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
      expect(event.defaultPrevented).toBe(true);
    });

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
      mockPathname.mockReturnValue("/writing/my-post");
      stubApple();
    });

    it("goes up a level, and takes the key off the browser", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("/");
      });

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(event.defaultPrevented).toBe(true);
    });

    it("leaves ⌘[ alone", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("[");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("does not answer the shifted key", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("?", { shiftKey: true });
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("leaves the key alone at the index, which has nothing behind it", () => {
      mockPathname.mockReturnValue("/");
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("/");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("refuses the other platform's modifier", () => {
      renderHook(() => useCommandPalette(close));

      let event!: KeyboardEvent;
      act(() => {
        event = press("/", { metaKey: false, ctrlKey: true });
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

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

    it("lets a visitor go, having nowhere to save to", () => {
      mockUseSession.mockReturnValue({ data: null });
      useEditorStore.setState({ isDirty: true });
      renderHook(() => useCommandPalette(close));

      expect(fireUnload().defaultPrevented).toBe(false);
    });

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
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.saveShaderPreset as Mock).mockReset();
    });

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
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useShaderPresetDraftStore.getState().reset();
      const preset = await import("@/app/actions/shader-preset");
      (preset.createShaderPreset as Mock).mockReset();
      (preset.saveShaderPreset as Mock).mockReset();
    });

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

  describe("handlePublish — the document goes with the switch", () => {
    beforeEach(async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useEditorStore.getState().reset();
      mockPathname.mockReturnValue("/edit/my-post");
      window.localStorage.clear();
      // mockClear, not mockReset: the module mocks' implementations must survive.
      const actions = await import("@/app/actions/post");
      vi.mocked(actions.createDraft).mockClear();
      vi.mocked(actions.saveDraft).mockClear();
      vi.mocked(actions.publishPost).mockClear();
    });

    it("writes the buffer before flipping the switch on an existing post", async () => {
      const { saveDraft, publishPost } = await import("@/app/actions/post");
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setDocument({
        type: "doc",
        content: [
          { type: "paragraph", children: [{ type: "text", text: "new" }] },
        ],
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "existing-id",
          document: expect.objectContaining({
            content: [
              { type: "paragraph", children: [{ type: "text", text: "new" }] },
            ],
          }),
        }),
      );
      expect(publishPost).toHaveBeenCalledWith("existing-id");
    });

    it("mints a post that has none, and does not write it twice", async () => {
      const { createDraft, saveDraft, publishPost } = await import(
        "@/app/actions/post"
      );
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(createDraft).toHaveBeenCalled();
      expect(saveDraft).not.toHaveBeenCalled();
      expect(publishPost).toHaveBeenCalledWith("new-id");
    });

    it("leaves the buffer clean once the row holds it", async () => {
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setTitle("Changed");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it("keeps the local snapshot when the write fails", async () => {
      const { saveDraft } = await import("@/app/actions/post");
      vi.mocked(saveDraft).mockRejectedValueOnce(new Error("offline"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setDocument({ type: "doc", content: [] });
      const key = autosaveKey("existing-id", "ARTICLE");
      window.localStorage.setItem(key, "snapshot");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(window.localStorage.getItem(key)).toBe("snapshot");
    });

    it("drops the local snapshot once the row holds the document", async () => {
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setDocument({ type: "doc", content: [] });
      const key = autosaveKey("existing-id", "ARTICLE");
      window.localStorage.setItem(key, "snapshot");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("stays put, and publishes nothing, when the write fails", async () => {
      const { saveDraft, publishPost } = await import("@/app/actions/post");
      vi.mocked(saveDraft).mockRejectedValueOnce(new Error("offline"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore.getState().setDocument({ type: "doc", content: [] });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handlePublish());

      expect(publishPost).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe("handleSaveChanges — the same command in all three editors", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useEditorStore.getState().reset();
      useGridDraftStore.getState().reset();
      useShaderPresetDraftStore.getState().reset();
    });

    it("keeps you in the document editor", async () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      const { saveDraft } = await import("@/app/actions/post");
      expect(saveDraft).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

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

    it("throws the local snapshot away with a document's edits", () => {
      mockPathname.mockReturnValue("/edit/my-post");
      useEditorStore.getState().setDraftId("existing-id");
      useEditorStore
        .getState()
        .setSavedAddress({ category: "ARTICLE", slug: "my-post" });
      useEditorStore.getState().setTitle("Changed");
      const key = autosaveKey("existing-id", "ARTICLE");
      window.localStorage.setItem(key, "snapshot");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.confirmExitDiscard());

      expect(window.localStorage.getItem(key)).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/writing/my-post");
    });

    it("throws the local snapshot away with the homepage's edits", () => {
      mockPathname.mockReturnValue("/edit/home");
      useEditorStore.setState({ draftId: "home-id", category: "ARTICLE" });
      useEditorStore.getState().setTitle("Changed");
      useGridDraftStore.getState().setPin("post:1", 3);
      const key = autosaveKey("home-id", "ARTICLE");
      window.localStorage.setItem(key, "snapshot");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.confirmExitDiscard());

      expect(window.localStorage.getItem(key)).toBeNull();
      expect(isGridDraftDirty(useGridDraftStore.getState())).toBe(false);
    });
  });

  describe("handleNewWidget", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/edit/home");
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      useEditorStore.getState().reset();
      useGridDraftStore.getState().reset();
      const { saveGridLayout } = await import("@/app/actions/grid");
      vi.mocked(saveGridLayout).mockClear();
    });

    it("writes nothing on its own", async () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWidget("calchemy-demo"));

      const { saveGridLayout } = await import("@/app/actions/grid");
      expect(saveGridLayout).not.toHaveBeenCalled();
      expect(useGridDraftStore.getState().inserts).toHaveLength(1);
    });

    it("makes the editor dirty", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWidget("calchemy-demo"));
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).not.toBeNull();
    });

    it("reaches the server only when the homepage is saved", async () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWidget("calchemy-demo"));
      await act(() => result.current.handleSaveChanges());

      const { saveGridLayout } = await import("@/app/actions/grid");
      expect(saveGridLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          inserts: [
            expect.objectContaining({
              componentId: "calchemy-demo",
              index: null,
            }),
          ],
        }),
      );
    });

    it("is thrown away with the rest when the changes are discarded", async () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWidget("calchemy-demo"));
      act(() => result.current.handleDiscardAndExit());

      const { saveGridLayout } = await import("@/app/actions/grid");
      expect(useGridDraftStore.getState().inserts).toEqual([]);
      expect(saveGridLayout).not.toHaveBeenCalled();
    });
  });

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

    it("navigates to the prototype editor on a prototype's route", () => {
      mockPathname.mockReturnValue("/prototype/a-toy");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith(
        "/edit/a-toy?category=PROTOTYPE",
      );
    });

    it("navigates to the project editor on a published work route", () => {
      mockPathname.mockReturnValue("/work/my-project");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith("/edit/my-project?category=WORK");
    });

    it("opens the grid's edit route from the homepage", () => {
      mockPathname.mockReturnValue("/");
      const { result } = renderHook(() => useCommandPalette(close));

      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith("/edit/home");
      expect(main.contentEditable).not.toBe("true");
    });

    it("opens the About page's editor from the About page", () => {
      mockPathname.mockReturnValue("/about");
      const { result } = renderHook(() => useCommandPalette(close));

      act(() => result.current.handleEditPage());
      expect(mockPush).toHaveBeenCalledWith("/edit/about");
      expect(main.contentEditable).not.toBe("true");
    });

    it("returns to the homepage on discarding the grid's layout", () => {
      mockPathname.mockReturnValue("/edit/home");
      const { result } = renderHook(() => useCommandPalette(close));

      act(() => result.current.handleDiscardAndExit());
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("sets contentEditable on <main>", () => {
      mockPathname.mockReturnValue("/vouch");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(main.contentEditable).toBe("true");
    });

    it("falls back to document.body when no <main> exists", () => {
      mockPathname.mockReturnValue("/vouch");
      main.parentNode?.removeChild(main);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(document.body.contentEditable).toBe("true");
      document.body.contentEditable = "inherit";
    });

    it("places the caret at position 0 of the first text node", () => {
      mockPathname.mockReturnValue("/vouch");
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

  describe("handleNewPost", () => {
    it.each([
      ["ARTICLE", "/edit/new?category=ARTICLE"],
      ["WORK", "/edit/new?category=WORK"],
      ["PROTOTYPE", "/edit/new?category=PROTOTYPE"],
    ] as const)(
      "closes the palette and opens a new %s's editor in a new tab",
      (category, url) => {
        const { result } = renderHook(() => useCommandPalette(close));
        act(() => result.current.handleNewPost(category));
        expect(close).toHaveBeenCalledOnce();
        expect(mockOpenInNewTab).toHaveBeenCalledWith(url);
      },
    );

    it("does not use window.open", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewPost("ARTICLE"));
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

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
      expect(useEditorStore.getState().draftId).toBe("new-id");
    });

    it("does not start a second write while one is in flight", async () => {
      const { createDraft } = await import("@/app/actions/post");
      mockPathname.mockReturnValue("/edit/new");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(() =>
        Promise.all([
          result.current.handleSaveChanges(),
          result.current.handleSaveChanges(),
        ]),
      );
      expect(createDraft).toHaveBeenCalledOnce();
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

    it("returns to the post as it stands saved", async () => {
      useEditorStore.setState({
        title: "Existing",
        draftId: "existing-id",
        category: "ARTICLE",
        savedAddress: { category: "ARTICLE", slug: "existing-draft" },
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

    it("goes home from an unsaved new draft, deleting nothing", async () => {
      const { deleteDraft } = await import("@/app/actions/post");
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(deleteDraft).not.toHaveBeenCalled();
    });
  });

  describe("projects", () => {
    const projects = [
      { slug: "shift-scheduling", title: "Shift Scheduling" },
      { slug: "scheduling-extensions", title: "Scheduling Extensions" },
    ];

    beforeEach(async () => {
      const { getPublishedProjects } = await import("@/app/actions/post");
      (getPublishedProjects as Mock).mockClear();
      (getPublishedProjects as Mock).mockResolvedValue(projects);
    });

    it("are loaded for a visitor, who has no session", async () => {
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.projects).toEqual(projects);
    });

    it("leave out the one being read", async () => {
      mockPathname.mockReturnValue("/work/shift-scheduling");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.projects).toEqual([projects[1]]);
    });

    it("are looked up again each time the palette opens", async () => {
      const { getPublishedProjects } = await import("@/app/actions/post");
      const { rerender } = renderHook(
        ({ openKey }) => useCommandPalette(close, openKey),
        { initialProps: { openKey: 0 } },
      );
      await act(async () => {});
      expect(getPublishedProjects).toHaveBeenCalledTimes(1);

      rerender({ openKey: 1 });
      await act(async () => {});
      expect(getPublishedProjects).toHaveBeenCalledTimes(2);
    });

    it("handleOpenProject goes to the project and closes the palette", async () => {
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});

      act(() => result.current.handleOpenProject(projects[0]));

      expect(mockPush).toHaveBeenCalledWith("/work/shift-scheduling");
      expect(close).toHaveBeenCalledOnce();
    });
  });

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

    it("is the About page's draft when reading it at /about", async () => {
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as Mock).mockResolvedValue([
        { ...draftPost, id: "about-1", slug: "about", category: "PAGE" },
      ]);
      mockPathname.mockReturnValue("/about");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.currentDraft?.id).toBe("about-1");
    });

    it("is a prototype's draft when reading it at its own address", async () => {
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as Mock).mockResolvedValue([
        { ...draftPost, id: "toy-1", slug: "a-toy", category: "PROTOTYPE" },
      ]);
      mockPathname.mockReturnValue("/prototype/a-toy");
      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {});
      expect(result.current.currentDraft?.id).toBe("toy-1");
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

  describe("editing metadata", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
      useEditorStore.getState().reset();
      useMetadataPanelStore.setState({ open: false });
    });

    it.each([
      ["/edit/my-post", true],
      ["/edit/new", true],
      ["/edit/home", true],
      ["/edit/about", true],
      ["/writing/my-article", false],
      ["/work/my-project", false],
      ["/prototype/a-toy", false],
      ["/about", false],
      ["/", false],
      ["/playground/shader", false],
      ["/playground/calchemy", false],
      ["/edit/testimonials", false],
      ["/vouch", false],
    ])("is offered at %s: %s", (pathname, offered) => {
      mockPathname.mockReturnValue(pathname);
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.canEditMetadata).toBe(offered);
    });

    it("is never offered to a visitor", () => {
      mockUseSession.mockReturnValue({ data: null });
      mockPathname.mockReturnValue("/edit/my-post");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.canEditMetadata).toBe(false);
    });

    it("opens the sidebar in place inside an editor", () => {
      mockPathname.mockReturnValue("/edit/my-post");
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditMetadata());
      expect(close).toHaveBeenCalledOnce();
      expect(useMetadataPanelStore.getState().open).toBe(true);
      expect(mockPush).not.toHaveBeenCalled();
    });

    describe("saving it", () => {
      beforeEach(async () => {
        mockPathname.mockReturnValue("/edit/hello");
        const post = await import("@/app/actions/post");
        vi.mocked(post.createDraft).mockClear();
        vi.mocked(post.saveDraft).mockClear();
        vi.mocked(post.publishPost).mockClear();
      });

      const row = (overrides: Record<string, unknown>) => ({
        id: "existing-id",
        slug: "hello",
        title: "Hello",
        category: "ARTICLE",
        content: { type: "doc", content: [] },
        publishedAt: null,
        untitledIndex: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      });

      function seedSaved() {
        useEditorStore.setState({
          draftId: "existing-id",
          category: "ARTICLE",
          slug: "hello",
          savedAddress: { category: "ARTICLE", slug: "hello" },
        });
      }

      it("writes the sidebar's category, address and description with the words", async () => {
        const { saveDraft } = await import("@/app/actions/post");
        seedSaved();
        useEditorStore.getState().setCategory("WORK");
        useEditorStore.getState().setSlug("renamed");
        useEditorStore.getState().setDescription("For search.");

        const { result } = renderHook(() => useCommandPalette(close));
        await act(() => result.current.handleSaveChanges());

        expect(saveDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "existing-id",
            category: "WORK",
            slug: "renamed",
            description: "For search.",
          }),
        );
      });

      it("mints a draft at the address typed before its first save", async () => {
        const { createDraft } = await import("@/app/actions/post");
        mockPathname.mockReturnValue("/edit/new");
        useEditorStore.getState().setCategory("PROTOTYPE");
        useEditorStore.getState().setSlug("a-toy");
        useEditorStore.getState().setDescription("A toy.");

        const { result } = renderHook(() => useCommandPalette(close));
        await act(() => result.current.handleSaveChanges());

        expect(createDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            category: "PROTOTYPE",
            slug: "a-toy",
            description: "A toy.",
          }),
        );
      });

      it("follows the post to the address the save moved it to", async () => {
        const { saveDraft } = await import("@/app/actions/post");
        vi.mocked(saveDraft).mockResolvedValueOnce(
          row({ slug: "renamed", category: "WORK" }) as never,
        );
        seedSaved();
        useEditorStore.getState().setSlug("renamed");

        const { result } = renderHook(() => useCommandPalette(close));
        await act(() => result.current.handleSaveChanges());

        expect(mockReplace).toHaveBeenCalledWith(
          "/edit/renamed?category=WORK",
        );
        expect(useEditorStore.getState().savedAddress).toEqual({
          category: "WORK",
          slug: "renamed",
        });
      });

      it("stays where it is when the save moved nothing", async () => {
        const { saveDraft } = await import("@/app/actions/post");
        vi.mocked(saveDraft).mockResolvedValueOnce(row({}) as never);
        seedSaved();
        useEditorStore.getState().setTitle("Changed");

        const { result } = renderHook(() => useCommandPalette(close));
        await act(() => result.current.handleSaveChanges());

        expect(mockReplace).not.toHaveBeenCalled();
      });

      it("reads the way out when it is taken, not when the palette rendered", () => {
        const { result } = renderHook(() => useCommandPalette(close));
        seedSaved();
        act(() => result.current.handleBack());
        expect(mockPush).toHaveBeenCalledWith("/writing/hello");
      });

      it("leaves for the saved address, not the one the sidebar holds", () => {
        seedSaved();
        useEditorStore.getState().setCategory("WORK");
        useEditorStore.getState().setSlug("renamed");

        const { result } = renderHook(() => useCommandPalette(close));
        act(() => result.current.handleDiscardAndExit());

        expect(mockPush).toHaveBeenCalledWith("/writing/hello");
      });

      it("publishes to the address the save moved it to", async () => {
        const { saveDraft, publishPost } = await import("@/app/actions/post");
        vi.mocked(saveDraft).mockResolvedValueOnce(
          row({ slug: "renamed", category: "WORK" }) as never,
        );
        vi.mocked(publishPost).mockResolvedValueOnce(
          row({
            slug: "renamed",
            category: "WORK",
            publishedAt: new Date(),
          }) as never,
        );
        seedSaved();
        useEditorStore.getState().setSlug("renamed");

        const { result } = renderHook(() => useCommandPalette(close));
        await act(() => result.current.handlePublish());

        expect(mockPush).toHaveBeenCalledWith("/work/renamed");
      });
    });
  });
});
