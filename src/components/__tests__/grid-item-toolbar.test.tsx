// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GridItemToolbar } from "../grid-item-toolbar";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

const handlers = () => ({
  onTogglePin: vi.fn(),
  onMoveBack: vi.fn(),
  onMoveForward: vi.fn(),
  onAddColumn: vi.fn(),
  onRemoveColumn: vi.fn(),
  onAspectChange: vi.fn(),
  onToggleProperties: vi.fn(),
});

const base = { aspect: "16/9" as const };

// `aspect` is controlled: a `vi.fn()` parent would test a card that ignores its own toolbar.
function ControlledToolbar({
  aspect: initial,
  onAspectChange,
}: {
  aspect: DemoFrameAspectRatio;
  onAspectChange?: (aspect: DemoFrameAspectRatio) => void;
}) {
  const [aspect, setAspect] = useState(initial);
  return (
    <GridItemToolbar
      {...handlers()}
      pinned={false}
      aspect={aspect}
      onAspectChange={(next) => {
        setAspect(next);
        onAspectChange?.(next);
      }}
    />
  );
}

const rail = () =>
  Array.from(screen.getByRole("toolbar").children).map((el) => {
    if (el.tagName === "BUTTON") return el.getAttribute("aria-label") ?? "?";
    // Child by child: the hint's two spans are adjacent, so `textContent` would read "Escto exit".
    const text = Array.from(el.childNodes)
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    return text ? text : "|";
  });

