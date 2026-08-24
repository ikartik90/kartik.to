// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandPalette } from "../command-palette";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Provide a controllable useSession mock — default: logged out
const mockUseSession = vi.fn().mockReturnValue({ data: null });

vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

// Stub useThemeStore — default: light mode
const mockSetMode = vi.fn();
vi.mock("@/store/theme", () => ({
  useThemeStore: () => ({ mode: "light", setMode: mockSetMode }),
}));

// Stub next/navigation — pathname is controllable per test
const mockPathname = vi.fn().mockReturnValue("/");
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// Stub server actions so they never hit the network
vi.mock("@/app/actions/grid", () => ({
  publishComponent: vi.fn().mockResolvedValue("component-id"),
  setPinned: vi.fn(),
  moveGridItem: vi.fn(),
  unpublishComponent: vi.fn(),
}));

vi.mock("@/app/actions/post", () => ({
  getDrafts: vi.fn().mockResolvedValue([]),
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deleteDraft: vi.fn(),
}));

// jsdom does not implement matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
});

// ---------------------------------------------------------------------------
// JSDOM dialog polyfill
// ---------------------------------------------------------------------------

/** Claim the field the shortcut's platform detection reads first. */
function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

beforeEach(() => {
  // The shortcut is ⌘K on Apple hardware and Ctrl K everywhere else, so every
  // test that presses it has to say which keyboard it is pressing it on.
  stubPlatform("macOS");
  mockUseSession.mockReturnValue({ data: null });
  mockPathname.mockReturnValue("/");
  mockPush.mockClear();
  mockSetMode.mockClear();

  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommandPalette", () => {
  describe("always-visible content", () => {
    it("renders the Settings group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Settings")).toBeDefined();
    });

    it("renders the theme toggle item", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Dark theme")).toBeDefined();
    });

    it("shows 'Dark theme' when in light mode (default)", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Dark theme")).toBeDefined();
    });
  });

  describe("when logged out", () => {
    it("does not render the This Page group", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("This Page")).toBeNull();
    });

    it("does not render the Publish group", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("Publish")).toBeNull();
    });

    it("does not render admin items", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("Edit page")).toBeNull();
      expect(screen.queryByText("New blog article…")).toBeNull();
    });
  });

  describe("hydration safety", () => {
    // The admin session lives only in the browser (localStorage), so the server
    // always renders logged-out. The server HTML must therefore contain no admin
    // UI even when a session is present — otherwise the first client render adds
    // admin nodes the server never sent, React's hydration diverges, and it
    // aborts the subtree with error #418. renderToString reproduces the server
    // render (effects don't run), which is exactly the markup the client must match.
    it("omits admin groups from the server render even with an active session", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      const html = renderToString(<CommandPalette />);
      expect(html).not.toContain("This Page");
      expect(html).not.toContain("Edit page");
      expect(html).not.toContain("New blog article");
    });

    it("still renders the always-visible Settings group in the server render", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      const html = renderToString(<CommandPalette />);
      expect(html).toContain("Settings");
    });
  });

  describe("when logged in (admin) — default route /", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "admin-id",
            email: "admin@example.com",
            name: "Admin",
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: true,
            banned: null,
          },
          session: {
            id: "session-id",
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: "admin-id",
            expiresAt: new Date(Date.now() + 86400000),
            token: "token",
          },
        },
      });
    });

    it("renders the This Page group (not edit mode)", () => {
      render(<CommandPalette />);
      expect(screen.getByText("This Page")).toBeDefined();
    });

    it("does not render the This Article group on non-edit routes", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("This Article")).toBeNull();
    });

    it("renders the Publish group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Publish")).toBeDefined();
    });

    it("renders all admin items", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Edit page")).toBeDefined();
      expect(screen.getByText("Edit metadata")).toBeDefined();
      expect(screen.getByText("New blog article…")).toBeDefined();
      expect(screen.getByText("New work article…")).toBeDefined();
    });

    it("no longer offers 'New page…' (no utility for it yet)", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("New page…")).toBeNull();
    });
  });

  describe("when logged in (admin) — edit route", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/edit/new");
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "admin-id",
            email: "admin@example.com",
            name: "Admin",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: "session-id",
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: "admin-id",
            expiresAt: new Date(Date.now() + 86400000),
            token: "token",
          },
        },
      });
    });

    it("renders only the This Article actions relevant to editing", () => {
      render(<CommandPalette />);
      expect(screen.getByText("This Article")).toBeDefined();
      expect(screen.getByText("Dark theme")).toBeDefined();
      expect(screen.getByText("Publish article")).toBeDefined();
      expect(screen.getByText("Save changes and exit")).toBeDefined();
      expect(screen.getByText("Discard changes and exit")).toBeDefined();
    });

    it("hides the Publish, This Page, and Drafts groups while editing", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("This Page")).toBeNull();
      expect(screen.queryByText("Publish")).toBeNull();
      expect(screen.queryByText("New blog article…")).toBeNull();
      expect(screen.queryByText("Edit metadata")).toBeNull();
    });

    it("does not offer 'Discard draft' (delete) while editing", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("Discard draft")).toBeNull();
    });
  });

  describe("when logged in (admin) — viewing a draft in renderer mode", () => {
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
      mockPathname.mockReturnValue("/writing/my-draft");
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as ReturnType<typeof vi.fn>).mockResolvedValue([draftPost]);
    });

    afterEach(async () => {
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it("offers 'Discard draft' when the viewed post is an unpublished draft", async () => {
      render(<CommandPalette />);
      expect(await screen.findByText("Discard draft")).toBeDefined();
    });

    it("omits the draft being viewed from the Drafts list", async () => {
      const otherDraft = {
        ...draftPost,
        id: "draft-2",
        slug: "other-draft",
        title: "Other Draft",
      };
      const { getDrafts } = await import("@/app/actions/post");
      (getDrafts as ReturnType<typeof vi.fn>).mockResolvedValue([
        draftPost,
        otherDraft,
      ]);
      render(<CommandPalette />);
      // The other draft still appears under the Drafts group…
      expect(await screen.findByText("Other Draft")).toBeDefined();
      // …but the currently-viewed draft is not listed as an option.
      expect(screen.queryByText("My Draft")).toBeNull();
    });
  });

  describe("⌘K keyboard shortcut", () => {
    it("calls showModal when ⌘K is pressed", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      expect(dialog.showModal).toHaveBeenCalledOnce();
    });

    it("does not open on plain K (without meta)", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: false });
      expect(dialog.showModal).not.toHaveBeenCalled();
    });

    // ⌘ on Apple hardware is Ctrl on a PC keyboard — the same shortcut, typed
    // with the key that platform's shortcuts are actually typed with. Neither
    // modifier is accepted on the other's platform: Ctrl+K is a text binding on
    // macOS, and Meta on Windows is the OS's own key.
    it("opens on Ctrl+K on a non-Apple platform", () => {
      stubPlatform("Windows");
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(dialog.showModal).toHaveBeenCalledOnce();
    });

    it("does not open on ⌘K on a non-Apple platform", () => {
      stubPlatform("Windows");
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      expect(dialog.showModal).not.toHaveBeenCalled();
    });

    it("does not open on Ctrl+K on Apple hardware", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(dialog.showModal).not.toHaveBeenCalled();
    });
  });

  describe("⌘K toggle — close when open", () => {
    it("closes the dialog when ⌘K is pressed while it is already open", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      expect(dialog.close).toHaveBeenCalledOnce();
    });
  });

  describe("closing on item select", () => {
    it("closes the dialog when the theme toggle item is selected", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      const item = screen.getByText("Dark theme");
      fireEvent.click(item);

      expect(dialog.close).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Navigate — the back control, which used to be an icon button in the gutter
// ---------------------------------------------------------------------------

describe("CommandPalette — Navigate", () => {
  it("offers a way back, named for where it goes", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    expect(screen.getByText("Navigate")).toBeDefined();
    expect(screen.getByText("Back to index")).toBeDefined();
  });

  it("names the nearest ancestor page rather than the index every time", () => {
    mockPathname.mockReturnValue("/writing/my-post/edit");
    render(<CommandPalette />);

    expect(screen.getByText("Back to My Post")).toBeDefined();
  });

  it("shows the shortcut the platform actually types beside it", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);
    expect(screen.getByText("⌘[").tagName).toBe("KBD");

    cleanup();
    stubPlatform("Windows");
    render(<CommandPalette />);
    expect(screen.getByText("Ctrl [").tagName).toBe("KBD");
  });

  it("goes there when the item is chosen", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    fireEvent.click(screen.getByText("Back to index"));

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("goes there on the shortcut too, from anywhere on the page", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: "[", metaKey: true });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("ignores the shortcut typed with the other platform's modifier", () => {
    // ⌘[ on Apple hardware, Ctrl [ on a PC — never both, or the label lies.
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: "[", ctrlKey: true });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("has nothing to offer on the index itself", () => {
    mockPathname.mockReturnValue("/");
    render(<CommandPalette />);

    expect(screen.queryByText("Navigate")).toBeNull();
    expect(screen.queryByText("⌘[")).toBeNull();
  });

  it("does not offer a silent way out of the editor", () => {
    // Edit mode has its own exits — save, discard, publish — and each of them
    // says what happens to the buffered work. "Back" would answer that question
    // by throwing it away without saying so.
    mockPathname.mockReturnValue("/edit/new");
    render(<CommandPalette />);
    expect(screen.queryByText("Navigate")).toBeNull();

    cleanup();
    mockPathname.mockReturnValue("/edit/home");
    render(<CommandPalette />);
    expect(screen.queryByText("Navigate")).toBeNull();
  });

  it("keeps the card studio's way back — it buffers nothing to lose", () => {
    mockPathname.mockReturnValue("/edit/card-studio");
    render(<CommandPalette />);

    expect(screen.getByText("Back to index")).toBeDefined();
  });

  it("leads the palette, and leaves Settings to close it", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    const navigate = screen.getByText("Navigate");
    const settings = screen.getByText("Settings");
    expect(
      navigate.compareDocumentPosition(settings) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("puts Settings last, after the admin groups", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "admin-id", email: "admin@example.com" },
        session: { id: "session-id", userId: "admin-id" },
      },
    });
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    const settings = screen.getByText("Settings");
    for (const heading of ["Navigate", "This Page", "Publish"]) {
      expect(
        screen.getByText(heading).compareDocumentPosition(settings) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
