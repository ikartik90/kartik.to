import { describe, it, expect } from "vitest";
import {
  applyGridDraft,
  emptyGridDraft,
  isGridDraftDirty,
} from "@/utils/grid-draft";
import type { GridCard } from "@/lib/grid";

const post = (id: string, gridIndex: number | null = null): GridCard => ({
  kind: "post",
  key: `post:${id}`,
  id,
  title: id,
  href: `/work/${id}`,
  date: null,
  cover: null,
  card: {},
  gridIndex,
  publishedAt: new Date(`2026-01-0${id.length}`),
  aspect: "16/9",
  span: 1,
});

// The component variant, so a test can set `logger`.
const comp = (
  id: string,
  gridIndex: number | null = null,
): Extract<GridCard, { kind: "component" }> => ({
  kind: "component",
  key: `component:${id}`,
  id,
  componentId: "demo",
  logger: false,
  props: null,
  gridIndex,
  publishedAt: new Date("2026-01-01"),
  aspect: "3/2",
  span: 1,
});

const keys = (cards: GridCard[]) => cards.map((c) => c.key);

describe("applyGridDraft", () => {
  // Input already in grid order (newest first), so nothing moves.
  it("changes nothing when nothing has been edited", () => {
    const cards = [post("ccc"), post("bb"), post("a")];
    expect(applyGridDraft(cards, emptyGridDraft())).toEqual(cards);
  });

  it("seats a card the draft pinned, without touching the server copy", () => {
    const cards = [post("a"), post("bb"), post("ccc")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      pins: { "post:a": 2 },
    });
    expect(keys(out).indexOf("post:a")).toBe(2);
    expect(cards[0].gridIndex).toBeNull();
  });

  it("releases a pin the draft cleared", () => {
    const cards = [post("a", 0), post("bb"), post("ccc")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      pins: { "post:a": null },
    });
    expect(out.find((c) => c.key === "post:a")?.gridIndex).toBeNull();
  });

  it("hides a card the draft removed", () => {
    const out = applyGridDraft([post("a"), comp("c1")], {
      ...emptyGridDraft(),
      removals: ["component:c1"],
    });
    expect(keys(out)).toEqual(["post:a"]);
  });

  it("shows a component the draft is about to publish, at its seat", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "cosmic-track",
          index: 1,
          aspect: "3/2",
          logger: false,
        },
      ],
    });
    expect(keys(out)).toEqual(["post:bb", "pending:1", "post:a"]);
    expect(out[1]).toMatchObject({ kind: "component", pending: true });
  });

  it("marks only the unsaved cards as pending", () => {
    const out = applyGridDraft([comp("c1")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "1/1",
          logger: false,
        },
      ],
    });
    expect(out.find((c) => c.key === "component:c1")?.pending).toBeFalsy();
    expect(out.find((c) => c.key === "pending:1")?.pending).toBe(true);
  });

  it("can pin a card that has not been published yet", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "1/1",
          logger: false,
        },
      ],
      pins: { "pending:1": 2 },
    });
    expect(keys(out).indexOf("pending:1")).toBe(2);
  });

  it("drops a removal and an insert that cancel out", () => {
    const cards = [post("a")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "1/1",
          logger: false,
        },
      ],
      removals: ["pending:1"],
    });
    expect(keys(out)).toEqual(["post:a"]);
  });

  it("widens a card the draft gave a span to", () => {
    const cards = [post("a"), post("bb")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      spans: { "post:a": 2 },
    });
    expect(out.find((c) => c.key === "post:a")?.span).toBe(2);
    expect(cards[0].span).toBe(1);
  });

  it("leaves every card the draft did not widen at the width it came with", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      spans: { "post:a": 3 },
    });
    expect(out.find((c) => c.key === "post:bb")?.span).toBe(1);
  });

  it("keeps a pin and a span on the same card", () => {
    const out = applyGridDraft([post("a"), post("bb"), post("ccc")], {
      ...emptyGridDraft(),
      pins: { "post:a": 2 },
      spans: { "post:a": 2 },
    });
    expect(keys(out).indexOf("post:a")).toBe(2);
    expect(out.find((c) => c.key === "post:a")?.span).toBe(2);
  });

  it("widens a component that has not been published yet", () => {
    const out = applyGridDraft([post("a")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "1/1",
          logger: false,
        },
      ],
      spans: { "pending:1": 2 },
    });
    expect(out.find((c) => c.key === "pending:1")?.span).toBe(2);
  });
});

