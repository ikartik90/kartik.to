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

/** The placement rail's default props — every test needs a current shape. */
const base = { aspect: "16/9" as const };

/**
 * The toolbar with a parent that actually honours `onAspectChange`.
 *
 * The shape is a CONTROLLED prop — the card owns it — so anything about what
 * the picker shows AFTER a press has to be tested against a parent that feeds
 * the new shape back. Rendering with a `vi.fn()` there tests a card that
 * ignores its own toolbar, which is not a card that exists.
 */
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

/**
 * The rail read left to right — each control by its label, each separator as a
 * pipe. Asserting on this rather than on the buttons alone is the only way to
 * pin down ORDER and grouping, which is what the design actually specifies.
 */
const rail = () =>
  Array.from(screen.getByRole("toolbar").children).map((el) => {
    if (el.tagName === "BUTTON") return el.getAttribute("aria-label") ?? "?";
    // Anything else is either a separator (an empty span) or the Esc hint.
    // Read the hint child by child and rejoin with a space: its two spans are
    // adjacent in the markup and spaced by the rail's flex gap, so a plain
    // `textContent` would run them together as "Escto exit".
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

  // A card has no position to move until it has been pinned, so the moves are
  // not offered at all — an unpinned card's toolbar is the pin alone.
  it("offers no moves until the card is pinned", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(screen.queryByRole("button", { name: /move back/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /move forward/i })).toBeNull();
    // Pin, plus the shape group and customize — none of which is a placement control.
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

  // Unpublish is a component's control. An article is unpublished from its own
  // page, so the card for one must not offer a second route to it.
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

  // Unpublish is a component's control, not a placement one, so it survives an
  // unpinned card losing its moves.
  it("still offers unpublish on an unpinned component", () => {
    render(
      <GridItemToolbar {...base} pinned={false} onUnpublish={vi.fn()} {...handlers()} />,
    );
    expect(screen.getByRole("button", { name: /unpublish/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /move back/i })).toBeNull();
  });

  // --- Shape: aspect ratio and column span ---------------------------------

  // Four groups, in this order (Figma 978:1941): the pin; the moves; the SHAPE
  // group — aspect ratio and the width pair, which together answer "what size
  // and shape is this card"; and unpublish on its own at the end, because
  // retiring a card is not a layout edit and should not sit among them.
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

  // --- Customize -----------------------------------------------------------
  //
  // Everything about the card the rail cannot say in icons — for a logging
  // component, whether its log output is on show — is edited in the docked
  // panel, and this is the one control that opens it. Every card carries it:
  // what a card's properties ARE differs by kind, but that it has some does
  // not.

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

  // The panel dismisses itself on a press outside, and its own trigger is
  // outside it — so without this exemption the second press would close the
  // panel and immediately reopen it, which reads as the button doing nothing.
  it("marks customize as the panel's own trigger", () => {
    render(<GridItemToolbar {...base} pinned={false} {...handlers()} />);
    expect(
      screen
        .getByRole("button", { name: /customize/i })
        .hasAttribute("data-properties-trigger"),
    ).toBe(true);
  });

  // A card's width has nothing to do with its seat, so unlike the moves these
  // are offered whether or not it has been pinned.
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

  // Disabled rather than absent, which is the opposite of the moves' rule and
  // deliberately so: a card at full width can still be narrowed and one at a
  // single column can still be widened, so the pair is never inapplicable —
  // only one end of it is momentarily unavailable, and a control that vanished
  // at the ends would make the rail change width as you resize.
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

  // --- Aspect ratio: the rail's second face --------------------------------
  //
  // Pressing "Aspect ratio" replaces the whole rail with a shape picker, the
  // same metamorphosis the selection toolbar performs when you add a link. The
  // rail is one box that changes what it holds, not two boxes that swap.

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
    // Nothing from the placement rail survives — it is a replacement, not an
    // extra row bolted on.
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

  // Picking does not close the picker: you try shapes against the card until
  // one looks right, and a rail that shut after every press would make that
  // three clicks per attempt instead of one.
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

  // --- Orientation ---------------------------------------------------------

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

  // Flipping the view flips the CARD too — that is the whole use of the
  // control, and it is also what keeps the pressed shape visible instead of
  // stranding the selection in the list you just left.
  it("turns the card over when the orientation is flipped", async () => {
    const user = userEvent.setup();
    const h = handlers();
    render(<GridItemToolbar {...base} pinned={false} {...h} />);
    await enterAspect(user);
    await user.click(screen.getByRole("button", { name: /switch to portrait/i }));
    expect(h.onAspectChange).toHaveBeenCalledWith("9/16");
  });

  // The square has no other side. The list still flips, so a 1:1 card can be
  // taken straight to 3:4 — but nothing about the card itself changes yet.
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

  // A portrait card opens the picker on the portrait list, so the shape it
  // already has is the one on screen rather than one flip away.
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
