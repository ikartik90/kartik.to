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
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

    it("sets contentEditable on <main>", () => {
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(main.contentEditable).toBe("true");
    });

    it("falls back to document.body when no <main> exists", () => {
      main.parentNode?.removeChild(main);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleEditPage());
      expect(document.body.contentEditable).toBe("true");
      document.body.contentEditable = "inherit";
    });

    it("places the caret at position 0 of the first text node", () => {
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
    it("calls close and opens /edit/new?category=ARTICLE in a new tab", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewBlogArticle());
      expect(close).toHaveBeenCalledOnce();
      expect(openSpy).toHaveBeenCalledWith(
        "/edit/new?category=ARTICLE",
        "_blank",
      );
    });
  });

  describe("handleNewWorkArticle", () => {
    it("calls close and opens /edit/new?category=WORK in a new tab", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const { result } = renderHook(() => useCommandPalette(close));
      act(() => result.current.handleNewWorkArticle());
      expect(close).toHaveBeenCalledOnce();
      expect(openSpy).toHaveBeenCalledWith("/edit/new?category=WORK", "_blank");
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
      expect(mockReplace).toHaveBeenCalledWith("/writing/my-draft");
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
      expect(mockPush).toHaveBeenCalledWith("/writing/existing-draft");
      expect(useEditorStore.getState().draftId).toBeNull();
    });
  });
});
