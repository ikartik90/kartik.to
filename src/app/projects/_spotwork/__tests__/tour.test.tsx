import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOUR } from "../copy";
import { SHEET_TUNING, sheetVars } from "../sheet-tuning";
import { TourProvider, aim, useTour } from "../tour";

afterEach(() => {
  cleanup();
  delete (document as Partial<Document>).elementsFromPoint;
});

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

function Controls() {
  const tour = useTour();
  return (
    <>
      <button type="button" data-tour="open-check-in" onClick={() => tour.done("open-check-in")}>
        Check In…
      </button>
      <button type="button" data-tour="excuse-late">
        Excuse late check-in
      </button>
    </>
  );
}

function Harness({ hidden, inDialog }: { hidden?: boolean; inDialog?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root}>
      <TourProvider root={root} hidden={hidden}>
        {inDialog ? (
          <div data-scrim="">
            <div role="dialog" aria-label="Check in">
              <Controls />
            </div>
          </div>
        ) : (
          <Controls />
        )}
      </TourProvider>
      <button type="button">Elsewhere</button>
      <div role="dialog" aria-label="New shift">
        <span>New shift</span>
      </div>
      <div data-scrim="" data-testid="scrim" />
    </div>
  );
}

// The comment finds its control on the frame after it mounts.
async function setup() {
  const user = userEvent.setup();
  const { rerender } = render(<Harness />);
  await wait(50);
  const hide = (hidden: boolean) => rerender(<Harness hidden={hidden} />);
  // Named by the comment's author and its first paragraph.
  const pin = (index = 0) =>
    screen.getByRole("button", { name: (name) => name.startsWith(`Kartik Iyer ${TOUR.steps[index].body.split("\n")[0]}`) });
  return { user, pin, hide };
}

