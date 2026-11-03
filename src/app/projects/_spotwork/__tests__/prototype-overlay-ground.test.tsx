import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NAV } from "../copy";
import { PrototypeOverlay, type OverlayHandle } from "../prototype-overlay";

// jsdom has no WebGL for the sky.
vi.mock("../sky", () => ({ Sky: () => null }));

// jsdom ships no `<dialog>` behaviour.
beforeAll(() => {
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
  const animation = { finished, finish: () => end(), cancel: () => {} } as unknown as Animation;
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
});