describe("GridItemToolbar", () => {
  afterEach(cleanup);

  it("offers pin and, once pinned, the two moves", () => {
    render(<GridItemToolbar {...base} pinned {...handlers()} />);
    expect(screen.getByRole("button", { name: /pin/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /move back/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /move forward/i })).toBeTruthy();
  });

  it("reports the pinned state on the pin control itself", () => {
    const { rerender } = render(
      <GridItemToolbar {...base} pinned={false} {...handlers()} />,
    );
    expect(
      screen.getByRole("button", { name: /pin/i }).getAttribute("aria-pressed"),
    ).toBe("false");

    rerender(<GridItemToolbar {...base} pinned {...handlers()} />);
    expect(
      screen.getByRole("button", { name: /pin/i }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("offers no moves until the card is pinned", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(screen.queryByRole("button", { name: /move back/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /move forward/i })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("enables the moves once pinned", () => {
    render(<GridItemToolbar {...base} pinned {...handlers()} />);
    expect(
      screen.getByRole("button", { name: /move back/i }).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: /move forward/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("stops a pinned card moving past either end", () => {
    render(
      <GridItemToolbar {...base} pinned canMoveBack={false} canMoveForward {...handlers()} />,
    );
    expect(
      screen.getByRole("button", { name: /move back/i }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: /move forward/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("hides unpublish unless the card is one that can be unpublished", () => {
    const { rerender } = render(
      <GridItemToolbar {...base} pinned={false} {...handlers()} />,
    );
    expect(screen.queryByRole("button", { name: /unpublish/i })).toBeNull();

    rerender(
      <GridItemToolbar {...base} pinned={false} onUnpublish={vi.fn()} {...handlers()} />,
    );
    expect(screen.getByRole("button", { name: /unpublish/i })).toBeTruthy();
  });

  it("calls back when a control is pressed", async () => {
    const user = userEvent.setup();
    const h = handlers();
    const onUnpublish = vi.fn();
    render(<GridItemToolbar {...base} pinned onUnpublish={onUnpublish} {...h} />);

    await user.click(screen.getByRole("button", { name: /pin/i }));
    await user.click(screen.getByRole("button", { name: /move back/i }));
    await user.click(screen.getByRole("button", { name: /move forward/i }));
    await user.click(screen.getByRole("button", { name: /unpublish/i }));

    expect(h.onTogglePin).toHaveBeenCalledOnce();
    expect(h.onMoveBack).toHaveBeenCalledOnce();
    expect(h.onMoveForward).toHaveBeenCalledOnce();
    expect(onUnpublish).toHaveBeenCalledOnce();
  });

  it("does not fire a move that is disabled", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned canMoveBack={false} {...h} />);
    await user.click(screen.getByRole("button", { name: /move back/i }));
    expect(h.onMoveBack).not.toHaveBeenCalled();
  });

  it("still offers unpublish on an unpinned component", () => {
    render(
      <GridItemToolbar {...base} pinned={false} onUnpublish={vi.fn()} {...handlers()} />,
    );
    expect(screen.getByRole("button", { name: /unpublish/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /move back/i })).toBeNull();
  });

  it("lays the rail out in its four groups", () => {
    render(<GridItemToolbar {...base} pinned onUnpublish={vi.fn()} {...handlers()} />);
    expect(rail()).toEqual([
      "Pin",
      "|",
      "Move back",
      "Move forward",
      "|",
      "Aspect ratio",
      "Add column",
      "Remove column",
      "|",
      "Customize",
      "|",
      "Unpublish",
    ]);
  });

  it("keeps the shape group together on the barest toolbar there is", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(rail()).toEqual([
      "Pin",
      "|",
      "Aspect ratio",
      "Add column",
      "Remove column",
      "|",
      "Customize",
    ]);
  });

  it("reports the open panel on the customize control itself", () => {
    const { rerender } = render(
      <GridItemToolbar {...base} pinned={false} {...handlers()} />,
    );
    expect(
      screen
        .getByRole("button", { name: /customize/i })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    rerender(
      <GridItemToolbar {...base} pinned={false} propertiesOpen {...handlers()} />,
    );
    expect(
      screen
        .getByRole("button", { name: /customize/i })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("asks for the panel when customize is pressed", async () => {
    const user = userEvent.setup();
    const fns = handlers();
    render(<GridItemToolbar {...base} pinned={false} {...fns} />);
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(fns.onToggleProperties).toHaveBeenCalledOnce();
  });

  it("marks customize as the panel's own trigger", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(
      screen
        .getByRole("button", { name: /customize/i })
        .hasAttribute("data-properties-trigger"),
    ).toBe(true);
  });

  it("offers the width controls on an unpinned card", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(screen.getByRole("button", { name: /add column/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove column/i })).toBeTruthy();
  });

  it("widens and narrows on press", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned={false} {...h} />);

    await user.click(screen.getByRole("button", { name: /add column/i }));
    await user.click(screen.getByRole("button", { name: /remove column/i }));

    expect(h.onAddColumn).toHaveBeenCalledOnce();
    expect(h.onRemoveColumn).toHaveBeenCalledOnce();
  });

  it("stops a card widening past the grid", () => {
    render(
      <GridItemToolbar {...base} pinned={false} canAddColumn={false} {...handlers()} />,
    );
    expect(
      screen.getByRole("button", { name: /add column/i }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: /remove column/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("stops a card narrowing below one column", () => {
    render(
      <GridItemToolbar {...base} pinned={false} canRemoveColumn={false} {...handlers()} />,
    );
    expect(
      screen
        .getByRole("button", { name: /remove column/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not fire a width change that is disabled", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned={false} canRemoveColumn={false} {...h} />);
    await user.click(screen.getByRole("button", { name: /remove column/i }));
    expect(h.onRemoveColumn).not.toHaveBeenCalled();
  });

  const enterAspect = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: /^aspect ratio$/i }));

  it("swaps the placement rail for the shape picker", async () => {
    const user = userEvent.setup();
    render(<GridItemToolbar {...base} pinned onUnpublish={vi.fn()} {...handlers()} />);

    await enterAspect(user);

    expect(rail()).toEqual([
      "Switch to portrait",
      "|",
      "1:1",
      "2:1",
      "3:2",
      "4:3",
      "6:5",
      "16:9",
      "|",
      "Esc to exit",
    ]);
    expect(screen.queryByRole("button", { name: /^pin$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add column/i })).toBeNull();
  });

  it("marks the card's current shape as the chosen one", async () => {
    const user = userEvent.setup();
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    await enterAspect(user);
    expect(
      screen.getByRole("button", { name: "16:9" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "4:3" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("reports the shape that was picked", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned={false} {...h} />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: "3:2" }));
    expect(h.onAspectChange).toHaveBeenCalledWith("3/2");
  });

  it("stays open after a shape is picked", async () => {
    const user = userEvent.setup();
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: "3:2" }));
    expect(screen.getByRole("button", { name: "6:5" })).toBeTruthy();
  });

  it("leaves on Escape", async () => {
    const user = userEvent.setup();
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    await enterAspect(user);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /^pin$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "16:9" })).toBeNull();
  });

  it("flips the whole list to the portrait counterparts", async () => {
    const user = userEvent.setup();
    render(<ControlledToolbar aspect="16/9" />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));

    expect(rail()).toEqual([
      "Switch to landscape",
      "|",
      "1:1",
      "1:2",
      "2:3",
      "3:4",
      "5:6",
      "9:16",
      "|",
      "Esc to exit",
    ]);
  });

  it("turns the card over when the orientation is flipped", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned={false} {...h} />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));
    expect(h.onAspectChange).toHaveBeenCalledWith("9/16");
  });

  it("flips the list but not a square card", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar aspect="1/1" pinned={false} {...h} />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));

    expect(h.onAspectChange).toHaveBeenCalledWith("1/1");
    expect(screen.getByRole("button", { name: "3:4" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "1:1" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("opens on the orientation the card is already in", async () => {
    const user = userEvent.setup();
    render(<GridItemToolbar aspect="3/4" pinned={false} {...handlers()} />);
    await enterAspect(user);
    expect(rail()[0]).toBe("Switch to landscape");
    expect(
      screen.getByRole("button", { name: "3:4" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
