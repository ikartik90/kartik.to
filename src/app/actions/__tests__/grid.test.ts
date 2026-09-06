import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// `saveGridLayout` — the one write the grid editor makes.
//
// Everything the toolbar does is buffered until "Publish and exit", so this is
// where a session's worth of pinning, widening, inserting and retiring either
// all lands or none of it does. The tests below are about what reaches each
// table, which is the part a type checker cannot hold on its own: a width and a
// seat are two columns on the same row, and sending them as two updates or
// against the wrong table is a mistake that compiles.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: () =>
      Promise.resolve({ data: { user: { email: "admin@example.com" } } }),
  },
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `updateMany` is spied alongside `update` purely so the static-card tests can
// assert that NEITHER ran — "no write was attempted" is the specification, and
// checking only `update` would pass a version that quietly no-opped through
// `updateMany` instead.
const postUpdate = vi.fn();
const postUpdateMany = vi.fn();
const componentUpdate = vi.fn();
const componentUpdateMany = vi.fn();
const componentCreate = vi.fn();
const componentDelete = vi.fn();

const tx = {
  post: { update: postUpdate, updateMany: postUpdateMany },
  component: {
    update: componentUpdate,
    updateMany: componentUpdateMany,
    create: componentCreate,
    delete: componentDelete,
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (run: (t: typeof tx) => Promise<void>) => run(tx),
  },
}));

import { saveGridLayout } from "../grid";
import { emptyGridDraft } from "@/utils/grid-draft";

const draft = (over: Partial<Parameters<typeof saveGridLayout>[0]> = {}) => ({
  ...emptyGridDraft(),
  ...over,
});

