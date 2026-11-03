// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOLLOW_AFTER_MS, PROJECT_INTENT_SCRIPT, takeProjectIntent } from "../project-intent";

type IntentWindow = Window & { __takeProjectIntent?: () => string | null };

/** Runs the head script as the browser would, before anything else. */
const installScript = () => window.eval(PROJECT_INTENT_SCRIPT);

/** A project's card as the homepage serves it, its link over the whole card. */
function card(id: string) {
  const host = document.body.appendChild(document.createElement("div"));
  host.setAttribute("data-sheet-card", id);
  const link = host.appendChild(document.createElement("a"));
  link.href = `/projects/${id}`;
  return link;
}

function press(target: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  const w = window as IntentWindow;
  w.__takeProjectIntent?.();
  delete w.__takeProjectIntent;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("project intent", () => {
  it("keeps a card pressed before the page is live from loading its address, and remembers it", () => {
    installScript();
    const event = press(card("check-ins"));
    expect(event.defaultPrevented).toBe(true);
    expect(takeProjectIntent()).toBe("check-ins");
  });

  it("hands the press over exactly once", () => {
    installScript();
    press(card("check-ins"));
    expect(takeProjectIntent()).toBe("check-ins");
    expect(takeProjectIntent()).toBeNull();
  });

  it("remembers the last card pressed", () => {
    installScript();
    press(card("check-ins"));
    press(card("design-system"));
    expect(takeProjectIntent()).toBe("design-system");
  });

  it("holds no press once the cards have taken over", () => {
    installScript();
    takeProjectIntent();
    expect(press(card("check-ins")).defaultPrevented).toBe(false);
    expect(takeProjectIntent()).toBeNull();
  });

  it("leaves a modified click, or another button's, to the browser", () => {
    installScript();
    const link = card("check-ins");
    expect(press(link, { metaKey: true }).defaultPrevented).toBe(false);
    expect(press(link, { button: 1 }).defaultPrevented).toBe(false);
    expect(takeProjectIntent()).toBeNull();
  });

  it("leaves any other link alone", () => {
    installScript();
    const link = document.body.appendChild(document.createElement("a"));
    link.href = "/about";
    expect(press(link).defaultPrevented).toBe(false);
    expect(takeProjectIntent()).toBeNull();
  });

  it("follows the card's link after all when the page never comes alive to take it", () => {
    installScript();
    const link = card("check-ins");
    press(link);
    const followed = vi.fn((event: MouseEvent) => event.defaultPrevented);
    document.addEventListener("click", followed);
    vi.advanceTimersByTime(FOLLOW_AFTER_MS);
    expect(followed).toHaveReturnedWith(false);
    expect(takeProjectIntent()).toBeNull();
  });

  it("follows nothing once the press is taken", () => {
    installScript();
    press(card("check-ins"));
    takeProjectIntent();
    const followed = vi.fn();
    document.addEventListener("click", followed);
    vi.advanceTimersByTime(FOLLOW_AFTER_MS);
    expect(followed).not.toHaveBeenCalled();
  });

  it("reports no press when the script never ran", () => {
    expect(takeProjectIntent()).toBeNull();
  });
});
