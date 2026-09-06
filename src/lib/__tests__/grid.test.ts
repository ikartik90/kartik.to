import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPostFindMany = vi.fn();
const mockComponentFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: (...args: unknown[]) => mockPostFindMany(...args) },
    component: {
      findMany: (...args: unknown[]) => mockComponentFindMany(...args),
    },
  },
}));

import { getGridCards, type GridPostCard } from "@/lib/grid";
import { articles as staticArticles } from "@/data/articles";
import { projects as staticProjects } from "@/data/projects";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const row = (over: Record<string, unknown>) => ({
  id: "post-1",
  title: "Atlas",
  slug: "atlas",
  category: "WORK",
  content: { type: "doc", content: [] },
  coverImageKey: null,
  aspect: null,
  publishedAt: NOW,
  untitledIndex: null,
  gridIndex: null,
  gridSpan: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const postCards = (cards: Awaited<ReturnType<typeof getGridCards>>) =>
  cards.filter((card): card is GridPostCard => card.kind === "post");

describe("getGridCards", () => {
  beforeEach(() => {
    mockPostFindMany.mockReset().mockResolvedValue([]);
    mockComponentFindMany.mockReset().mockResolvedValue([]);
  });

  it("gives a PROJECT a cover too, not only an article", async () => {
    // `LinkCard` is one card and the grid is one grid. Articles wearing
    // pictures while projects kept a flat plate would read as two card designs
    // sharing a listing — so the derivation is a property of a post, and
    // `category` never enters into it.
    mockPostFindMany.mockResolvedValue([
      row({
        category: "WORK",
        content: {
          type: "doc",
          content: [
            {
              type: "collection",
              items: [
                { type: "media", kind: "image", src: "/featured.png" },
                { type: "media", kind: "image", src: "/second.png" },
              ],
            },
          ],
        },
      }),
    ]);

    const cards = await getGridCards();
    const atlas = postCards(cards).find((card) => card.id === "post-1");
    expect(atlas?.cover).toEqual({
      type: "media",
      kind: "image",
      src: "/featured.png",
    });
  });

  it("lists nothing the database did not return", async () => {
    // `src/data/articles.ts` and `src/data/projects.ts` are fixtures, not
    // publications, and the listing is the database's alone.
    //
    // They were seeded into it so the page had something to show before
    // anything had been written, and that is what has to stop: a static card
    // carries the same toolbar as every other one while having no row behind
    // it, so pinning, widening, reshaping and retiring it are all no-ops
    // dressed as controls — see `parseCardKey`, which had to know their ids by
    // name to keep the write from throwing. The files stay for the
    // playgrounds; only their standing as published work goes.
    //
    // The slugs are read off the data modules rather than hardcoded, so a
    // rename keeps testing the real thing instead of quietly testing nothing.
    mockPostFindMany.mockResolvedValue([row({})]);

    const hrefs = postCards(await getGridCards()).map((card) => card.href);

    expect(hrefs).toEqual(["/work/atlas"]);
    for (const { slug } of [...staticArticles, ...staticProjects]) {
      expect(hrefs).not.toContain(`/writing/${slug}`);
      expect(hrefs).not.toContain(`/work/${slug}`);
    }
  });

  it("leaves a post with no media in it on the flat plate", async () => {
    mockPostFindMany.mockResolvedValue([
      row({ content: { type: "doc", content: [] } }),
    ]);

    const cards = await getGridCards();
    expect(
      postCards(cards).find((card) => card.id === "post-1")?.cover,
    ).toBeNull();
  });
});