describe("saveGridLayout — widths", () => {
  beforeEach(() => {
    [
      postUpdate,
      postUpdateMany,
      componentUpdate,
      componentUpdateMany,
      componentCreate,
      componentDelete,
    ].forEach((fn) => fn.mockReset().mockResolvedValue({ count: 1 }));
  });

  it("writes a post's width to the post table", async () => {
    await saveGridLayout(draft({ spans: { "post:abc": 2 } }));
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridSpan: 2 },
    });
    expect(componentUpdate).not.toHaveBeenCalled();
  });

  it("writes a component's width to the component table", async () => {
    await saveGridLayout(draft({ spans: { "component:xyz": 3 } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { gridSpan: 3 },
    });
    expect(postUpdate).not.toHaveBeenCalled();
  });

  // A seat and a width are two columns of one row. Two updates would be two
  // round trips and, worse, two chances for the second to lose to the first.
  it("sends a seat and a width as one update", async () => {
    await saveGridLayout(
      draft({ pins: { "post:abc": 4 }, spans: { "post:abc": 2 } }),
    );
    expect(postUpdate).toHaveBeenCalledOnce();
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridIndex: 4, gridSpan: 2 },
    });
  });

  // Releasing a pin writes null. It has to survive being merged with a width,
  // which is exactly where a `??`-style merge would drop it.
  it("keeps a released pin when the same card was widened", async () => {
    await saveGridLayout(
      draft({ pins: { "post:abc": null }, spans: { "post:abc": 2 } }),
    );
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridIndex: null, gridSpan: 2 },
    });
  });

  it("leaves the width alone on a card that was only moved", async () => {
    await saveGridLayout(draft({ pins: { "post:abc": 1 } }));
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridIndex: 1 },
    });
  });

  // A card widened before it was ever saved has no row to update — its width
  // belongs to the row the insert is about to create.
  it("creates an inserted component at the width it was drafted", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          { key: "pending:1", componentId: "cosmic-track", index: 0 },
        ],
        spans: { "pending:1": 2 },
      }),
    );
    expect(postUpdate).not.toHaveBeenCalled();
    expect(componentUpdate).not.toHaveBeenCalled();
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          componentId: "cosmic-track",
          gridSpan: 2,
        }),
      }),
    );
  });

  it("creates an untouched insert at a single column", async () => {
    await saveGridLayout(
      draft({
        inserts: [{ key: "pending:1", componentId: "cosmic-track", index: 0 }],
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gridSpan: 1 }),
      }),
    );
  });

  // The CSS clamps anything wider than the grid, so a value that got past the
  // UI would be stored as a width the page never draws.
  it("refuses a width the grid cannot draw", async () => {
    await expect(
      saveGridLayout(draft({ spans: { "post:abc": 9 } })),
    ).rejects.toThrow();
    expect(postUpdate).not.toHaveBeenCalled();
  });

  it("refuses a width below one column", async () => {
    await expect(
      saveGridLayout(draft({ spans: { "post:abc": 0 } })),
    ).rejects.toThrow();
  });

  // A pending card is the only keyed card left with no row of its own, and it
  // must not be able to roll back the rest of the draft: its edits belong to
  // the `inserts` list, which creates the row rather than updating one.
  it("saves the rest of the layout alongside a pending card", async () => {
    await saveGridLayout(
      draft({
        spans: { "pending:1": 2, "post:abc": 3 },
        inserts: [{ key: "pending:1", componentId: "calchemy", index: 1 }],
      }),
    );
    expect(componentCreate).toHaveBeenCalledOnce();
    expect(postUpdate).toHaveBeenCalledOnce();
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridSpan: 3 },
    });
  });

  // --- Shape ---------------------------------------------------------------
  //
  // A width is a fact about the GRID; a shape is a fact about the CARD, and the
  // two end up in different columns even though one rail sets both. For a
  // component the column is the row's existing `aspect` override — per
  // PUBLICATION, since the same demo can be published more than once and only
  // this showing of it was reshaped.

  it("writes a component's shape to its own aspect column", async () => {
    await saveGridLayout(draft({ aspects: { "component:xyz": "9/16" } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { aspect: "9/16" },
    });
  });

  it("writes a post's shape to the post row", async () => {
    await saveGridLayout(draft({ aspects: { "post:abc": "1/1" } }));
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { aspect: "1/1" },
    });
  });

  it("sends a seat, a width and a shape as one update", async () => {
    await saveGridLayout(
      draft({
        pins: { "post:abc": 1 },
        spans: { "post:abc": 2 },
        aspects: { "post:abc": "2/1" },
      }),
    );
    expect(postUpdate).toHaveBeenCalledOnce();
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridIndex: 1, gridSpan: 2, aspect: "2/1" },
    });
  });

  // Reshaping a card that has not been published yet belongs to the row the
  // insert is about to create, overriding the registry default it came with.
  it("creates an inserted component at the shape it was reshaped to", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          {
            key: "pending:1",
            componentId: "cosmic-track",
            index: 0,
            aspect: "3/2",
          },
        ],
        aspects: { "pending:1": "1/1" },
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aspect: "1/1" }),
      }),
    );
  });

  it("refuses a shape the frame has no ratio for", async () => {
    await expect(
      saveGridLayout(
        draft({
          aspects: { "post:abc": "7/3" } as unknown as Record<string, never>,
        }),
      ),
    ).rejects.toThrow();
    expect(postUpdate).not.toHaveBeenCalled();
  });
});

// --- Log output ------------------------------------------------------------
//
// Whether a card shows its log panel is an override on the component row, the
// same shape of column as `aspect`: null means "whatever the registry says",
// and a boolean means this publication has been told otherwise. It is the one
// property in the draft that only HALF the cards can carry — a post has no log
// output and no column to record one in.

