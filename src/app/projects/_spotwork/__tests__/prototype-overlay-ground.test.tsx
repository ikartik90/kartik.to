import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NAV, SIDEBAR } from "../copy";
import { PrototypeOverlay, type OverlayHandle } from "../prototype-overlay";

// jsdom has no WebGL for the sky.
vi.mock("../sky", () => ({ Sky: () => null }));

// The prototype's code, arrived or not.
let liveApp: Record<string, unknown> | undefined;
vi.mock("../use-live-app", () => ({ useLiveApp: () => liveApp }));
beforeEach(() => (liveApp = undefined));

// jsdom ships no `<dialog>` behaviour.
beforeAll(() => {
  // jsdom has no document timeline, which the veil's fade is timed on.
  Object.defineProperty(document, "timeline", { value: { currentTime: 0 }, configurable: true });
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

// Stand-ins for the overlay's animations, each under way until the test finishes it.
let moving: Animation[] = [];
function animate(this: Element) {
  let end!: () => void;
  const finished = new Promise<Animation>((resolve) => (end = () => resolve(animation)));
  const animation = { finished, finish: () => end(), cancel: () => {}, pause: () => {} } as unknown as Animation;
  moving.push(animation);
  return animation;
}
const finishMoving = () => act(async () => moving.splice(0).forEach((animation) => animation.finish()));

beforeEach(() => {
  moving = [];
  HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  // jsdom can't style the backdrop, and says so.
  const styleOf = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) => styleOf(el));
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  vi.restoreAllMocks();
});

describe("the prototype overlay", () => {
  it("stays open on a press on the shader round the window, and closes from its Close once its closing has played", async () => {
    const onClose = vi.fn();
    render(<PrototypeOverlay open onClose={onClose} themeClassName="" />);
    const stage = document.querySelector<HTMLElement>("[data-tour-bounds]")!;
    fireEvent.click(stage);
    fireEvent.click(stage.firstElementChild!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(stage).getByRole("button", { name: "Close" }));
    expect(moving.length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
    await finishMoving();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape once its closing has played, however often it's pressed", async () => {
    const onClose = vi.fn();
    render(<PrototypeOverlay open onClose={onClose} themeClassName="" />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    const closing = moving.length;
    expect(closing).toBeGreaterThan(0);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(moving.length).toBe(closing);
    expect(onClose).not.toHaveBeenCalled();
    await finishMoving();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from its handle as from its Close, once its closing has played", async () => {
    const onClose = vi.fn();
    const ref = createRef<OverlayHandle>();
    render(<PrototypeOverlay ref={ref} open onClose={onClose} themeClassName="" />);
    act(() => ref.current!.close());
    expect(onClose).not.toHaveBeenCalled();
    await finishMoving();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tells whoever opened it each project it shows, from the one it opens on", () => {
    const onProject = vi.fn();
    render(
      <PrototypeOverlay open onClose={() => {}} themeClassName="" initial={{ project: "check-ins" }} onProject={onProject} />,
    );
    expect(onProject).toHaveBeenLastCalledWith("check-ins");
    const nav = screen.getByRole("navigation", { name: NAV.label });
    fireEvent.click(within(nav).getByRole("button", { name: "Design system" }));
    expect(onProject).toHaveBeenLastCalledWith("design-system");
  });

  it("opens on the projects' menu below the window, held open until the first press, key or scroll in it", () => {
    for (const interact of [
      (node: Element) => fireEvent.pointerDown(node),
      (node: Element) => fireEvent.keyDown(node, { key: "Tab" }),
      (node: Element) => fireEvent.wheel(node),
    ]) {
      const { unmount } = render(<PrototypeOverlay open onClose={() => {}} themeClassName="" />);
      const nav = screen.getByRole("navigation", { name: NAV.label });
      expect(nav.hasAttribute("data-expanded")).toBe(true);
      act(() => interact(document.querySelector("[data-tour-bounds]")!));
      expect(nav.hasAttribute("data-expanded")).toBe(false);
      unmount();
    }
  });

  describe("with room for its window", () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1440);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(900);
    });

    it("draws the browser's frame, the dock and About before the prototype's code arrives, the page under the bar veiled", () => {
      render(<PrototypeOverlay open onClose={() => {}} themeClassName="" initial={{ project: "check-ins" }} />);
      const frame = document.querySelector("[data-overlay-motion=window]")!;
      expect(frame.textContent).toContain("dashboard.spotwork.co");
      expect(frame.querySelector("[data-app-veil]")).not.toBeNull();
      expect(screen.getByRole("navigation", { name: NAV.label })).toBeTruthy();
      expect(screen.getAllByRole("button", { name: SIDEBAR.open }).length).toBeGreaterThan(0);
    });

    it("draws the design system's bar too, until its site brings its own", () => {
      render(<PrototypeOverlay open onClose={() => {}} themeClassName="" initial={{ project: "design-system" }} />);
      const frame = document.querySelector("[data-overlay-motion=window]")!;
      expect(frame.textContent).toContain("design-system.spotwork.co");
    });

    it("fades the page's veil off once the app arrives", async () => {
      const { rerender } = render(
        <PrototypeOverlay open onClose={() => {}} themeClassName="" initial={{ project: "check-ins" }} />,
      );
      liveApp = {
        CheckInsApp: () => <main data-testid="app" />,
        GeoContext: ({ children }: { children: ReactNode }) => children,
        demoOf: () => undefined,
        demoFencesOf: () => undefined,
      };
      rerender(<PrototypeOverlay open onClose={() => {}} themeClassName="x" initial={{ project: "check-ins" }} />);
      expect(screen.getByTestId("app")).toBeTruthy();
      expect(document.querySelector("[data-app-veil]")).not.toBeNull();
      await finishMoving();
      expect(document.querySelector("[data-app-veil]")).toBeNull();
    });
  });
});
