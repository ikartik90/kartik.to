// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageCard } from "../package-card";

afterEach(cleanup);

// The foot of the playground's sidebar (Figma 1383:2283): where the package
// is documented, and the line that installs it.
describe("PackageCard", () => {
  // After `userEvent.setup()`, which installs a clipboard of its own.
  function stubClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  }

  it("links to the package's documentation, in a new tab", () => {
    render(<PackageCard />);
    const link = screen.getByRole("link", { name: /package documentation/i });
    expect(link.getAttribute("href")).toBe(
      "https://www.npmjs.com/package/@calchemy/date-core",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows the install command", () => {
    render(<PackageCard />);
    expect(screen.getByText("npm i @calchemy/date-core")).toBeDefined();
  });

  it("copies the install command, and says so", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<PackageCard />);
    await user.click(
      screen.getByRole("button", { name: "Copy install command" }),
    );
    expect(writeText).toHaveBeenCalledWith("npm i @calchemy/date-core");
    expect(
      screen.getByRole("button", { name: "Copied install command" }),
    ).toBeDefined();
  });

  it("goes back to offering the copy after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubClipboard();
    render(<PackageCard />);
    await user.click(
      screen.getByRole("button", { name: "Copy install command" }),
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(
      screen.getByRole("button", { name: "Copy install command" }),
    ).toBeDefined();
    vi.useRealTimers();
  });
});
