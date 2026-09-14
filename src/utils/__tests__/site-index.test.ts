import { describe, expect, it } from "vitest";
import type { BlockNode } from "@/domain/nodes";
import type { Post } from "@/domain/post";
import { llmsTxt, sitemapEntries } from "../site-index";

const SITE = "https://kartik.to";

const words = (text: string): BlockNode => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const post = (overrides: Partial<Post>): Post => ({
  id: overrides.slug ?? "p",
  title: "Untitled",
  slug: "p",
  category: "WORK",
  content: { type: "doc", content: [] },
  publishedAt: new Date("2026-09-10T00:00:00.000Z"),
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-10T00:00:00.000Z"),
  ...overrides,
});

const home = post({
  slug: "home",
  category: "PAGE",
  title: null,
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
});

const project = post({
  slug: "scheduling-extensions",
  title: "Redesigning Shift Scheduling",
  updatedAt: new Date("2026-09-12T00:00:00.000Z"),
  content: {
    type: "doc",
    content: [
      { type: "media", kind: "image", src: "https://cdn.example.com/cover.png" },
      words("Shifts were a critical lever."),
    ],
  },
});

const essay = post({
  slug: "on-craft",
  category: "ARTICLE",
  title: "On Craft",
  publishedAt: new Date("2026-09-11T00:00:00.000Z"),
});

describe("sitemapEntries", () => {
  const entries = sitemapEntries([home, project, essay], SITE);
  const urls = entries.map((entry) => entry.url);

  it("lists the homepage, every published post and the indexed playground", () => {
    expect(urls).toEqual([
      SITE,
      `${SITE}/work/scheduling-extensions`,
      `${SITE}/writing/on-craft`,
      `${SITE}/playground/shader`,
    ]);
  });

  it("dates the homepage by the most recent change to anything on it", () => {
    expect(entries[0].lastModified).toEqual(new Date("2026-09-13T00:00:00.000Z"));
  });

  it("dates each post by its own last edit", () => {
    expect(entries[1].lastModified).toEqual(new Date("2026-09-12T00:00:00.000Z"));
  });

  it("names a post's cover picture for image search", () => {
    expect(entries[1].images).toEqual(["https://cdn.example.com/cover.png"]);
    expect(entries[2]).not.toHaveProperty("images");
  });

  it("leaves out anything unpublished", () => {
    const draft = post({ slug: "draft", publishedAt: null });
    expect(
      sitemapEntries([draft], SITE).map((entry) => entry.url),
    ).not.toContain(`${SITE}/work/draft`);
  });
});

describe("llmsTxt", () => {
  const text = llmsTxt([home, project, essay], SITE);

  it("opens with the person's name and a one-line summary", () => {
    expect(text.startsWith("# Kartik Iyer\n\n> Kartik Iyer is a product designer")).toBe(
      true,
    );
  });

  it("states the roles and the city", () => {
    expect(text).toContain("Product Designer, Founding Designer, Design Engineer");
    expect(text).toContain("Toronto, Ontario, Canada");
  });

  it("links each post's Markdown copy with its summary", () => {
    expect(text).toContain(
      "## Work\n\n- [Redesigning Shift Scheduling](https://kartik.to/work/scheduling-extensions.md): Shifts were a critical lever.",
    );
    expect(text).toContain(
      "## Writing\n\n- [On Craft](https://kartik.to/writing/on-craft.md)",
    );
  });

  it("leaves out a section with nothing in it", () => {
    expect(llmsTxt([home, project], SITE)).not.toContain("## Writing");
  });

  it("links the profiles elsewhere", () => {
    expect(text).toContain("- [GitHub](https://github.com/ikartik90)");
    expect(text).toContain("- [LinkedIn](https://linkedin.com/in/ikartik90)");
  });

  it("ends with a newline", () => {
    expect(text.endsWith("\n")).toBe(true);
  });
});
