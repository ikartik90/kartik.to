import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Post } from "@/domain/post";

const mockGetPublished = vi.fn();

vi.mock("@/lib/posts", () => ({
  getPublishedPostBySlug: (...args: unknown[]) => mockGetPublished(...args),
}));

vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://kartik.to" }));

const { postMarkdownResponse } = await import("../post-markdown");

const NOW = new Date("2026-09-10T00:00:00.000Z");

const PROJECT: Post = {
  id: "p1",
  title: "Redesigning Shift Scheduling",
  slug: "scheduling-extensions",
  category: "WORK",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Shifts were a critical lever." }],
      },
    ],
  },
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("postMarkdownResponse", () => {
  beforeEach(() => mockGetPublished.mockReset());

  it("serves a published post as Markdown", async () => {
    mockGetPublished.mockResolvedValue(PROJECT);
    const response = await postMarkdownResponse("scheduling-extensions", "WORK");

    expect(mockGetPublished).toHaveBeenCalledWith("scheduling-extensions", "WORK");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(await response.text()).toBe(
      "# Redesigning Shift Scheduling\n\nShifts were a critical lever.\n",
    );
  });

  it("points search engines at the page it is a copy of", async () => {
    mockGetPublished.mockResolvedValue(PROJECT);
    const response = await postMarkdownResponse("scheduling-extensions", "WORK");
    expect(response.headers.get("link")).toBe(
      '<https://kartik.to/work/scheduling-extensions>; rel="canonical"',
    );
  });

  it("is a 404 for anything unpublished or missing", async () => {
    // Published only — a draft is not public at its page either, and there is
    // no admin session worth reading for a file served to agents.
    mockGetPublished.mockResolvedValue(null);
    const response = await postMarkdownResponse("draft", "ARTICLE");
    expect(response.status).toBe(404);
  });
});
