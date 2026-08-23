// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardPropertiesPanel } from "../card-properties-panel";

afterEach(cleanup);

const logPanel = () => screen.queryByRole("group", { name: "Log output" });

describe("CardPropertiesPanel", () => {
  it("gathers the card's properties under one dialog", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Card properties" }),
    ).toBeDefined();
  });

  // A post, or a demo the registry does not log: there is nothing to show or
  // hide, and a control that only ever says "Hide" over a card with no log
  // output would be describing something that is not there.
  it("offers no log control to a card that cannot log", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(logPanel()).toBeNull();
  });

  // The panel opens on every card, including the ones whose properties are
  // still to be specified — so the near-empty state has to SAY it is empty
  // rather than looking like a panel that failed to load.
  it("says so when the card has no properties yet", () => {
    render(<CardPropertiesPanel onDismiss={vi.fn()} />);
    expect(screen.getByText(/no properties/i)).toBeDefined();
  });

  it("offers show and hide to a card that logs", () => {
    render(
      <CardPropertiesPanel
        logger={{ shown: true, onShownChange: vi.fn() }}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      within(logPanel()!)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Show", "Hide"]);
    expect(screen.queryByText(/no properties/i)).toBeNull();
  });

  // The control reports the card's CURRENT state, so a demo whose panel is
  // already hidden opens on "Hide" rather than on the registry's default.
  it("reads the state the card is in", () => {
    render(
      <CardPropertiesPanel
        logger={{ shown: false, onShownChange: vi.fn() }}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      within(logPanel()!)
        .getByRole("option", { name: "Hide" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  // Live, like every control in the media panel: there is no apply step, so
  // what is on the card is always what the panel says.
  it("hides the log output on the press", async () => {
    const user = userEvent.setup();
    const onShownChange = vi.fn();
    render(
      <CardPropertiesPanel
        logger={{ shown: true, onShownChange }}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(within(logPanel()!).getByRole("option", { name: "Hide" }));
    expect(onShownChange).toHaveBeenCalledWith(false);
  });

  it("shows the log output again on the press back", async () => {
    const user = userEvent.setup();
    const onShownChange = vi.fn();
    render(
      <CardPropertiesPanel
        logger={{ shown: false, onShownChange }}
        onDismiss={vi.fn()}
      />,
    );
    await user.click(within(logPanel()!).getByRole("option", { name: "Show" }));
    expect(onShownChange).toHaveBeenCalledWith(true);
  });
});
