import { describe, it, expect } from "vitest";
import {
  getEditUrl,
  getPostMarkdownUrl,
  getPostReadUrl,
} from "../post-urls";

describe("getPostReadUrl", () => {
  it("returns /writing/slug for ARTICLE", () => {
    expect(getPostReadUrl("ARTICLE", "my-post")).toBe("/writing/my-post");
  });

  it("returns /work/slug for WORK", () => {
    expect(getPostReadUrl("WORK", "my-project")).toBe("/work/my-project");
  });

  it("returns /slug for PAGE", () => {
    expect(getPostReadUrl("PAGE", "about")).toBe("/about");
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
});
