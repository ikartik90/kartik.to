import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OffAppShiftOverlay } from "../off-app-shift";

afterEach(cleanup);

describe("OffAppShiftOverlay", () => {
  it("covers the app at Overlay/Large, as the New shift and timecard overlays do", () => {
    render(<OffAppShiftOverlay today="2026-10-14" height={800} onSave={vi.fn()} onCancel={vi.fn()} />);
    const overlay = screen.getByRole("dialog", { name: "Off-app shift timecard" });
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(overlay.className).toMatch(/\bw_var\(--sw-width-overlay-large\)/);
    expect(overlay.className).not.toMatch(/side-sheet/);
  });

  it("offers the shift's end with how long after its start each time falls", async () => {
    const user = userEvent.setup();
    render(<OffAppShiftOverlay today="2026-10-14" height={800} onSave={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: "Shift End Time" }));
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("5:00 PM +8 hours");
  });

  it("shows the worker picked on a card: their face, name and phone", async () => {
    const user = userEvent.setup();
    render(<OffAppShiftOverlay today="2026-10-14" height={800} onSave={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("combobox", { name: "Find a worker" }), "555-0196");
    await user.click(screen.getByRole("option", { name: /Tashonda Williams/ }));
    const card = screen.getByRole("heading", { name: "Tashonda Williams" }).closest("[data-card]")!;
    expect(card.querySelector("[data-avatar]")).not.toBeNull();
    expect(card.textContent).toContain("555-0196");
    expect(screen.queryByRole("cell")).toBeNull();
  });
});
