import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Presence } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const overlay = (open: boolean, label = "Overlay") => <Presence>{open && <div role="dialog" aria-label={label} />}</Presence>;

/** One exit animation on the page, finished when `finish` is called. */
function mockExit() {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => (finish = resolve));
  const animation = { finished, effect: { getComputedTiming: () => ({ endTime: 150 }) } };
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [animation],
  });
  return () => act(async () => finish());
}

describe("an overlay leaving", () => {
  it("stays, marked closing, until its exit animation has run", async () => {
    const finish = mockExit();
    const { rerender } = render(overlay(true));
    rerender(overlay(false));
    const dialog = screen.getByRole("dialog", { name: "Overlay" });
    expect(dialog.closest("[data-closing]")).not.toBeNull();
    await finish();
    expect(screen.queryByRole("dialog")).toBeNull();
    delete (HTMLElement.prototype as { getAnimations?: unknown }).getAnimations;
  });

  it("goes at once without an exit animation", () => {
    const { rerender } = render(overlay(true));
    rerender(overlay(false));
    return act(async () => {}).then(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("comes back, no longer closing, when it opens again before it's gone", () => {
    mockExit();
    const { rerender } = render(overlay(true));
    rerender(overlay(false));
    rerender(overlay(true, "Again"));
    expect(screen.getByRole("dialog", { name: "Again" }).closest("[data-closing]")).toBeNull();
    delete (HTMLElement.prototype as { getAnimations?: unknown }).getAnimations;
  });

  it("shows nothing when nothing was ever open", () => {
    const { container } = render(overlay(false));
    expect(container.innerHTML).toBe("");
  });
});
