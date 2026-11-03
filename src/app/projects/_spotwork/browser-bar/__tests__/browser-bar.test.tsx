import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserBar } from "../browser-bar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The bar at `width`, every item shown at Safari's full width, or folded into its » menu with no room. */
function setup(width: number, history?: { back?: () => void; forward?: () => void }) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  const user = userEvent.setup();
  render(<BrowserBar url="design-system.spotwork.co" accent="blue" history={history} />);
  return { user };
}

describe("the browser bar", () => {
  it("goes back and forward with a history, each arrow dimmed with nowhere to go", async () => {
    const back = vi.fn();
    const { user } = setup(1440, { back });
    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(back).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Go Forward" }).hasAttribute("disabled")).toBe(true);
  });

  it("goes back and forward from its » menu once they're folded into it", async () => {
    const forward = vi.fn();
    const { user } = setup(0, { forward });
    await user.click(document.querySelector<HTMLElement>("[data-browser-bar-overflow]")!);
    expect(screen.getByRole("button", { name: "Go Back" }).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Go Forward" }));
    expect(forward).toHaveBeenCalledOnce();
  });

  it("draws its arrows as pictures with no history", () => {
    setup(1440);
    expect(screen.queryByRole("button", { name: "Go Back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Go Forward" })).toBeNull();
  });
});
