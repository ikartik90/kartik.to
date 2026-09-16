import { describe, expect, it } from "vitest";
import type { Post } from "@/domain/post";
import { postMetadata } from "../post-metadata";

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
});
