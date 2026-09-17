import { describe, expect, it } from "vitest";
import type { Post } from "@/domain/post";
import { SITE_TITLE } from "@/data/site";
import { homeMetadata, postMetadata, siteCard } from "../post-metadata";

const NOW = new Date("2026-09-10T00:00:00.000Z");

const PROJECT: Post = {
  id: "p1",
  title: "Redesigning Shift Scheduling",
  slug: "scheduling-extensions",
  category: "WORK",
  content: { type: "doc", content: [] },
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("postMetadata", () => {
  const metadata = postMetadata(PROJECT, "/work/scheduling-extensions", "Project");

  it("names the page as its own canonical address", () => {
    expect(metadata.alternates?.canonical).toBe("/work/scheduling-extensions");
  });

  it("points agents at the Markdown copy of the page", () => {
    expect(metadata.alternates?.types).toEqual({
      "text/markdown": "/work/scheduling-extensions.md",
    });
  });

  it("credits the author on the card", () => {
    expect(metadata.openGraph).toMatchObject({ authors: ["Kartik Iyer"] });
    expect(metadata.twitter).toMatchObject({ creator: "@ikartik90" });
  });

  it("titles the page with the post's own title by default", () => {
    expect(metadata.title).toBe("Redesigning Shift Scheduling");
    expect(metadata.openGraph).toMatchObject({
      title: "Redesigning Shift Scheduling",
    });
  });

  it("can title the page for search instead, in full, on the page and its card", () => {
    const searchTitle = "About Kartik Iyer — Product Designer";
    const about = postMetadata(
      { ...PROJECT, category: "PAGE", slug: "about", title: "About Me" },
      "/about",
      "About",
      { searchTitle },
    );
    // Absolute: the layout's `%s — Kartik Iyer` template would name him twice.
    expect(about.title).toEqual({ absolute: searchTitle });
    expect(about.openGraph).toMatchObject({ title: searchTitle });
    expect(about.twitter).toMatchObject({ title: searchTitle });
  });

  it("is a bare title for a post that does not exist", () => {
    expect(postMetadata(null, "/work/nope", "Project")).toEqual({
      title: "Project",
    });
  });

  it("describes the page with the author's written description where there is one", () => {
    const described = postMetadata(
      {
        ...PROJECT,
        description: "Written for search.",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "The opening line." }],
            },
          ],
        },
      },
      "/work/scheduling-extensions",
      "Project",
    );
    expect(described.description).toBe("Written for search.");
    expect(described.openGraph).toMatchObject({
      description: "Written for search.",
    });
    expect(described.twitter).toMatchObject({
      description: "Written for search.",
    });
  });
});

describe("siteCard", () => {
  it("is the site's own card, described as asked", () => {
    const card = siteCard("A line.");
    expect(card.openGraph).toMatchObject({
      type: "website",
      siteName: "kartik.to",
      title: SITE_TITLE,
      description: "A line.",
    });
    expect(card.twitter).toMatchObject({
      card: "summary_large_image",
      title: SITE_TITLE,
      description: "A line.",
      creator: "@ikartik90",
    });
  });
});

describe("homeMetadata", () => {
  it("names the homepage as its own address and inherits the rest", () => {
    expect(homeMetadata(null)).toEqual({ alternates: { canonical: "/" } });
  });

  // Next replaces `openGraph` and `twitter` wholesale, so a description on the
  // homepage restates the whole card rather than only the line that changed.
  it("describes the homepage with a written description, on its card too", () => {
    const metadata = homeMetadata("Written for search.");
    expect(metadata.description).toBe("Written for search.");
    expect(metadata).toMatchObject(siteCard("Written for search."));
    expect(metadata.alternates).toEqual({ canonical: "/" });
  });
});
