// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandPalette } from "../command-palette";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";
import { useGridDraftStore } from "@/store/grid-draft";
import { useEditorStore } from "@/store/editor";
import { useMetadataPanelStore } from "@/store/metadata-panel";
import { saveGridLayout } from "@/app/actions/grid";

const mockUseSession = vi.fn().mockReturnValue({ data: null });

vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

const mockSetMode = vi.fn();
vi.mock("@/store/theme", () => ({
  useThemeStore: () => ({ mode: "light", setMode: mockSetMode }),
}));

// `push` is one stable spy, so a test can assert where a command sent the router.
const mockPathname = vi.fn().mockReturnValue("/");
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// Stubbed at its delegate, not the registry, so the real command table and matching are exercised.
const mockAdminLogin = vi.fn();
vi.mock("@/utils/admin-login", () => ({ adminLogin: () => mockAdminLogin() }));

vi.mock("@/app/actions/grid", () => ({
  saveGridLayout: vi.fn().mockResolvedValue(undefined),
  setPinned: vi.fn(),
  moveGridItem: vi.fn(),
  unpublishComponent: vi.fn(),
}));

vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
}));

vi.mock("@/app/actions/post", () => ({
  getDrafts: vi.fn().mockResolvedValue([]),
  getPublishedProjects: vi.fn().mockResolvedValue([]),
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deleteDraft: vi.fn(),
}));

// Query-aware: the palette asks both whether the theme is dark and whether the device has a cursor.
let hasCursor = true;
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query === HAS_CURSOR_QUERY ? hasCursor : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

/** Claim the field the shortcut's platform detection reads first. */
function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
}

// Scoped to the command list: a confirm dialog repeats one of its labels.
function list() {
  return within(document.querySelector("[cmdk-list]") as HTMLElement);
}

const CALCHEMY = "Calchemy: Natural-Language Date Parser";
const CREST_ICONS = "Crest Icons: 300+ Handcrafted SVG Icons";

