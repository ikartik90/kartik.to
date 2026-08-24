// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { useCommandPalette } from "../use-command-palette";
import { useCoverDraftStore } from "@/store/cover-draft";
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
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
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
vi.mock("@/app/actions/cover", () => ({
  getCovers: vi.fn().mockResolvedValue([]),
  getCover: vi.fn(),
  createCover: vi.fn(),
  saveCover: vi.fn(),
  deleteCover: vi.fn(),
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
  // The cover playground
  // -------------------------------------------------------------------------

  describe("isCoverPlayground", () => {
    it("is true on the bare playground route", () => {
      mockPathname.mockReturnValue("/playground/cover");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isCoverPlayground).toBe(true);
    });

    it("is true on a saved cover's route", () => {
      mockPathname.mockReturnValue("/playground/cover/abc123");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isCoverPlayground).toBe(true);
    });

    it("is false elsewhere", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      const { result } = renderHook(() => useCommandPalette(close));
      expect(result.current.isCoverPlayground).toBe(false);
    });
  });

  describe("handleSaveChanges — the cover", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/cover");
      useCoverDraftStore.getState().reset();
      const cover = await import("@/app/actions/cover");
      (cover.createCover as Mock).mockReset();
      (cover.saveCover as Mock).mockReset();
    });

    // Create or update is decided by the DRAFT, not the route — after a create
    // the two disagree until the navigation lands, and the store is what knows.
    it("creates when the draft has never been saved", async () => {
      const { createCover, saveCover } = await import("@/app/actions/cover");
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(createCover).toHaveBeenCalledOnce();
      expect(saveCover).not.toHaveBeenCalled();
      // The saved row's id comes back into the draft, so a second ⌘S updates
      // the cover just written rather than creating a duplicate of it.
      expect(useCoverDraftStore.getState().coverId).toBe("cover-1");
    });

    it("updates the cover the draft was opened on", async () => {
      const { createCover, saveCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().load({
        id: "cover-9",
        title: "Dusk",
        shaderId: "swirl",
        settings: useCoverDraftStore.getState().settings,
      });
      (saveCover as Mock).mockResolvedValue({
        id: "cover-9",
        title: "Dusk",
        shaderId: "swirl",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(saveCover).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cover-9" }),
      );
      expect(createCover).not.toHaveBeenCalled();
    });

    // A failed write must not look like a successful one. The palette closes
    // either way (the press was received), but the draft keeps its work and the
    // page does not navigate away from it.
    // ⌘S is a SAVE, not an exit. The whole point of the shortcut is to keep
    // working, so the one thing it must never do is navigate.
    it("stays on the page", async () => {
      const { createCover } = await import("@/app/actions/cover");
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockPush).not.toHaveBeenCalled();
    });

    // Saving a never-saved cover gives it an id, and the URL has to catch up or
    // a refresh would land back on the blank route and lose the connection.
    // `replace`, not `push`: the blank route is not a place to go back to.
    it("takes on the new cover's URL without adding a history entry", async () => {
      const { createCover } = await import("@/app/actions/cover");
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockReplace).toHaveBeenCalledWith("/playground/cover/cover-1");
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not re-write the URL when updating a cover already open", async () => {
      const { saveCover } = await import("@/app/actions/cover");
      mockPathname.mockReturnValue("/playground/cover/cover-9");
      useCoverDraftStore.getState().load({
        id: "cover-9",
        title: "Dusk",
        shaderId: "swirl",
        settings: useCoverDraftStore.getState().settings,
      });
      (saveCover as Mock).mockResolvedValue({
        id: "cover-9",
        title: "Dusk",
        shaderId: "swirl",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("leaves the draft clean, so there is nothing left to discard", async () => {
      const { createCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().setParam("scale", 2);
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(useCoverDraftStore.getState().isDirty).toBe(false);
    });

    it("keeps the draft when the write fails", async () => {
      const { createCover } = await import("@/app/actions/cover");
      (createCover as Mock).mockRejectedValue(new Error("nope"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(useCoverDraftStore.getState().settings.params.scale).toBe(2);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("leaving a dirty cover", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/cover");
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useCoverDraftStore.getState().reset();
      const cover = await import("@/app/actions/cover");
      (cover.createCover as Mock).mockReset();
      (cover.saveCover as Mock).mockReset();
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
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("asks instead of navigating when there is unsaved work", () => {
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).toBe("/");
    });

    it("saves and then leaves when that is the answer", async () => {
      const { createCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().setParam("scale", 2);
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      await act(() => result.current.confirmExitSave());

      expect(createCover).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("leaves without writing when the answer is discard", async () => {
      const { createCover, saveCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.confirmExitDiscard());

      expect(createCover).not.toHaveBeenCalled();
      expect(saveCover).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(useCoverDraftStore.getState().isDirty).toBe(false);
    });

    // Cancel is not a quieter discard — the tuning has to survive it intact.
    it("keeps the work and stays put when cancelled", () => {
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleBack());
      act(() => result.current.cancelExit());

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.pendingExit).toBeNull();
      expect(useCoverDraftStore.getState().settings.params.scale).toBe(2);
      expect(useCoverDraftStore.getState().isDirty).toBe(true);
    });

    // A cover just written is clean, so the same press now simply goes.
    it("stops asking once the work has been saved", async () => {
      const { createCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().setParam("scale", 2);
      (createCover as Mock).mockResolvedValue({
        id: "cover-1",
        title: null,
        shaderId: "cosmicTrack",
        settings: useCoverDraftStore.getState().settings,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());
      act(() => result.current.handleBack());

      expect(result.current.pendingExit).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  describe("handleDiscardAndExit — the cover", () => {
    beforeEach(async () => {
      mockPathname.mockReturnValue("/playground/cover");
      useCoverDraftStore.getState().reset();
      const cover = await import("@/app/actions/cover");
      (cover.createCover as Mock).mockReset();
      (cover.saveCover as Mock).mockReset();
    });

    // Nothing was ever written, so this is a no-op plus a navigation — the same
    // shape as the grid's "Discard and exit".
    it("drops the draft and leaves without writing", async () => {
      const { saveCover, createCover } = await import("@/app/actions/cover");
      useCoverDraftStore.getState().setParam("scale", 2);

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleDiscardAndExit());

      expect(useCoverDraftStore.getState().isDirty).toBe(false);
      expect(useCoverDraftStore.getState().coverId).toBeNull();
      expect(saveCover).not.toHaveBeenCalled();
      expect(createCover).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    // It IS the answer to the unsaved-work question, said up front — so it must
    // not turn round and ask the question again.
    it("does not stop to confirm what was just chosen", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      useCoverDraftStore.getState().setParam("scale", 2);

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
      useCoverDraftStore.getState().reset();
    });

    // The point of the whole change: ⌘S commits and leaves you where you were,
    // in every editor. An article editor that navigated to the read page was
    // the same "thrown out mid-session" bug the cover had.
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
    // up — replace, not push, exactly as a first-saved cover does.
    it("takes on the new draft's edit URL without a history entry", async () => {
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      await act(() => result.current.handleSaveChanges());

      expect(mockReplace).toHaveBeenCalledWith("/edit/my-draft?category=ARTICLE");
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
      useCoverDraftStore.getState().reset();
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
