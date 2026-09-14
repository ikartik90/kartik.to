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

  it("is a bare title for a post that does not exist", () => {
    expect(postMetadata(null, "/work/nope", "Project")).toEqual({
      title: "Project",
    });
  });
});
