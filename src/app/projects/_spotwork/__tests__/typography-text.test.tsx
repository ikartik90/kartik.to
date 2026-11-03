import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckInsApp, type Page } from "../check-ins-app";
import { CATEGORIES } from "../design-system";
import { shiftStart } from "../data";

afterEach(cleanup);

/** Each piece of text in `root` that no `Typography` sets, as its words and the element holding it. */
function untyped(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const words = node.textContent!.trim();
    const parent = node.parentElement!;
    if (!words || parent.closest("[data-typography], svg, style, script")) continue;
    found.push(`${parent.tagName.toLowerCase()}: ${words.slice(0, 40)}`);
  }
  return found;
}

const STORIES = CATEGORIES.flatMap((category) => category.stories);

describe("every piece of text is set by a Typography", () => {
  it.each(STORIES.map((story) => [story.id, story] as const))("in %s's examples", (_, story) => {
    for (const example of story.examples) {
      const { container, unmount } = render(<>{example.render()}</>);
      expect(untyped(container), example.title ?? "(default)").toEqual([]);
      unmount();
    }
  });

  const PAGES: Page[] = ["check-ins", "shifts", "templates", "timesheets", "dashboard", "activations", "presets"];
  it.each(PAGES)("on the app's %s page", (page) => {
    const { container } = render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={page} />);
    expect(untyped(container)).toEqual([]);
  });
});
