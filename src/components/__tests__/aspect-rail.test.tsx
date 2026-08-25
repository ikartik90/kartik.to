// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AspectRail } from "../aspect-rail";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

/** The row read left to right — labels in order, separators as pipes. */
const rail = () =>
  Array.from(screen.getByRole("toolbar").children).map((el) => {
    if (el.tagName === "BUTTON") return el.getAttribute("aria-label") ?? "?";
    const text = Array.from(el.childNodes)
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    return text ? text : "|";
  });

/** A parent that honours the pick — which is the only kind a real one is. */
function Controlled({
  aspect: initial,
  onPick,
  exitHint,
}: {
  aspect: DemoFrameAspectRatio;
  onPick?: (aspect: DemoFrameAspectRatio) => void;
  exitHint?: boolean;
}) {
  const [aspect, setAspect] = useState(initial);
  return (
    <AspectRail
      aspect={aspect}
      exitHint={exitHint}
      onPick={(next) => {
        setAspect(next);
        onPick?.(next);
      }}
    />
  );
}

describe("AspectRail", () => {
  afterEach(cleanup);

  it("offers the six landscape shapes behind the control that turns them over", () => {
    render(<Controlled aspect="16/9" />);
    expect(rail()).toEqual([
      "Switch to portrait",
      "|",
      "1:1",
      "2:1",
      "3:2",
      "4:3",
      "6:5",
      "16:9",
    ]);
  });

  it("marks the current shape as the chosen one", () => {
    render(<Controlled aspect="16/9" />);
    expect(
      screen.getByRole("button", { name: "16:9" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "4:3" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("reports the shape that was picked", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Controlled aspect="16/9" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "3:2" }));
    expect(onPick).toHaveBeenCalledWith("3/2");
  });

  // Flipping turns the CARD over with the list — flipping only the view would
  // strand the chosen shape in the orientation you just left.
  it("turns the shape over with the list", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Controlled aspect="16/9" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));

    expect(onPick).toHaveBeenCalledWith("9/16");
    expect(rail()).toEqual([
      "Switch to landscape",
      "|",
      "1:1",
      "1:2",
      "2:3",
      "3:4",
      "5:6",
      "9:16",
    ]);
  });

  // Which orientation is shown is READ from the shape rather than remembered,
  // so a rail whose shape arrives from elsewhere — a saved cover loading a tick
  // after the playground mounts — follows it instead of showing a list with
  // nothing pressed in it.
  it("follows a shape that changes from outside it", () => {
    const { rerender } = render(<AspectRail aspect="16/9" onPick={vi.fn()} />);
    expect(rail()[0]).toBe("Switch to portrait");

    rerender(<AspectRail aspect="3/4" onPick={vi.fn()} />);
    expect(rail()[0]).toBe("Switch to landscape");
    expect(
      screen.getByRole("button", { name: "3:4" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  // The square is the one shape with no other side. The list still flips, so a
  // 1:1 can be taken straight to 3:4 — but the shape itself does not change.
  it("flips the list but not a square", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Controlled aspect="1/1" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));

    expect(onPick).toHaveBeenCalledWith("1/1");
    expect(screen.getByRole("button", { name: "3:4" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "1:1" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  // The hint is for a rail that REPLACED something and has to say how to get
  // back. A permanent one has nothing to exit, and a hint about a key that does
  // nothing is worse than no hint.
  it("says how to leave only when there is somewhere to leave to", () => {
    const { rerender } = render(<AspectRail aspect="1/1" onPick={vi.fn()} />);
    expect(rail()).not.toContain("Esc to exit");

    rerender(<AspectRail aspect="1/1" onPick={vi.fn()} exitHint />);
    expect(rail().slice(-2)).toEqual(["|", "Esc to exit"]);
  });
});