describe("applyGridDraft — aspect", () => {
  it("reshapes a card the draft gave an aspect to", () => {
    const cards = [post("a"), post("bb")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      aspects: { "post:a": "3/4" },
    });
    expect(out.find((c) => c.key === "post:a")?.aspect).toBe("3/4");
    expect(cards[0].aspect).toBe("16/9");
  });

  it("leaves every other card at the shape it came with", () => {
    const out = applyGridDraft([post("a"), comp("c1")], {
      ...emptyGridDraft(),
      aspects: { "post:a": "1/1" },
    });
    expect(out.find((c) => c.key === "component:c1")?.aspect).toBe("3/2");
  });

  it("keeps a pin, a span and an aspect on the same card", () => {
    const out = applyGridDraft([post("a"), post("bb"), post("ccc")], {
      ...emptyGridDraft(),
      pins: { "post:a": 2 },
      spans: { "post:a": 2 },
      aspects: { "post:a": "2/1" },
    });
    expect(keys(out).indexOf("post:a")).toBe(2);
    const card = out.find((c) => c.key === "post:a");
    expect(card?.span).toBe(2);
    expect(card?.aspect).toBe("2/1");
  });

  it("overrides the shape a pending insert arrived with", () => {
    const out = applyGridDraft([post("a")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "3/2",
          logger: false,
        },
      ],
      aspects: { "pending:1": "9/16" },
    });
    expect(out.find((c) => c.key === "pending:1")?.aspect).toBe("9/16");
  });

  it("leaves an untouched insert at the shape the registry gave it", () => {
    const out = applyGridDraft([post("a")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "3/2",
          logger: false,
        },
      ],
    });
    expect(out.find((c) => c.key === "pending:1")?.aspect).toBe("3/2");
  });
});

describe("isGridDraftDirty", () => {
  it("is clean when nothing has been edited", () => {
    expect(isGridDraftDirty(emptyGridDraft())).toBe(false);
  });

  it("is dirty once a card has been widened", () => {
    expect(
      isGridDraftDirty({ ...emptyGridDraft(), spans: { "post:a": 2 } }),
    ).toBe(true);
  });

  it("is dirty once a card has been reshaped", () => {
    expect(
      isGridDraftDirty({ ...emptyGridDraft(), aspects: { "post:a": "1/1" } }),
    ).toBe(true);
  });
});

const loggerOf = (cards: ReturnType<typeof applyGridDraft>, key: string) => {
  const card = cards.find((c) => c.key === key);
  return card?.kind === "component" ? card.logger : undefined;
};

describe("applyGridDraft — logger", () => {
  it("shows the log panel on a card the draft turned it on for", () => {
    const cards = [comp("c1")];
    const out = applyGridDraft(cards, {
      ...emptyGridDraft(),
      loggers: { "component:c1": true },
    });
    expect(loggerOf(out, "component:c1")).toBe(true);
    expect(cards[0].logger).toBe(false);
  });

  it("hides the log panel on a card the draft turned it off for", () => {
    const out = applyGridDraft([{ ...comp("c1"), logger: true }], {
      ...emptyGridDraft(),
      loggers: { "component:c1": false },
    });
    expect(loggerOf(out, "component:c1")).toBe(false);
  });

  it("leaves every other card's log panel as it came", () => {
    const out = applyGridDraft([comp("c1"), { ...comp("c2"), logger: true }], {
      ...emptyGridDraft(),
      loggers: { "component:c1": true },
    });
    expect(loggerOf(out, "component:c2")).toBe(true);
  });

  it("overrides the log panel a pending insert arrived with", () => {
    const out = applyGridDraft([post("a")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "3/2",
          logger: true,
        },
      ],
      loggers: { "pending:1": false },
    });
    expect(loggerOf(out, "pending:1")).toBe(false);
  });

  it("leaves an untouched insert at the log panel the registry gave it", () => {
    const out = applyGridDraft([post("a")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "x",
          index: 0,
          aspect: "3/2",
          logger: true,
        },
      ],
    });
    expect(loggerOf(out, "pending:1")).toBe(true);
  });

  it("is dirty once a card's log panel has been toggled", () => {
    expect(
      isGridDraftDirty({
        ...emptyGridDraft(),
        loggers: { "component:c1": true },
      }),
    ).toBe(true);
  });
});

