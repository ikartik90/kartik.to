// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandPalette } from "../command-palette";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";

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

// Stub next/navigation — pathname is controllable per test, and `push` is one
// stable spy rather than a fresh one per call so a test can assert where a
// command sent the router.
const mockPathname = vi.fn().mockReturnValue("/");
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// The one registered `>` command, stood in for at its delegate rather than at
// the registry — so the palette's tests exercise the real table and the real
// name matching, and only the redirect out of the page is withheld.
const mockAdminLogin = vi.fn();
vi.mock("@/utils/admin-login", () => ({ adminLogin: () => mockAdminLogin() }));

// Stub server actions so they never hit the network
vi.mock("@/app/actions/grid", () => ({
  publishComponent: vi.fn().mockResolvedValue("component-id"),
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
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deleteDraft: vi.fn(),
}));

// jsdom does not implement matchMedia. Query-aware, because the palette asks it
// TWO questions and they have different answers: whether the theme is dark, and
// whether this device has a cursor — the second of which decides which input row
// gets drawn. `hasCursor` is the device under test; a cursor by default, since
// that is the palette every existing test below was written against.
let hasCursor = true;
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query === HAS_CURSOR_QUERY ? hasCursor : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
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

/**
 * Queries scoped to the command LIST.
 *
 * The palette renders its confirm dialogs as siblings, and one of them answers
 * "Save changes and exit" — the same words a command elsewhere in the list
 * uses. An unscoped `getByText` matches both and throws, so a test about what
 * the palette OFFERS has to say so.
 */
function list() {
  return within(document.querySelector("[cmdk-list]") as HTMLElement);
}

