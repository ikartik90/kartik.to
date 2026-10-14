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

const mockPublishedPresets = vi.fn();
vi.mock("@/app/actions/shader-preset", () => ({
  getPublishedShaderPresets: () => mockPublishedPresets(),
}));

const mockApprovedIcons = vi.fn();
vi.mock("@/lib/icons", () => ({
  listApprovedIconsWithSvg: () => mockApprovedIcons(),
}));

import {
  getGridCards,
  getGridCoverIcons,
  getGridShaderPresets,
  type GridCard,
  type GridPostCard,
} from "@/lib/grid";
import type { LinkCardConfig } from "@/domain/link-card";
import { shaderPresetContentFor } from "@/domain/shader-preset";
import { articles as staticArticles } from "@/data/articles";
import { projects as staticProjects } from "@/data/projects";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const row = (over: Record<string, unknown>) => ({
  id: "post-1",
  title: "Atlas",
  slug: "atlas",
  category: "ARTICLE",
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

  it("asks for no projects or prototypes: the project sections show the work", async () => {
    await getGridCards();
    expect(mockPostFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: { in: ["ARTICLE"] } }),
      }),
    );
  });

  it("takes a post's cover from the first picture in a collection", async () => {
    mockPostFindMany.mockResolvedValue([
      row({
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

    expect(hrefs).toEqual(["/writing/atlas"]);
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

describe("getGridShaderPresets", () => {
  beforeEach(() => {
    mockPublishedPresets.mockReset();
  });

  it("names each published preset and keeps only what a card plays", async () => {
    const content = shaderPresetContentFor("pixelComets");
    mockPublishedPresets.mockResolvedValue([
      {
        id: "p1",
        title: null,
        untitledIndex: 5,
        ...content,
        publishedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    expect(await getGridShaderPresets()).toEqual([
      { id: "p1", name: "Untitled 5", ...content },
    ]);
  });

  it("is empty rather than failing the page when the presets can't be read", async () => {
    mockPublishedPresets.mockRejectedValue(new Error("down"));
    expect(await getGridShaderPresets()).toEqual([]);
  });
});

describe("getGridCoverIcons", () => {
  const card = (props: LinkCardConfig): GridCard => ({
    kind: "component",
    key: "component:c1",
    id: "c1",
    componentId: "link-card",
    aspect: "1/1",
    logger: false,
    props,
    gridIndex: null,
    publishedAt: NOW,
    span: 1,
  });
  const svg = { viewBox: 20, flattened: false, nodes: [] };
  const approved = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ icon: { key: `icons/${i}.svg` }, svg: i % 10 === 9 ? null : svg }));

  beforeEach(() => {
    mockApprovedIcons.mockReset();
  });

  it("reads nothing when no card plays the icons", async () => {
    expect(await getGridCoverIcons([card({ media: { shader: "p1" } })])).toEqual([]);
    expect(mockApprovedIcons).not.toHaveBeenCalled();
  });

  it("deals out the approved icons that drew, each once, at most 150", async () => {
    mockApprovedIcons.mockResolvedValue(approved(300));
    const icons = await getGridCoverIcons([card({ media: { icons: true } })]);
    expect(icons).toHaveLength(150);
    expect(new Set(icons.map((icon) => icon.key)).size).toBe(150);
    expect(icons.every((icon) => icon.svg === svg)).toBe(true);
  });

  it("deals them out in a fresh order", async () => {
    mockApprovedIcons.mockResolvedValue(approved(40));
    const icons = await getGridCoverIcons([card({ media: { icons: true } })], () => 0);
    expect(icons.map((icon) => icon.key)).not.toEqual(
      approved(40).filter((entry) => entry.svg).map((entry) => entry.icon.key),
    );
  });

  it("is empty rather than failing the page when the icons can't be read", async () => {
    mockApprovedIcons.mockRejectedValue(new Error("down"));
    expect(await getGridCoverIcons([card({ media: { icons: true } })])).toEqual([]);
  });
});
