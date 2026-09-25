// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AspectRail } from "../aspect-rail";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

const rail = () =>
  Array.from(screen.getByRole("toolbar").children).map((el) => {
    if (el.tagName === "BUTTON") return el.getAttribute("aria-label") ?? "?";
    const text = Array.from(el.childNodes)
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    return text ? text : "|";
  });

function Controlled({
  aspect: initial,
  onPick,
  exitHint,
  markedAspects,
}: {
  aspect: DemoFrameAspectRatio;
  onPick?: (aspect: DemoFrameAspectRatio) => void;
  exitHint?: boolean;
  markedAspects?: readonly DemoFrameAspectRatio[];
}) {
  const [aspect, setAspect] = useState(initial);
  return (
    <AspectRail
      aspect={aspect}
      exitHint={exitHint}
      markedAspects={markedAspects}
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

  it("follows a shape that changes from outside it", () => {
    const { rerender } = render(<AspectRail aspect="16/9" onPick={vi.fn()} />);
    expect(rail()[0]).toBe("Switch to portrait");

    rerender(<AspectRail aspect="3/4" onPick={vi.fn()} />);
    expect(rail()[0]).toBe("Switch to landscape");
    expect(
      screen.getByRole("button", { name: "3:4" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

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

  it("stays in the orientation the square was picked from", async () => {
    const user = userEvent.setup();
    render(<Controlled aspect="9/16" />);
    expect(rail()[0]).toBe("Switch to landscape");

    await user.click(screen.getByRole("button", { name: "1:1" }));
    expect(rail()[0]).toBe("Switch to landscape");
    expect(screen.getByRole("button", { name: "3:4" })).toBeTruthy();
  });

  it("stays landscape when the square is picked from landscape", async () => {
    const user = userEvent.setup();
    render(<Controlled aspect="16/9" />);

    await user.click(screen.getByRole("button", { name: "1:1" }));
    expect(rail()[0]).toBe("Switch to portrait");
    expect(screen.getByRole("button", { name: "4:3" })).toBeTruthy();
  });

  it("does not let a flip made on a non-square shape decide the square's side", async () => {
    const user = userEvent.setup();
    render(<Controlled aspect="9/16" />);

    await user.click(screen.getByRole("button", { name: /switch to landscape/i }));
    expect(rail()[0]).toBe("Switch to portrait");

    await user.click(screen.getByRole("button", { name: "1:1" }));
    expect(rail()[0]).toBe("Switch to portrait");
  });

  it("says how to leave only when there is somewhere to leave to", () => {
    const { rerender } = render(<AspectRail aspect="1/1" onPick={vi.fn()} />);
    expect(rail()).not.toContain("Esc to exit");

    rerender(<AspectRail aspect="1/1" onPick={vi.fn()} exitHint />);
    expect(rail().slice(-2)).toEqual(["|", "Esc to exit"]);
  });
});

describe("AspectRail marks", () => {
  afterEach(cleanup);

  const marked = (label: string) =>
    !!screen
      .getByRole("button", { name: label })
      .querySelector("[data-unsaved]");

  it("marks nothing when nothing has been reframed", () => {
    render(<AspectRail aspect="4/3" onPick={vi.fn()} />);

    expect(marked("4:3")).toBe(false);
    expect(marked("16:9")).toBe(false);
    expect(marked("Switch to portrait")).toBe(false);
  });

  it("marks the shapes it is given, and only those", () => {
    render(
      <AspectRail aspect="4/3" onPick={vi.fn()} markedAspects={["16/9"]} />,
    );

    expect(marked("16:9")).toBe(true);
    expect(marked("4:3")).toBe(false);
    expect(marked("2:1")).toBe(false);
  });

  it("marks the shape currently chosen", () => {
    render(
      <AspectRail aspect="4/3" onPick={vi.fn()} markedAspects={["4/3"]} />,
    );

    expect(marked("4:3")).toBe(true);
  });

  it("marks the flip when the unsaved shape is on the other side", () => {
    render(
      <AspectRail aspect="4/3" onPick={vi.fn()} markedAspects={["9/16"]} />,
    );

    expect(marked("Switch to portrait")).toBe(true);
    expect(marked("16:9")).toBe(false);
  });

  it("leaves the flip unmarked when every marked shape is in the row", () => {
    render(
      <AspectRail aspect="4/3" onPick={vi.fn()} markedAspects={["16/9"]} />,
    );

    expect(marked("Switch to portrait")).toBe(false);
  });

  it("moves the marks across when the rail is turned over", async () => {
    const user = userEvent.setup();
    render(<Controlled aspect="4/3" markedAspects={["9/16"]} />);

    expect(marked("Switch to portrait")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Switch to portrait" }));

    expect(marked("9:16")).toBe(true);
    expect(marked("Switch to landscape")).toBe(false);
  });

  it("does not mark the flip for the square", () => {
    render(
      <AspectRail aspect="4/3" onPick={vi.fn()} markedAspects={["1/1"]} />,
    );

    expect(marked("1:1")).toBe(true);
    expect(marked("Switch to portrait")).toBe(false);
  });
});