describe("saveGridLayout — log output", () => {
  beforeEach(() => {
    [
      postUpdate,
      postUpdateMany,
      componentUpdate,
      componentUpdateMany,
      componentCreate,
      componentDelete,
    ].forEach((fn) => fn.mockReset());
  });

  it("writes a component's log output to its own logger column", async () => {
    await saveGridLayout(draft({ loggers: { "component:xyz": true } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { logger: true },
    });
  });

  // Hiding a panel the registry turns on is the whole point of the override,
  // so `false` has to reach the column rather than being read as "unset".
  it("writes a hidden log panel as false, not as nothing", async () => {
    await saveGridLayout(draft({ loggers: { "component:xyz": false } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { logger: false },
    });
  });

  it("sends a seat, a shape and a log panel as one update", async () => {
    await saveGridLayout(
      draft({
        pins: { "component:xyz": 1 },
        aspects: { "component:xyz": "1/1" },
        loggers: { "component:xyz": true },
      }),
    );
    expect(componentUpdate).toHaveBeenCalledOnce();
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { gridIndex: 1, aspect: "1/1", logger: true },
    });
  });

  // A post row has no `logger` column at all, so a key naming one is dropped
  // before any write is built — reaching Prisma with it would throw and take
  // the whole transaction, and the rest of the layout, down with it.
  it("attempts no write for a post", async () => {
    await saveGridLayout(draft({ loggers: { "post:abc": true } }));
    expect(postUpdate).not.toHaveBeenCalled();
    expect(postUpdateMany).not.toHaveBeenCalled();
  });

  it("saves the rest of the layout alongside a post's stray log key", async () => {
    await saveGridLayout(
      draft({
        loggers: { "post:abc": true },
        spans: { "post:abc": 2 },
      }),
    );
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridSpan: 2 },
    });
  });

  it("creates an inserted component with the log panel it was given", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          {
            key: "pending:1",
            componentId: "calchemy",
            index: 0,
            logger: true,
          },
        ],
        loggers: { "pending:1": false },
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ logger: false }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// The card a publication CARRIES — the link card's picture, words and
// destination, which for that one entry are the whole component.
// ---------------------------------------------------------------------------
describe("saveGridLayout — configuration", () => {
  beforeEach(() => {
    [
      postUpdate,
      postUpdateMany,
      componentUpdate,
      componentUpdateMany,
      componentCreate,
      componentDelete,
    ].forEach((fn) => fn.mockReset());
  });

  const config = {
    content: { title: "Shader Playground", tone: "dark" as const },
    link: { kind: "internal" as const, href: "/playground/shader" },
  };

  it("writes a card's configuration to its own props column", async () => {
    await saveGridLayout(draft({ props: { "component:xyz": config } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { props: config },
    });
  });

  // The blob replaces what is stored, so a section the author removed arrives
  // as an absent key and lands as one. A merge could never clear anything.
  it("writes an emptied configuration as empty", async () => {
    await saveGridLayout(draft({ props: { "component:xyz": {} } }));
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { props: {} },
    });
  });

  it("sends a seat, a shape and a configuration as one update", async () => {
    await saveGridLayout(
      draft({
        pins: { "component:xyz": 1 },
        aspects: { "component:xyz": "1/1" },
        props: { "component:xyz": config },
      }),
    );
    expect(componentUpdate).toHaveBeenCalledOnce();
    expect(componentUpdate).toHaveBeenCalledWith({
      where: { id: "xyz" },
      data: { gridIndex: 1, aspect: "1/1", props: config },
    });
  });

  // A post row has no `props` column, so a key naming one is dropped before any
  // write is built — reaching Prisma with it would throw and take the rest of
  // the layout down with it.
  it("attempts no write for a post", async () => {
    await saveGridLayout(draft({ props: { "post:abc": config } }));
    expect(postUpdate).not.toHaveBeenCalled();
    expect(postUpdateMany).not.toHaveBeenCalled();
  });

  // A link card is PLACED and then filled in, so the whole of authoring one
  // happens before the row exists. All of it has to reach the row the save
  // creates.
  it("carries an unsaved card's configuration into the row it creates", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          { key: "pending:1", componentId: "link-card", index: 0 },
        ],
        props: { "pending:1": config },
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          componentId: "link-card",
          props: config,
        }),
      }),
    );
  });

  // A demo's content is its own code, so a publication of one has nothing to
  // put here — and null is the honest record of that rather than `{}`.
  it("creates an ordinary demo with no configuration at all", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          { key: "pending:1", componentId: "calchemy-demo", index: 0 },
        ],
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ props: null }),
      }),
    );
  });

  // Typed by hand rather than chosen from a control, so it is the one field on
  // this table that can arrive malformed from a tampered client. "example.com"
  // as an external href would render as a relative link INTO this site.
  it("refuses a destination of the wrong shape", async () => {
    await expect(
      saveGridLayout(
        draft({
          props: {
            "component:xyz": {
              link: { kind: "external", href: "example.com" },
            },
          },
        }),
      ),
    ).rejects.toThrow();
    expect(componentUpdate).not.toHaveBeenCalled();
  });
});
