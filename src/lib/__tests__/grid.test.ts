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

// ---------------------------------------------------------------------------
// The configuration a publication carries — read back off the row, for the one
// registry entry whose row IS the card.
// ---------------------------------------------------------------------------
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

  // A demo's content is its own code, so there is nothing here to read — and an
  // empty configuration is the same answer as none for a card that never asks.
  it("gives a demo with nothing stored an empty configuration", async () => {
    mockComponentFindMany.mockResolvedValue([componentRow(null)]);
    expect(await config()).toEqual({});
  });

  // Read LENIENTLY, and this is the case it exists for: the whole configuration
  // is one blob, so a link whose href went bad must not take the rest of the
  // homepage with it. The card comes back unconfigured and can be fixed in the
  // rail — a far better failure than a page that 500s over one tile.
  it("renders a card whose stored configuration no longer parses", async () => {
    mockComponentFindMany.mockResolvedValue([
      componentRow({ link: { kind: "external", href: "not a url" } }),
    ]);
    expect(await config()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// A post's card — read back off its own row.
// ---------------------------------------------------------------------------
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

  // Every post that predates this has nothing here, and draws the derived
  // card — so an empty configuration is what a null column reads as.
  it("gives a post with no card of its own an empty one", async () => {
    mockPostFindMany.mockResolvedValue([row({ card: null })]);
    const [card] = postCards(await getGridCards());
    expect(card.card).toEqual({});
  });

  // Whether the picture is derived or authored is decided at render, not here:
  // `cover` stays the document's, so the rail can offer it back when the
  // author opens the Media section.
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
