import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES } from "../design-system";
import { exampleName, fileOf } from "../ds-code";
import { DsStory } from "../ds-story";

afterEach(cleanup);

describe.each(CATEGORIES.map((category) => [category.label, category.stories] as const))("the %s page's examples", (_, stories) => {
  it.each(stories.map((story) => [story.id, story] as const))("%s: the first untitled, the rest each a property", (_, story) => {
    expect(story.examples.length).toBeGreaterThan(0);
    const titles = story.examples.map((example) => example.title);
    expect(titles.slice(1).every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(stories.map((story) => [story.id, story] as const))("%s: shows props only, never a part left in or out", (_, story) => {
    const titles = story.examples.map((example) => example.title ?? "");
    expect(titles.filter((title) => /^(Has|Can) /.test(title))).toEqual([]);
  });

  it.each(stories.map((story) => [story.id, story] as const))("%s: each works by itself, with no handlers in its code", (_, story) => {
    const error = vi.spyOn(console, "error");
    render(<DsStory story={story} />);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
    for (const example of story.examples) {
      const code = fileOf(exampleName(story.id, example.title), example.render());
      expect(code, example.title).not.toContain("() => {}");
      // Pictures of people come from the store, not files.
      expect(code, example.title).not.toMatch(/from "@\/assets\/.*\.(png|jpe?g)"/);
    }
  });
});
