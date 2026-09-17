import { describe, it, expect } from "vitest";
import {
  getEditUrl,
  getPostMarkdownUrl,
  getPostReadUrl,
  parsePostReadUrl,
} from "../post-urls";

describe("getPostReadUrl", () => {
  it("returns /writing/slug for ARTICLE", () => {
    expect(getPostReadUrl("ARTICLE", "my-post")).toBe("/writing/my-post");
  });

  it("returns /work/slug for WORK", () => {
    expect(getPostReadUrl("WORK", "my-project")).toBe("/work/my-project");
  });

  it("returns /prototype/slug for PROTOTYPE", () => {
    expect(getPostReadUrl("PROTOTYPE", "a-toy")).toBe("/prototype/a-toy");
  });

  it("returns /slug for PAGE", () => {
    expect(getPostReadUrl("PAGE", "about")).toBe("/about");
  });

  // The homepage's record is called `home`, and `/home` is nothing.
  it("returns / for the homepage's record", () => {
    expect(getPostReadUrl("PAGE", "home")).toBe("/");
  });
});

describe("parsePostReadUrl", () => {
  it("names the post an article or project address reads", () => {
    expect(parsePostReadUrl("/writing/my-post")).toEqual({
      category: "ARTICLE",
      slug: "my-post",
    });
    expect(parsePostReadUrl("/work/my-project")).toEqual({
      category: "WORK",
      slug: "my-project",
    });
  });

  it("names the About page and the homepage", () => {
    expect(parsePostReadUrl("/about")).toEqual({
      category: "PAGE",
      slug: "about",
    });
    expect(parsePostReadUrl("/")).toEqual({ category: "PAGE", slug: "home" });
  });

  it("is null for anything that is not a post's address", () => {
    expect(parsePostReadUrl("/writing")).toBeNull();
    expect(parsePostReadUrl("/writing/a/b")).toBeNull();
    expect(parsePostReadUrl("/playground/shader")).toBeNull();
    expect(parsePostReadUrl("/vouch")).toBeNull();
    expect(parsePostReadUrl("/edit/my-post")).toBeNull();
  });

  it("round-trips every address getPostReadUrl writes", () => {
    for (const [category, slug] of [
      ["ARTICLE", "a"],
      ["WORK", "b"],
      ["PROTOTYPE", "c"],
      ["PAGE", "about"],
      ["PAGE", "home"],
    ] as const) {
      expect(parsePostReadUrl(getPostReadUrl(category, slug))).toEqual({
        category,
        slug,
      });
    }
  });
});

describe("getPostMarkdownUrl", () => {
  it("is the post's own address with .md on the end", () => {
    expect(getPostMarkdownUrl("WORK", "my-project")).toBe(
      "/work/my-project.md",
    );
    expect(getPostMarkdownUrl("ARTICLE", "my-post")).toBe("/writing/my-post.md");
  });
});

describe("getEditUrl", () => {
  it("returns /edit/new with category for new drafts", () => {
    expect(getEditUrl("ARTICLE")).toBe("/edit/new?category=ARTICLE");
    expect(getEditUrl("WORK")).toBe("/edit/new?category=WORK");
  });

  it("returns /edit/slug with category for existing drafts", () => {
    expect(getEditUrl("ARTICLE", "my-post")).toBe(
      "/edit/my-post?category=ARTICLE",
    );
    expect(getEditUrl("WORK", "my-project")).toBe(
      "/edit/my-project?category=WORK",
    );
  });

  // A page is edited at a static route of its own — `/edit/home`,
  // `/edit/about` — which is what creates its record the first time.
  it("returns a page's own edit route, with no category to carry", () => {
    expect(getEditUrl("PAGE", "home")).toBe("/edit/home");
    expect(getEditUrl("PAGE", "about")).toBe("/edit/about");
  });
});