describe("applyGridDraft — configuration", () => {
  const linkCard = (id: string): Extract<GridCard, { kind: "component" }> => ({
    ...comp(id),
    componentId: "link-card",
    props: {},
  });

  it("configures the card the draft configured", () => {
    const out = applyGridDraft([linkCard("a"), linkCard("b")], {
      ...emptyGridDraft(),
      props: { "component:a": { content: { title: "Shader" } } },
    });
    const [a, b] = out as Extract<GridCard, { kind: "component" }>[];
    expect(a.props?.content?.title).toBe("Shader");
    expect(b.props).toEqual({});
  });

  it("replaces the stored configuration rather than merging into it", () => {
    const stored = linkCard("a");
    stored.props = { content: { title: "Old" }, link: undefined };
    const [out] = applyGridDraft([stored], {
      ...emptyGridDraft(),
      props: { "component:a": { content: { meta: "Playground" } } },
    }) as Extract<GridCard, { kind: "component" }>[];
    expect(out.props).toEqual({ content: { meta: "Playground" } });
  });

  it("configures a card that has not been published yet", () => {
    const [out] = applyGridDraft([], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "link-card",
          index: 0,
          aspect: "16/9",
          logger: false,
        },
      ],
      props: { "pending:1": { content: { title: "Shader" } } },
    }) as Extract<GridCard, { kind: "component" }>[];
    expect(out.props?.content?.title).toBe("Shader");
  });

  it("leaves a card nobody configured with nothing on it", () => {
    const [out] = applyGridDraft([], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "link-card",
          index: 0,
          aspect: "16/9",
          logger: false,
        },
      ],
    }) as Extract<GridCard, { kind: "component" }>[];
    expect(out.props).toEqual({});
  });

  it("is dirty once a card has been configured", () => {
    expect(
      isGridDraftDirty({
        ...emptyGridDraft(),
        props: { "component:a": { content: { title: "Shader" } } },
      }),
    ).toBe(true);
  });
});

describe("applyGridDraft — a post's card", () => {
  const dark = { type: "media" as const, kind: "image" as const, src: "/d.png" };
  const cardOf = (card: GridCard | undefined) =>
    card?.kind === "post" ? card.card : undefined;

  it("dresses the card the draft dressed", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      cards: { "post:a": { media: { dark }, scrim: false } },
    });
    expect(cardOf(out.find((c) => c.key === "post:a"))).toEqual({
      media: { dark },
      scrim: false,
    });
    expect(cardOf(out.find((c) => c.key === "post:bb"))).toEqual({});
  });

  it("replaces the stored card rather than merging into it", () => {
    const stored = post("a");
    if (stored.kind === "post") stored.card = { media: { dark }, tone: "dark" };
    const [out] = applyGridDraft([stored], {
      ...emptyGridDraft(),
      cards: { "post:a": { scrim: false } },
    });
    expect(cardOf(out)).toEqual({ scrim: false });
  });

  it("ignores a key naming a component", () => {
    const [out] = applyGridDraft([comp("a")], {
      ...emptyGridDraft(),
      cards: { "component:a": { scrim: false } },
    });
    expect(out).toEqual(comp("a"));
  });

  it("is dirty once a card has been dressed", () => {
    expect(
      isGridDraftDirty({
        ...emptyGridDraft(),
        cards: { "post:a": { scrim: false } },
      }),
    ).toBe(true);
  });
});

describe("applyGridDraft — a widget added with no seat", () => {
  const post = (id: string, gridIndex: number | null = null): GridCard => ({
    kind: "post",
    key: `post:${id}`,
    id,
    title: id,
    href: `/work/${id}`,
    date: null,
    cover: null,
    card: {},
    gridIndex,
    publishedAt: new Date(`2026-01-0${id.length}`),
    aspect: "16/9",
    span: 1,
  });

  it("floats to the front rather than claiming a seat", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "cosmic-track",
          index: null,
          aspect: "3/2",
          logger: false,
        },
      ],
    });

    expect(out.map((c) => c.key)).toEqual(["pending:1", "post:bb", "post:a"]);
    expect(out[0].gridIndex).toBeNull();
  });

  it("still takes a pin made against it afterwards", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      inserts: [
        {
          key: "pending:1",
          componentId: "cosmic-track",
          index: null,
          aspect: "3/2",
          logger: false,
        },
      ],
      pins: { "pending:1": 2 },
    });

    expect(out.map((c) => c.key).indexOf("pending:1")).toBe(2);
  });
});
