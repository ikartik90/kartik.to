import { cleanup, render, screen } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFlip } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect;

function Probe() {
  const anchor = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const side = useFlip(anchor, popover, true);
  return (
    <div ref={anchor} data-testid="anchor">
      <div ref={popover} data-testid="popover" data-side={side} />
    </div>
  );
}

/** The anchor 40 tall near the view's foot, its popover 200 tall: no room under it in the view, plenty over it. */
function place(room?: DOMRect) {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const id = (this as HTMLElement).dataset.testid;
    if (id === "anchor") return rect(window.innerHeight - 100, 40);
    if (id === "popover") return rect(0, 200);
    if (id === "room" && room) return room;
    return original.call(this);
  });
}

const sideOf = () => screen.getByTestId("popover").dataset.side;

describe("useFlip", () => {
  it("hangs a popover over its anchor where the view has no room for it below", () => {
    place();
    render(<Probe />);
    expect(sideOf()).toBe("above");
  });

  it("keeps it below where what holds it keeps room for it there, though the view cuts it off", () => {
    place(rect(0, window.innerHeight + 300));
    const Room = ({ children }: { children: ReactNode }) => (
      <div data-testid="room" data-popover-room="">
        {children}
      </div>
    );
    render(
      <Room>
        <Probe />
      </Room>,
    );
    expect(sideOf()).toBe("below");
  });

  it("keeps it below in the room kept for it, though the room falls short of it", () => {
    place(rect(0, window.innerHeight - 50));
    render(
      <div data-testid="room" data-popover-room="">
        <Probe />
      </div>,
    );
    expect(sideOf()).toBe("below");
  });
});
