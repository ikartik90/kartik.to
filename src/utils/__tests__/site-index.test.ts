import { describe, expect, it } from "vitest";
import type { BlockNode } from "@/domain/nodes";
import type { Post } from "@/domain/post";
import { SITE_PAGES } from "@/data/site-paths";
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

const about = post({
  slug: "about",
  category: "PAGE",
  title: "About",
  updatedAt: new Date("2026-09-14T00:00:00.000Z"),
  content: { type: "doc", content: [words("I design interfaces.")] },
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

  it("lists the homepage, every published post and every playground", () => {
    expect(urls).toEqual([
      SITE,
      `${SITE}/work/scheduling-extensions`,
      `${SITE}/writing/on-craft`,
      `${SITE}/playground/shader`,
      `${SITE}/playground/calchemy`,
      `${SITE}/playground/icons`,
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

  describe("with the About page", () => {
    const withAbout = sitemapEntries([home, about, project, essay], SITE);

    it("lists it after the homepage, at its own address", () => {
      expect(withAbout.map((entry) => entry.url)).toEqual([
        SITE,
        `${SITE}/about`,
        `${SITE}/work/scheduling-extensions`,
        `${SITE}/writing/on-craft`,
        `${SITE}/playground/shader`,
        `${SITE}/playground/calchemy`,
        `${SITE}/playground/icons`,
      ]);
    });

    it("dates it by its own last edit", () => {
      expect(withAbout[1].lastModified).toEqual(
        new Date("2026-09-14T00:00:00.000Z"),
      );
    });

    it("does not date the homepage by it", () => {
      expect(withAbout[0].lastModified).toEqual(
        new Date("2026-09-13T00:00:00.000Z"),
      );
    });

    it("leaves it out while it is a draft", () => {
      const draft = { ...about, publishedAt: null };
      expect(
        sitemapEntries([home, draft], SITE).map((entry) => entry.url),
      ).not.toContain(`${SITE}/about`);
    });
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

  it("lists a post with its written description over its opening", () => {
    const described = { ...project, description: "Written for search." };
    expect(llmsTxt([home, described], SITE)).toContain(
      "(https://kartik.to/work/scheduling-extensions.md): Written for search.",
    );
  });

  it("leaves out a section with nothing in it", () => {
    expect(llmsTxt([home, project], SITE)).not.toContain("## Writing");
  });

  it("links the About page's Markdown copy under Pages, ahead of the work", () => {
    const withAbout = llmsTxt([home, about, project, essay], SITE);
    expect(withAbout).toContain(
      "## Pages\n\n- [About](https://kartik.to/about.md): I design interfaces.",
    );
    expect(withAbout.indexOf("## Pages")).toBeLessThan(
      withAbout.indexOf("## Work"),
    );
  });

  it("never lists the homepage's own record as a page", () => {
    expect(text).not.toContain("## Pages");
    expect(text).not.toContain("/home.md");
  });

  it("leaves out the About page while it is a draft", () => {
    const draft = { ...about, publishedAt: null };
    expect(llmsTxt([home, draft, project], SITE)).not.toContain("about.md");
  });

  it("links every playground by its public name", () => {
    expect(text).toContain(
      [
        "## Playgrounds",
        "",
        `- [${SITE_PAGES.shader.title}](${SITE}/playground/shader)`,
        `- [${SITE_PAGES.calchemy.title}](${SITE}/playground/calchemy)`,
        `- [${SITE_PAGES.icons.title}](${SITE}/playground/icons)`,
      ].join("\n"),
    );
  });

  it("links the profiles elsewhere", () => {
    expect(text).toContain("- [GitHub](https://github.com/ikartik90)");
    expect(text).toContain("- [LinkedIn](https://linkedin.com/in/ikartik90)");
  });

  it("ends with a newline", () => {
    expect(text.endsWith("\n")).toBe(true);
  });
});
