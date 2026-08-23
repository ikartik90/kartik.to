// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { useCommandPalette } from "../use-command-palette";

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

vi.mock("@/app/actions/grid", () => ({
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

      act(() => result.current.handleDiscardHome());
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
  // handleSaveDraft
  // -------------------------------------------------------------------------

  describe("handleSaveDraft", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
    });

    it("creates a new draft and navigates to its preview", async () => {
      const { useEditorStore } = await import("@/store/editor");
      useEditorStore.setState({
        title: "New Draft",
        draftId: null,
        category: "ARTICLE",
        document: { type: "doc", content: [] },
        isDirty: true,
        history: [],
        historyIndex: -1,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {
        await result.current.handleSaveDraft();
      });

      expect(close).toHaveBeenCalledOnce();
      expect(mockNotifyContentUpdated).toHaveBeenCalledOnce();
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/writing/my-draft");
      expect(mockReplace.mock.invocationCallOrder[0]).toBeLessThan(
        mockNotifyContentUpdated.mock.invocationCallOrder[0],
      );
      expect(useEditorStore.getState().draftId).toBeNull();
    });

    it("updates an existing draft and navigates to its preview", async () => {
      const { saveDraft } = await import("@/app/actions/post");
      const { useEditorStore } = await import("@/store/editor");
      useEditorStore.setState({
        title: "Existing",
        draftId: "existing-id",
        category: "ARTICLE",
        document: { type: "doc", content: [] },
        isDirty: true,
        history: [],
        historyIndex: -1,
      });

      const { result } = renderHook(() => useCommandPalette(close));
      await act(async () => {
        await result.current.handleSaveDraft();
      });

      expect(saveDraft).toHaveBeenCalledWith({
        id: "existing-id",
        title: "Existing",
        document: { type: "doc", content: [] },
      });
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(mockNotifyContentUpdated).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/writing/existing-draft");
      expect(mockPush.mock.invocationCallOrder[0]).toBeLessThan(
        mockNotifyContentUpdated.mock.invocationCallOrder[0],
      );
      // Reset is deferred until ArticleEditor unmounts after navigation.
      expect(useEditorStore.getState().draftId).toBe("existing-id");
    });
  });

  // -------------------------------------------------------------------------
  // handleDiscardChanges (edit mode: revert + exit)
  // -------------------------------------------------------------------------

  describe("handleDiscardChanges", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ data: { user: { id: "admin-id" } } });
    });

    it("resets the store and navigates to the read page when editing an existing post", async () => {
      const { useEditorStore } = await import("@/store/editor");
      useEditorStore.setState({
        title: "Existing",
        draftId: "existing-id",
        category: "ARTICLE",
        document: { type: "doc", content: [] },
        isDirty: true,
      });
      mockPathname.mockReturnValue("/edit/existing-draft");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => {
        result.current.handleDiscardChanges();
      });

      expect(close).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/writing/existing-draft");
      // Store is reverted so no unsaved edits leak into the next session.
      expect(useEditorStore.getState().draftId).toBeNull();
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it("navigates home when discarding an unsaved new draft", async () => {
      const { deleteDraft } = await import("@/app/actions/post");
      mockPathname.mockReturnValue("/edit/new");

      const { result } = renderHook(() => useCommandPalette(close));
      act(() => {
        result.current.handleDiscardChanges();
      });

      expect(mockPush).toHaveBeenCalledWith("/");
      // Discarding changes never deletes anything from the database.
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
