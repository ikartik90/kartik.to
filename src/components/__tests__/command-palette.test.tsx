// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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

// Stub next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Stub server actions so they never hit the network
vi.mock("@/app/actions/post", () => ({
  getDrafts: vi.fn().mockResolvedValue([]),
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
  publishPost: vi.fn(),
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

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockUseSession.mockReturnValue({ data: null });
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
      expect(screen.getByText("Switch to dark theme")).toBeDefined();
    });

    it("shows 'Switch to dark theme' when in light mode (default)", () => {
      render(<CommandPalette />);
      expect(screen.getByText("Switch to dark theme")).toBeDefined();
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
      expect(screen.getByText("New page…")).toBeDefined();
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

      const item = screen.getByText("Switch to dark theme");
      fireEvent.click(item);

      expect(dialog.close).toHaveBeenCalledOnce();
    });
  });
});