describe("the walk-through's comment", () => {
  it("shows the current step collapsed, as a pin", async () => {
    const { pin } = await setup();
    expect(pin().getAttribute("aria-expanded")).toBe("false");
  });

  it("fades out of reach and collapses while hidden, as the demo plays, and comes back after", async () => {
    const { user, pin, hide } = await setup();
    await user.click(pin());
    expect(pin().getAttribute("aria-expanded")).toBe("true");
    hide(true);
    expect(pin().closest("[inert]")).not.toBeNull();
    expect(pin().getAttribute("aria-expanded")).toBe("false");
    hide(false);
    expect(pin().closest("[inert]")).toBeNull();
  });

  it("expands while the pointer is over it", async () => {
    const { user, pin } = await setup();
    await user.hover(pin());
    expect(pin().getAttribute("aria-expanded")).toBe("true");
    await user.unhover(pin());
    await wait(250);
    expect(pin().getAttribute("aria-expanded")).toBe("false");
  });

  it("stays expanded after a click, until a click elsewhere", async () => {
    const { user, pin } = await setup();
    await user.click(pin());
    await user.unhover(pin());
    await wait(250);
    expect(pin().getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(pin().getAttribute("aria-expanded")).toBe("false");
  });

  it("expands when the keyboard reaches it", async () => {
    const { user, pin } = await setup();
    // Past the two controls, to the pin.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(pin());
    expect(pin().getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses on Escape, which the overlay passes on as `escape-layer`", async () => {
    const { user, pin } = await setup();
    await user.click(pin());
    const layer = document.querySelector("[data-escape-layer]")!;
    act(() => {
      layer.dispatchEvent(new Event("escape-layer"));
    });
    expect(pin().getAttribute("aria-expanded")).toBe("false");
  });

  it("sits on the About sheet's cards' ground, as the sheet's tuning sets it", async () => {
    await setup();
    const note = document.querySelector<HTMLElement>("[role=note]")!;
    const cards = Object.entries(sheetVars(SHEET_TUNING)).filter(([name]) => name.startsWith("--sheet-card-"));
    expect(Object.fromEntries(cards.map(([name]) => [name, note.style.getPropertyValue(name)]))).toEqual(Object.fromEntries(cards));
  });

  it("hides while a dialog its spot isn't in lies over it, and shows again once it's gone", async () => {
    const top = vi.fn<(x: number, y: number) => Element[]>(() => []);
    document.elementsFromPoint = top;
    await setup();
    const comment = document.querySelector<HTMLElement>("[data-comment]")!;
    const over = screen.getByText("New shift");
    top.mockImplementation(() => [comment, over]);
    await wait(50);
    expect(comment.style.visibility).toBe("hidden");
    top.mockImplementation(() => [screen.getByRole("button", { name: "Check In…" })]);
    await wait(50);
    expect(comment.style.visibility).toBe("");
  });

  it("hides while a modal's scrim lies over its spot", async () => {
    const top = vi.fn<(x: number, y: number) => Element[]>(() => []);
    document.elementsFromPoint = top;
    await setup();
    const comment = document.querySelector<HTMLElement>("[data-comment]")!;
    top.mockImplementation(() => [screen.getByTestId("scrim")]);
    await wait(50);
    expect(comment.style.visibility).toBe("hidden");
  });

  it("stays over a spot inside the dialog on top", async () => {
    const top = vi.fn<(x: number, y: number) => Element[]>(() => []);
    document.elementsFromPoint = top;
    render(<Harness inDialog />);
    await wait(50);
    const comment = document.querySelector<HTMLElement>("[data-comment]")!;
    top.mockImplementation(() => [screen.getByRole("button", { name: "Excuse late check-in" })]);
    await wait(50);
    expect(comment.style.visibility).toBe("");
  });

  it("starts each new step collapsed", async () => {
    const { user, pin } = await setup();
    await user.click(pin());
    await user.click(screen.getByRole("button", { name: "Check In…" }));
    expect(pin(1).getAttribute("aria-expanded")).toBe("false");
  });

  it("points the excuse comment at the spot Kartik pinned on the Excuse late check-in box", async () => {
    const { user, pin } = await setup();
    const box = screen.getByRole("button", { name: "Excuse late check-in" });
    box.getBoundingClientRect = () => new DOMRect(100, 400, 200, 20);
    await user.click(screen.getByRole("button", { name: "Check In…" }));
    await wait(50);
    // 48% across and 77% down the box.
    expect(pin(1).closest<HTMLElement>("[data-comment]")!.style.translate).toBe("196px 415px");
  });
});

describe("aim", () => {
  const bounds = new DOMRect(0, 0, 1000, 800);
  const PIN = { width: 32, height: 32 };
  const CARD = { width: 320, height: 200 };

  it("points at the control's top-right corner, pin and comment growing up and to the right", () => {
    expect(aim(new DOMRect(100, 400, 80, 30), PIN, CARD, bounds)).toEqual({
      x: 180,
      y: 400,
      pin: { across: "right", along: "up" },
      card: { across: "right", along: "up", dx: 0, dy: 0 },
    });
  });

  it("grows the comment left when it doesn't fit to the right", () => {
    const at = aim(new DOMRect(700, 400, 80, 30), PIN, CARD, bounds);
    expect(at.pin.across).toBe("right");
    expect(at.card).toMatchObject({ across: "left", dx: 0 });
  });

  it("points at the bottom-right corner, growing down, when the pin has no room above", () => {
    expect(aim(new DOMRect(100, 20, 80, 30), PIN, CARD, bounds)).toMatchObject({
      x: 180,
      y: 50,
      pin: { along: "down" },
      card: { along: "down" },
    });
  });

  it("points at the bottom-right corner when the top one has no room inside the app", () => {
    const view = new DOMRect(0, 120, 1000, 680);
    expect(aim(new DOMRect(100, 100, 80, 200), PIN, CARD, bounds, view)).toMatchObject({
      y: 300,
      pin: { along: "down" },
    });
  });

  it("grows the comment down from the pin when only the pin fits above", () => {
    expect(aim(new DOMRect(100, 120, 80, 30), PIN, CARD, bounds)).toMatchObject({
      y: 120,
      pin: { along: "up" },
      card: { along: "down", dy: 0 },
    });
  });

  it("shifts the comment back inside when it fits neither way", () => {
    const at = aim(new DOMRect(150, 400, 60, 30), PIN, CARD, new DOMRect(0, 0, 375, 800));
    // From x = 210, 194px of room on the left beats 149 on the right; the card's 320px then needs 126 back.
    expect(at.card).toMatchObject({ across: "left", dx: 126 });
  });
});