afterEach(() => {
  cleanup();
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

beforeEach(() => {
  // The shortcut is ⌘K on Apple hardware and Ctrl K everywhere else, so every
  // test that presses it has to say which keyboard it is pressing it on.
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

    // The playground is the one piece of the site's making-of that anybody can
    // walk into, so it is grouped like Settings rather than like Publish: no
    // session, no route condition, always in the list.
    it("renders the Playgrounds group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Playgrounds")).toBeDefined();
    });

    it("offers the Shader Playground item", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Shader Playground")).toBeDefined();
    });
  });

  describe("when logged out", () => {
    it("still offers the Playgrounds group", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Playgrounds")).toBeDefined();
      expect(screen.getByText("Shader Playground")).toBeDefined();
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

    it("renders the Playgrounds group in the server render too", () => {
      const html = renderToString(<CommandPalette />);
      expect(html).toContain("Playgrounds");
      expect(html).toContain("Shader Playground");
    });
  });

  // -------------------------------------------------------------------------
  // The input row
  //
  // The same field on every device — what differs is whether it takes the
  // focus. On a keyboard search IS the palette: ⌘K, then type. A phone opened
  // this to TAP something, and a field that grabs focus on open answers a
  // question nobody asked by filling half the screen with a keyboard. So the
  // field is there to be tapped, and waits to be.
  // -------------------------------------------------------------------------

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

    // Esc is the way out on a keyboard, and saying so is the whole point of the
    // hint. A close button beside it would be a second door to the same room.
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

    // The whole point: the field is there to be tapped, not to arrive with a
    // keyboard already over half the screen.
    it("leaves the field unfocused until it is asked for", () => {
      render(<CommandPalette />);
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(document.activeElement).not.toBe(
        screen.getByPlaceholderText("Search…"),
      );
    });

    // There is no Esc key to name, so the row says the same thing as a control
    // that can be pressed.
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

    // A chip naming ⌘/ or Ctrl S is an offer a phone cannot take up — the same
    // reason the Esc hint gives way to a button above it.
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
        target: { value: "playground" },
      });

      expect(list().getByText("Shader Playground")).toBeDefined();
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
      expect(list().getByText("This Article")).toBeDefined();
      expect(list().getByText("Dark theme")).toBeDefined();
      expect(list().getByText("Publish article")).toBeDefined();
      // The same pair the preset and the grid get, worded identically.
      expect(list().getByText("Save changes")).toBeDefined();
      expect(list().getByText("Discard changes and exit")).toBeDefined();
      expect(list().queryByText("Save changes and exit")).toBeNull();
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

    // A press that landed before this component existed was recorded by the
    // head script; mounting is when it gets answered (see palette-intent.ts).
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

  describe("Shader Playground", () => {
    it("routes to the playground and closes the palette", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(screen.getByText("Shader Playground"));

      expect(mockPush).toHaveBeenCalledWith("/playground/shader");
      expect(dialog.close).toHaveBeenCalledOnce();
    });
  });

  // The second playground, and public on the same grounds as the first: it
  // parses a phrase in the browser and paints the days it means. Nothing is
  // read from the site and nothing is written to it.
  describe("Calchemy Playground", () => {
    it("is offered logged out, beside the shader one", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Calchemy Playground")).toBeDefined();
    });

    it("routes to the playground and closes the palette", () => {
      render(<CommandPalette />);
      const dialog = document.querySelector("dialog") as HTMLDialogElement;
      fireEvent.keyDown(window, { key: "k", metaKey: true });

      fireEvent.click(screen.getByText("Calchemy Playground"));

      expect(mockPush).toHaveBeenCalledWith("/playground/calchemy");
      expect(dialog.close).toHaveBeenCalledOnce();
    });

    // Standing on it, the row is a command to the page you are already on —
    // the rule the shader playground follows for itself. The OTHER playground
    // is still somewhere to go, so the group survives.
    it("stops advertising itself once you are on it, and still offers the other", () => {
      mockPathname.mockReturnValue("/playground/calchemy");
      render(<CommandPalette />);

      expect(list().queryByText("Calchemy Playground")).toBeNull();
      expect(list().getByText("Shader Playground")).toBeDefined();
    });
  });

  // A destination is worth offering only when going there is a thing you can
  // simply DO. Inside an editor it is not: leaving decides what becomes of the
  // buffered work, which is the same reason "Back to …" is withheld there.
  describe("destinations while editing", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
    });

    it("offers the playground from a page that is merely being read", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);
      expect(list().getByText("Shader Playground")).toBeDefined();
    });

    it("withholds it while a document is being edited", () => {
      mockPathname.mockReturnValue("/edit/new");
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    it("withholds it while the grid is being edited", () => {
      mockPathname.mockReturnValue("/edit/home");
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    // Settings is not a destination — it changes the page you are on rather
    // than taking you off it — so an editor keeps it.
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

    // Save stays put; discard is the one exit the group keeps, because
    // "abandon this" is a decision about the WORK rather than a way of
    // navigating — you are not going somewhere, you are throwing something
    // away and the leaving is a consequence. Save-and-exit is absent: that one
    // IS just navigation, and Back already offers it on the way out.
    it("offers save in place and discard-and-exit", () => {
      render(<CommandPalette />);

      expect(list().getByText("This Preset")).toBeDefined();
      expect(list().getByText("Save changes")).toBeDefined();
      expect(list().getByText("Discard changes and exit")).toBeDefined();
      expect(list().queryByText("Save changes and exit")).toBeNull();
    });

    // A command that takes you where you already are is noise. Same rule the
    // Drafts group follows in omitting the draft being viewed — the current
    // page never lists itself.
    it("stops advertising the playground once you are on it", () => {
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    // The chip has to sit on the command the key actually runs, written with
    // the modifier this platform's keyboard uses — the failure
    // `keyboard-shortcut.ts` exists to prevent is a label that lies.
    it("hangs the platform's own ⌘S off it", () => {
      render(<CommandPalette />);

      const save = list().getByText("Save changes").closest("[cmdk-item]");
      expect(save?.textContent).toContain("⌘S");
    });

    // The whole group is an admin affordance: a visitor can tune a preset all
    // they like, but there is nothing for them to save it to.
    it("is not offered logged out", () => {
      mockUseSession.mockReturnValue({ data: null });
      render(<CommandPalette />);

      expect(list().queryByText("This Preset")).toBeNull();
      expect(list().queryByText("Save changes")).toBeNull();
      expect(list().queryByText("Discard changes and exit")).toBeNull();
      // The way IN stays hidden too, and for a different reason: that rule is
      // about the ROUTE, not the session — a visitor standing on the
      // playground has no more use for a command to the playground than the
      // author does.
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    it("is not offered on any other page", () => {
      mockPathname.mockReturnValue("/writing/my-post");
      render(<CommandPalette />);

      expect(screen.queryByText("This Preset")).toBeNull();
    });

    // A saved preset is reopened by id, so the group has to be offered on that
    // route too — and it is the route where Save UPDATES rather than creates.
    it("is offered on a saved preset's own route", () => {
      mockPathname.mockReturnValue("/playground/shader/preset-1");
      render(<CommandPalette />);

      expect(screen.getByText("This Preset")).toBeDefined();
    });
  });

  // The playground is an EDITOR only for whoever can write to it. A visitor
  // moves every slider on the page and still holds nothing that could be
  // saved, so for them it is an ordinary page — and an ordinary page keeps its
  // navigation. It used to withhold the lot on the strength of the route
  // alone, which left a visitor standing on the playground with no way out
  // named for what it does and no sight of the other playground.
  describe("the playground as a visitor", () => {
    beforeEach(() => {
      mockPathname.mockReturnValue("/playground/shader");
      mockUseSession.mockReturnValue({ data: null });
    });

    it("keeps the playgrounds group, minus the page being stood on", () => {
      render(<CommandPalette />);

      expect(list().getByText("Playgrounds")).toBeDefined();
      expect(list().getByText("Calchemy Playground")).toBeDefined();
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    it("says the same on a saved preset's own route", () => {
      mockPathname.mockReturnValue("/playground/shader/preset-1");
      render(<CommandPalette />);

      expect(list().getByText("Calchemy Playground")).toBeDefined();
      expect(list().queryByText("Shader Playground")).toBeNull();
    });

    // Navigation, not finishing with something — the visitor has nothing open
    // to finish with.
    it("names the way out for what it is", () => {
      render(<CommandPalette />);

      expect(list().getByText("Back to index")).toBeDefined();
      expect(list().queryByText("Exit editor")).toBeNull();
    });

    // Unchanged for the author, who has work in hand: leaving decides what
    // becomes of it, so it is not a destination like any other.
    it("withholds it all from the author, who has an editor open", () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "admin-id", email: "admin@example.com" } },
      });
      render(<CommandPalette />);

      expect(list().queryByText("Playgrounds")).toBeNull();
      expect(list().queryByText("Calchemy Playground")).toBeNull();
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

  // The index from everywhere, however deep — the command is the way home, not
  // a step up the tree. It used to name the nearest ancestor page.
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

  // It used to be withheld here, so a bare "back" could not throw buffered work
  // away silently. Withholding it also removed "save and go", which is usually
  // what was meant — so it is offered now and it ASKS instead. And it is named
  // for what it does from an editor: you are finishing with one, not walking up
  // a path.
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
    // Signed in for this one: the playground is an editor for whoever can
    // write to it, and a visitor gets "Back to index" instead — see below.
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

  // It used to need excepting from edit mode to keep this; out of `/edit` it
  // simply is not in edit mode. The assertion stays either way — what it is
  // guarding is that the playground has a way back, not how it earns one. What
  // that way is CALLED depends on who is asking: the author is finishing with
  // an editor, the visitor is walking home from a page.
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

// ---------------------------------------------------------------------------
// The `>` line
//
// The search box doubles as a console prompt: `>` turns the field into a place
// to NAME something rather than find it. It is deliberately not an evaluator —
// nothing is parsed as JavaScript and nothing runs that was not registered — so
// what these cases pin down is the matching and the handing-over, and the fact
// that the rest of the palette gets out of the way while it is happening.
// ---------------------------------------------------------------------------

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

  // The marker alone is half a prefix. Holding off until the space arrives is
  // what keeps a search that happens to open with `>` from being hijacked into
  // a mode nobody asked for.
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
    expect(list().queryByText("Shader Playground")).toBeNull();
  });

  it("leaves ordinary search text alone", () => {
    openAndType("shader");

    expect(list().queryByText("Command")).toBeNull();
    expect(list().getByText("Shader Playground")).toBeDefined();
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

  // ---------------------------------------------------------------------
  // Hidden
  //
  // The commands are not a menu. The palette lists what a reader can DO with
  // the page in front of them; a command is something you already know the
  // name of, and the login one is the console handle the whole stealth-auth
  // arrangement rests on — a row advertising it is the visible login button
  // that arrangement exists to not have.
  //
  // So the line answers an exact name and is otherwise blank: no listing, no
  // narrowing, and no "no such command", which would confirm to anyone
  // fishing that there is something to fish for.
  // ---------------------------------------------------------------------
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

  // The strongest form of the promise, and the one worth a regression test: a
  // command line that found nothing must LOOK like an ordinary search that
  // found nothing. Anything visible that only appears in command mode is a
  // tell — it says a command mode exists and that you are in it, which is the
  // one thing a hidden command cannot afford to announce.
  //
  // Read as what a person can see rather than as markup: cmdk keeps the groups
  // a search filtered out in the DOM behind `hidden`, where this branch simply
  // does not render them, so the two are different HTML that paint the same
  // nothing. (Confirmed in Chromium: the two lists screenshot byte-identical.)
  // Neither is a secret from someone reading the bundle — `adminLogin` is a
  // global on every page — and it was never meant to be. The palette just does
  // not advertise.
  it("looks exactly like a search that simply found nothing", () => {
    const seen = (value: string) => {
      openAndType(value);
      const root = document.querySelector("[cmdk-list]") as HTMLElement;
      // Text nodes, not elements: a container's `textContent` sweeps up its
      // hidden descendants — the very thing being asked about — and a row's own
      // words are not a leaf element, they sit beside an icon and a chip.
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

    // …and the control: the one string that IS supposed to show something.
    expect(seen("> window.adminLogin()")).toContain("window.adminLogin()");
  });

  // The command exists to get you SIGNED IN, so the one visitor who must be
  // able to reach it is the one with no session — the opposite of every other
  // admin affordance in this list.
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
