import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
import { useRestingHover } from "../use-resting-hover";

let cards: HTMLElement[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  cards = ["check-ins", "design-system"].map((project) => {
    const card = document.createElement("div");
    card.dataset.sheetCard = project;
    card.append(document.createElement("button"));
    document.body.append(card);
    return card;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const card of cards) card.remove();
  Reflect.deleteProperty(document, "elementFromPoint");
});

const move = (over: Element, synthetic = false) => {
  const event = new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: 10, clientY: 10 });
  if (synthetic) markSyntheticPointer(event);
  act(() => void over.dispatchEvent(event));
};

describe("useRestingHover", () => {
  it("is the card under the pointer as it moves", () => {
    const { result } = renderHook(() => useRestingHover(true));
    move(cards[0].querySelector("button")!);
    expect(result.current).toBe("check-ins");
    move(document.body);
    expect(result.current).toBeNull();
  });

  it("keeps the card from before while anything scrolls, and takes the one then under the pointer once all rests", () => {
    const { result } = renderHook(() => useRestingHover(true));
    move(cards[0]);
    document.elementFromPoint = () => cards[1];
    for (let t = 0; t < 300; t += 16) {
      fireEvent.scroll(document.body);
      move(cards[1]);
      act(() => vi.advanceTimersByTime(16));
    }
    expect(result.current).toBe("check-ins");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("design-system");
  });

  it("isn't moved by a demo's pointer", () => {
    const { result } = renderHook(() => useRestingHover(true));
    move(cards[1], true);
    expect(result.current).toBeNull();
  });

  it("is none without a cursor", () => {
    const { result } = renderHook(() => useRestingHover(false));
    move(cards[0]);
    expect(result.current).toBeNull();
  });
});