afterEach(() => {
  cleanup();
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

beforeEach(() => {
  // The shortcut depends on the platform, so every test that presses it has to stub one.
  stubPlatform("macOS");
  hasCursor = true;
  mockUseSession.mockReturnValue({ data: null });
  mockPathname.mockReturnValue("/");
  mockPush.mockClear();
  mockSetMode.mockClear();
  mockPush.mockClear();
  mockAdminLogin.mockClear();

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

    it("renders the Playgrounds group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Playgrounds")).toBeDefined();
    });

    it("offers the Waveform Studio item", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Waveform Studio")).toBeDefined();
    });
  });

  describe("when logged out", () => {
    it("still offers the Playgrounds group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Playgrounds")).toBeDefined();
      expect(screen.getByText("Waveform Studio")).toBeDefined();
    });

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

    it("renders the Playgrounds group in the server render too", () => {
      const html = renderToString(<CommandPalette />);
      expect(html).toContain("Playgrounds");
      expect(html).toContain("Waveform Studio");
    });
  });

  describe("the input row, with a cursor", () => {
    it("gives the field the focus, so you can just type", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(document.activeElement).toBe(
        screen.getByPlaceholderText("Search…"),
      );
    });

    it("keeps the rows' keyboard shortcut chips", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(list().getByText("⌘/")).toBeDefined();
    });

    it("names Esc as the way out, and offers no close button", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(screen.getByText("to exit")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });
  });

  describe("the input row, on a touch device", () => {
    beforeEach(() => {
      hasCursor = false;
    });

    it("still offers the field", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(screen.getByPlaceholderText("Search…")).toBeDefined();
    });

    it("leaves the field unfocused until it is asked for", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(document.activeElement).not.toBe(
        screen.getByPlaceholderText("Search…"),
      );
    });

    it("puts a close button where the Esc hint would be", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
      expect(screen.queryByText("to exit")).toBeNull();
    });

    it("closes the palette when that button is pressed", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      const dialog = document.querySelector("dialog") as HTMLDialogElement;

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(dialog.close).toHaveBeenCalled();
    });

    it("withholds the rows' keyboard shortcut chips", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(list().getByText("Back to index")).toBeDefined();
      expect(list().queryByText("⌘/")).toBeNull();
      expect(list().queryByText("Ctrl /")).toBeNull();
    });

    it("filters on what is typed into it, as it does anywhere else", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.change(screen.getByPlaceholderText("Search…"), {
        target: { value: "waveform" },
      });

      expect(list().getByText("Waveform Studio")).toBeDefined();
      expect(list().queryByText("Dark theme")).toBeNull();
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
      expect(screen.getByText("New blog article…")).toBeDefined();
      expect(screen.getByText("New work article…")).toBeDefined();
      expect(screen.getByText("New prototype…")).toBeDefined();
    });

    it("lists a way to start each kind of post, in that order", () => {
      render(<CommandPalette />);
      const rows = list()
        .getAllByText(/^New .+…$/)
        .map((row) => row.textContent);
      expect(rows).toEqual([
        "New blog article…",
        "New work article…",
        "New prototype…",
      ]);
    });

    it.each(["/", "/about", "/writing/my-post", "/prototype/a-toy", "/vouch"])(
      "offers no metadata while %s is being read",
      (pathname) => {
        mockPathname.mockReturnValue(pathname);
        render(<CommandPalette />);
        expect(list().getByText("Edit page")).toBeDefined();
        expect(list().queryByText("Edit metadata")).toBeNull();
      },
    );
  });

  describe("New widget", () => {
    beforeEach(() => {
      useGridDraftStore.getState().reset();
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
    });

    it("is offered while the homepage is being edited", () => {
      mockPathname.mockReturnValue("/edit/home");
      render(<CommandPalette />);
      expect(list().getByText("New widget…")).toBeDefined();
    });

    it("is withheld from every other editor", () => {
      mockPathname.mockReturnValue("/edit/new");
      render(<CommandPalette />);
      expect(list().queryByText("New widget…")).toBeNull();

      cleanup();
      mockPathname.mockReturnValue("/playground/shader");
      render(<CommandPalette />);
      expect(list().queryByText("New widget…")).toBeNull();
    });

    it("is withheld from a page that is merely being read", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);
      expect(list().queryByText("New widget…")).toBeNull();
    });

    it("buffers the chosen widget instead of publishing it", async () => {
      mockPathname.mockReturnValue("/edit/home");
      render(<CommandPalette />);
      fireEvent.click(list().getByText("New widget…"));

      // The palette closes into the picker, so this is the dialog's list, not the palette's.
      fireEvent.click(await screen.findByText("Calchemy Demo"));
      fireEvent.click(screen.getByRole("button", { name: "Insert Component" }));

      expect(saveGridLayout).not.toHaveBeenCalled();
      expect(useGridDraftStore.getState().inserts).toEqual([
        expect.objectContaining({
          componentId: "calchemy-demo",
          index: null,
        }),
      ]);
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
      expect(list().getByText("This Article")).toBeDefined();
      expect(list().getByText("Dark theme")).toBeDefined();
      expect(list().getByText("Publish article")).toBeDefined();
      expect(list().getByText("Save changes")).toBeDefined();
      expect(list().getByText("Discard changes and exit")).toBeDefined();
      expect(list().queryByText("Save changes and exit")).toBeNull();
    });

    it("hides the Publish, This Page, and Drafts groups while editing", () => {
      render(<CommandPalette />);
      expect(screen.queryByText("This Page")).toBeNull();
      expect(screen.queryByText("Publish")).toBeNull();
      expect(screen.queryByText("New blog article…")).toBeNull();
      expect(list().queryByText("Edit page")).toBeNull();
    });

    it("offers the metadata sidebar, and opens it without leaving", () => {
      useMetadataPanelStore.setState({ open: false });
      render(<CommandPalette />);
      fireEvent.click(list().getByText("Edit metadata"));
      expect(useMetadataPanelStore.getState().open).toBe(true);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("names a prototype as a prototype", () => {
      useEditorStore.setState({ category: "PROTOTYPE" });
      render(<CommandPalette />);
      expect(list().getByText("This Prototype")).toBeDefined();
      expect(list().getByText("Publish prototype")).toBeDefined();
      useEditorStore.getState().reset();
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
      expect(await screen.findByText("Other Draft")).toBeDefined();
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

    it("opens for a ⌘K pressed before it hydrated", () => {
      const intentWindow = window as Window & {
        __takePaletteIntent?: () => boolean;
      };
      intentWindow.__takePaletteIntent = vi.fn().mockReturnValue(true);

      render(<CommandPalette />);

      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      expect(dialog.showModal).toHaveBeenCalledOnce();
      delete intentWindow.__takePaletteIntent;
    });

    it("stays shut when nothing was pressed before it hydrated", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
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

  describe("Waveform Studio", () => {
    it("routes to the playground and closes the palette", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(screen.getByText("Waveform Studio"));

      expect(mockPush).toHaveBeenCalledWith("/playground/shader");
      expect(dialog.close).toHaveBeenCalledOnce();
    });
  });

  describe("Calchemy", () => {
    it("is offered logged out, beside the shader one", () => {
      render(<CommandPalette />);
      expect(screen.getByText(CALCHEMY)).toBeDefined();
    });

    it("routes to the playground and closes the palette", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(screen.getByText(CALCHEMY));

      expect(mockPush).toHaveBeenCalledWith("/playground/calchemy");
      expect(dialog.close).toHaveBeenCalledOnce();
    });

    it("stops advertising itself once you are on it, and still offers the other", () => {
      mockPathname.mockReturnValue("/playground/calchemy");
      render(<CommandPalette />);

      expect(list().queryByText(CALCHEMY)).toBeNull();
      expect(list().getByText("Waveform Studio")).toBeDefined();
    });
  });

  describe("Crest Icons", () => {
    it("is offered logged out, beside the other two", () => {
      render(<CommandPalette />);
      expect(screen.getByText(CREST_ICONS)).toBeDefined();
    });

    it("routes to the playground and closes the palette", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(screen.getByText(CREST_ICONS));

      expect(mockPush).toHaveBeenCalledWith("/playground/icons");
      expect(dialog.close).toHaveBeenCalledOnce();
    });

    it("stops advertising itself once you are on it, and still offers the others", () => {
      mockPathname.mockReturnValue("/playground/icons");
      render(<CommandPalette />);

      expect(list().queryByText(CREST_ICONS)).toBeNull();
      expect(list().getByText("Waveform Studio")).toBeDefined();
      expect(list().getByText(CALCHEMY)).toBeDefined();
    });
  });

  describe("Projects", () => {
    const projects = [
      { slug: "shift-scheduling", title: "Shift Scheduling" },
      { slug: "scheduling-extensions", title: "Scheduling Extensions" },
    ];

    beforeEach(async () => {
      const { getPublishedProjects } = await import("@/app/actions/post");
      (getPublishedProjects as ReturnType<typeof vi.fn>).mockResolvedValue(
        projects,
      );
    });

    afterEach(async () => {
      const { getPublishedProjects } = await import("@/app/actions/post");
      (getPublishedProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it("lists them for a visitor, under their own heading", async () => {
      render(<CommandPalette />);
      expect(await list().findByText("Shift Scheduling")).toBeDefined();
      expect(list().getByText("Scheduling Extensions")).toBeDefined();
      expect(list().getByText("Projects")).toBeDefined();
    });

    it("goes to the project and closes the palette", async () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(await list().findByText("Shift Scheduling"));

      expect(mockPush).toHaveBeenCalledWith("/work/shift-scheduling");
      expect(dialog.close).toHaveBeenCalledOnce();
    });

    it("leaves out the project being read, and keeps the rest", async () => {
      mockPathname.mockReturnValue("/work/shift-scheduling");
      render(<CommandPalette />);
      expect(await list().findByText("Scheduling Extensions")).toBeDefined();
      expect(list().queryByText("Shift Scheduling")).toBeNull();
    });

    it("stands before the playgrounds", async () => {
      render(<CommandPalette />);
      const heading = await list().findByText("Projects");
      const playgrounds = list().getByText("Playgrounds");
      expect(
        heading.compareDocumentPosition(playgrounds) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("lists the review-criteria prototype, even with nothing published", async () => {
      const { getPublishedProjects } = await import("@/app/actions/post");
      (getPublishedProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      render(<CommandPalette />);
      await act(async () => {});
      expect(list().getByText("Projects")).toBeDefined();
      expect(list().getByText("AI application review criteria")).toBeDefined();
    });

    it("goes to the prototype and closes the palette", async () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(list().getByText("AI application review criteria"));

      expect(mockPush).toHaveBeenCalledWith(
        "/lab/ai-application-review-criteria",
      );
      expect(dialog.close).toHaveBeenCalledOnce();
    });

    it("leaves out the prototype while standing on it", async () => {
      mockPathname.mockReturnValue("/lab/ai-application-review-criteria");
      render(<CommandPalette />);
      expect(await list().findByText("Shift Scheduling")).toBeDefined();
      expect(list().queryByText("AI application review criteria")).toBeNull();
    });

    it("is withheld while editing, as every destination is", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      mockPathname.mockReturnValue("/edit/new");
      render(<CommandPalette />);
      await act(async () => {});
      expect(list().queryByText("Projects")).toBeNull();
      expect(list().queryByText("Shift Scheduling")).toBeNull();
      expect(list().queryByText("AI application review criteria")).toBeNull();
    });
  });

  describe("destinations while editing", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
    });

    it("offers the playground from a page that is merely being read", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);
      expect(list().getByText("Waveform Studio")).toBeDefined();
    });

    it("withholds it while a document is being edited", () => {
      mockPathname.mockReturnValue("/edit/new");
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("withholds it while the grid is being edited", () => {
      mockPathname.mockReturnValue("/edit/home");
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("keeps the settings group, which goes nowhere", () => {
      mockPathname.mockReturnValue("/edit/new");
      render(<CommandPalette />);
      expect(list().getByText("Settings")).toBeDefined();
    });
  });

  describe("This Preset — the playground's own exits", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/playground/shader");
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
    });

    it("offers save in place and discard-and-exit", () => {
      render(<CommandPalette />);

      expect(list().getByText("This Preset")).toBeDefined();
      expect(list().getByText("Save changes")).toBeDefined();
      expect(list().getByText("Discard changes and exit")).toBeDefined();
      expect(list().queryByText("Save changes and exit")).toBeNull();
    });

    it("stops advertising the playground once you are on it", () => {
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("hangs the platform's own ⌘S off it", () => {
      render(<CommandPalette />);

      const save = list().getByText("Save changes").closest("[cmdk-item]");
      expect(save?.textContent).toContain("⌘S");
    });

    it("is not offered logged out", () => {
      mockUseSession.mockReturnValue({ data: null });
      render(<CommandPalette />);

      expect(list().queryByText("This Preset")).toBeNull();
      expect(list().queryByText("Save changes")).toBeNull();
      expect(list().queryByText("Discard changes and exit")).toBeNull();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("is not offered on any other page", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);

      expect(screen.queryByText("This Preset")).toBeNull();
    });

    it("is offered on a saved preset's own route", () => {
      mockPathname.mockReturnValue("/playground/shader/preset-1");
      render(<CommandPalette />);

      expect(screen.getByText("This Preset")).toBeDefined();
    });
  });

  describe("the playground as a visitor", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/playground/shader");
      mockUseSession.mockReturnValue({ data: null });
    });

    it("keeps the playgrounds group, minus the page being stood on", () => {
      render(<CommandPalette />);

      expect(list().getByText("Playgrounds")).toBeDefined();
      expect(list().getByText(CALCHEMY)).toBeDefined();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("says the same on a saved preset's own route", () => {
      mockPathname.mockReturnValue("/playground/shader/preset-1");
      render(<CommandPalette />);

      expect(list().getByText(CALCHEMY)).toBeDefined();
      expect(list().queryByText("Waveform Studio")).toBeNull();
    });

    it("names the way out for what it is", () => {
      render(<CommandPalette />);

      expect(list().getByText("Back to index")).toBeDefined();
      expect(list().queryByText("Exit editor")).toBeNull();
    });

    it("withholds it all from the author, who has an editor open", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText(CALCHEMY)).toBeNull();
      expect(list().getByText("Exit editor")).toBeDefined();
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

describe("CommandPalette — Navigate", () => {
  it("offers a way back, named for where it goes", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    expect(screen.getByText("Navigate")).toBeDefined();
    expect(screen.getByText("Back to index")).toBeDefined();
  });

  it("names the index however deep the page is", () => {
    mockPathname.mockReturnValue("/writing/my-post/edit");
    render(<CommandPalette />);

    expect(screen.getByText("Back to index")).toBeDefined();
  });

  it("shows the shortcut the platform actually types beside it", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);
    expect(screen.getByText("⌘/").tagName).toBe("KBD");

    cleanup();
    stubPlatform("Windows");
    render(<CommandPalette />);
    expect(screen.getByText("Ctrl /").tagName).toBe("KBD");
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

    fireEvent.keyDown(window, { key: "/", metaKey: true });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("ignores the shortcut typed with the other platform's modifier", () => {
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

  it("offers a named way out of each editor", () => {
    mockPathname.mockReturnValue("/edit/new");
    render(<CommandPalette />);
    expect(list().getByText("Navigate")).toBeDefined();
    expect(list().getByText("Exit editor")).toBeDefined();
    expect(list().queryByText("Back to index")).toBeNull();

    cleanup();
    mockPathname.mockReturnValue("/edit/home");
    render(<CommandPalette />);
    expect(list().getByText("Exit editor")).toBeDefined();

    cleanup();
    // Signed in: the playground is an editor only for whoever can write to it.
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-id", email: "admin@example.com" } },
    });
    mockPathname.mockReturnValue("/playground/shader");
    render(<CommandPalette />);
    expect(list().getByText("Exit editor")).toBeDefined();
  });

  it("still says where it is going when you are only reading", () => {
    mockPathname.mockReturnValue("/writing/my-post");
    render(<CommandPalette />);

    expect(list().getByText("Back to index")).toBeDefined();
    expect(list().queryByText("Exit editor")).toBeNull();
  });

  it("keeps the shader playground's way out", () => {
    mockPathname.mockReturnValue("/playground/shader");
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-id", email: "admin@example.com" } },
    });
    render(<CommandPalette />);
    expect(list().getByText("Exit editor")).toBeDefined();

    cleanup();
    mockUseSession.mockReturnValue({ data: null });
    render(<CommandPalette />);
    expect(list().getByText("Back to index")).toBeDefined();
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

describe("CommandPalette — the `>` command line", () => {
  function openAndType(value: string) {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value },
    });
  }

  it("takes a leading '> ' as the way in, and says which line it is on", () => {
    openAndType("> window.adminLogin()");

    expect(list().getByText("Command")).toBeDefined();
  });

  it("waits for the space before it treats the field as a prompt", () => {
    openAndType(">");

    expect(list().queryByText("Command")).toBeNull();
  });

  it("does not take a command jammed against the marker", () => {
    openAndType(">window.adminLogin()");

    expect(list().queryByText("window.adminLogin()")).toBeNull();
  });

  it("puts the rest of the palette away — a command line is not a search", () => {
    openAndType("> window.adminLogin()");

    expect(list().queryByText("Settings")).toBeNull();
    expect(list().queryByText("Waveform Studio")).toBeNull();
  });

  it("leaves ordinary search text alone", () => {
    openAndType("waveform");

    expect(list().queryByText("Command")).toBeNull();
    expect(list().getByText("Waveform Studio")).toBeDefined();
  });

  it("recognises the console form typed out in full", () => {
    openAndType("> window.adminLogin()");

    expect(list().getByText("window.adminLogin()")).toBeDefined();
  });

  it("runs the command when its row is chosen", () => {
    openAndType("> window.adminLogin()");

    fireEvent.click(list().getByText("window.adminLogin()"));

    expect(mockAdminLogin).toHaveBeenCalledTimes(1);
  });

  it("runs it on Enter, which is the whole point of typing a command", () => {
    openAndType("> window.adminLogin()");

    fireEvent.keyDown(screen.getByPlaceholderText("Search…"), {
      key: "Enter",
    });

    expect(mockAdminLogin).toHaveBeenCalledTimes(1);
  });

  it("closes the palette on the way out", () => {
    openAndType("> window.adminLogin()");
    const dialog = document.querySelector("dialog") as HTMLDialogElement;

    fireEvent.click(list().getByText("window.adminLogin()"));

    expect(dialog.close).toHaveBeenCalled();
  });

  it("shows nothing at all for an empty line — there is no menu to open", () => {
    openAndType("> ");

    expect(list().queryByText("Command")).toBeNull();
    expect(list().queryByText("window.adminLogin()")).toBeNull();
  });

  it("does not give the name away to a partial one", () => {
    openAndType("> window.admin");

    expect(list().queryByText("window.adminLogin()")).toBeNull();
  });

  it("answers to the console form and to no shorthand of it", () => {
    for (const shorthand of [
      "adminLogin",
      "adminLogin()",
      "window.adminLogin",
    ]) {
      cleanup();
      openAndType(`> ${shorthand}`);

      expect(list().queryByText("window.adminLogin()")).toBeNull();
    }
  });

  it("answers to the console form and to no other casing of it", () => {
    openAndType("> window.adminlogin()");

    expect(list().queryByText("window.adminLogin()")).toBeNull();
  });

  it("says nothing about what was typed when nothing answers to it", () => {
    openAndType("> window.dropDatabase()");

    expect(list().queryByText(/no command/i)).toBeNull();
    expect(list().queryByText("Command")).toBeNull();
    expect(mockAdminLogin).not.toHaveBeenCalled();
  });

  it("keeps the search results out of the way even while it is blank", () => {
    openAndType("> something");

    expect(list().queryByText("Settings")).toBeNull();
  });

  it("looks exactly like a search that simply found nothing", () => {
    const seen = (value: string) => {
      openAndType(value);
      const root = document.querySelector("[cmdk-list]") as HTMLElement;
      // Text nodes, not elements: a container's `textContent` sweeps up its hidden descendants.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let text = "";
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement?.closest("[hidden]")) {
          text += node.textContent ?? "";
        }
      }
      text = text.trim();
      cleanup();
      return text;
    };

    expect(seen("zzzz")).toBe("");

    for (const value of ["> ", "> window.admin", "> adminLogin()"]) {
      expect(seen(value)).toBe("");
    }

    expect(seen("> window.adminLogin()")).toContain("window.adminLogin()");
  });

  it("is reachable by a visitor with no session at all", () => {
    openAndType("> window.adminLogin()");

    expect(list().getByText("window.adminLogin()")).toBeDefined();
    expect(list().queryByText("Edit page")).toBeNull();
  });

  it("names the key that runs it, where there is a key to name", () => {
    openAndType("> window.adminLogin()");

    expect(list().getByText("↵")).toBeDefined();
  });

  it("withholds that chip on a device that cannot press it", () => {
    hasCursor = false;
    openAndType("> window.adminLogin()");

    expect(list().getByText("window.adminLogin()")).toBeDefined();
    expect(list().queryByText("↵")).toBeNull();
  });
});
