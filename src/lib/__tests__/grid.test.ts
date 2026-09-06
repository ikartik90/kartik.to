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
import { postCover } from "@/utils/post-cover";

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

  it("reads the cover off the post's OWN document, static entries included", async () => {
    // Static posts are a real part of the listing — the grid reads wide and
    // fails narrow, so they are what a visitor still gets when the database is
    // unreachable. A cover that only appeared for database rows would make
    // those the odd cards out on exactly the page that has nothing else.
    const [firstArticle] = staticArticles;
    const cards = await getGridCards();

    const card = postCards(cards).find(
      (entry) => entry.href === `/writing/${firstArticle.slug}`,
    );
    expect(card?.cover).toEqual(postCover(firstArticle.content));
    expect(card?.cover).not.toBeNull();
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
