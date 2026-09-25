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
  card: null,
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
    // Slugs are read off the data modules, so a rename cannot leave this testing nothing.
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

describe("getGridCards — configuration", () => {
  beforeEach(() => {
    mockPostFindMany.mockReset().mockResolvedValue([]);
    mockComponentFindMany.mockReset().mockResolvedValue([]);
  });

  const componentRow = (props: unknown) => ({
    id: "c1",
    componentId: "link-card",
    aspect: null,
    logger: null,
    props,
    gridIndex: null,
    gridSpan: null,
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const config = async () => {
    const [card] = await getGridCards();
    return card?.kind === "component" ? card.props : null;
  };

  it("carries the card the row holds", async () => {
    mockComponentFindMany.mockResolvedValue([
      componentRow({ content: { title: "Shader" } }),
    ]);
    expect(await config()).toEqual({ content: { title: "Shader" } });
  });

  it("gives a demo with nothing stored an empty configuration", async () => {
    mockComponentFindMany.mockResolvedValue([componentRow(null)]);
    expect(await config()).toEqual({});
  });

  it("renders a card whose stored configuration no longer parses", async () => {
    mockComponentFindMany.mockResolvedValue([
      componentRow({ link: { kind: "external", href: "not a url" } }),
    ]);
    expect(await config()).toEqual({});
  });
});

describe("getGridCards — a post's card", () => {
  beforeEach(() => {
    mockPostFindMany.mockReset().mockResolvedValue([]);
    mockComponentFindMany.mockReset().mockResolvedValue([]);
  });

  const dark = { type: "media", kind: "image", src: "/dark.png" };

  it("reads the card off the row", async () => {
    mockPostFindMany.mockResolvedValue([
      row({ card: { media: { dark }, scrim: false } }),
    ]);
    const [card] = postCards(await getGridCards());
    expect(card.card).toEqual({ media: { dark }, scrim: false });
  });

  it("gives a post with no card of its own an empty one", async () => {
    mockPostFindMany.mockResolvedValue([row({ card: null })]);
    const [card] = postCards(await getGridCards());
    expect(card.card).toEqual({});
  });

  it("keeps the document's picture beside the authored one", async () => {
    mockPostFindMany.mockResolvedValue([
      row({
        content: {
          type: "doc",
          content: [{ type: "media", kind: "image", src: "/first.png" }],
        },
        card: { media: { dark } },
      }),
    ]);
    const [card] = postCards(await getGridCards());
    expect(card.cover).toEqual({
      type: "media",
      kind: "image",
      src: "/first.png",
    });
    expect(card.card.media).toEqual({ dark });
  });
});
