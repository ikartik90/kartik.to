// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { ProgressBar } from "../progress-bar";

afterEach(() => cleanup());

describe("ProgressBar", () => {
  it("exposes progressbar semantics with the current value", () => {
    render(<ProgressBar value={42} label="Loading thing" />);
    const bar = screen.getByRole("progressbar", { name: "Loading thing" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("clamps values outside 0–100 for the fill width and aria", () => {
    const { rerender } = render(<ProgressBar value={-20} />);
    let bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("0%");

    rerender(<ProgressBar value={140} />);
    bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("100%");
  });
});
