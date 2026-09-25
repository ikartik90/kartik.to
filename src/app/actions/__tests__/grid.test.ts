import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocked at the session source, not `requireAdmin`, so the real admin check runs.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({
    getSession: () =>
      Promise.resolve({ data: { user: { email: "admin@example.com" } } }),
  }),
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `updateMany` is spied too, so "no write attempted" can't pass through it silently.
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

  it("creates a seatless insert unpinned", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          { key: "pending:1", componentId: "cosmic-track", index: null },
        ],
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          componentId: "cosmic-track",
          gridIndex: null,
        }),
      }),
    );
  });

  it("takes a pin made against a seatless insert", async () => {
    await saveGridLayout(
      draft({
        inserts: [
          { key: "pending:1", componentId: "cosmic-track", index: null },
        ],
        pins: { "pending:1": 4 },
      }),
    );
    expect(componentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gridIndex: 4 }),
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

  it("attempts no write for a post", async () => {
    await saveGridLayout(draft({ props: { "post:abc": config } }));
    expect(postUpdate).not.toHaveBeenCalled();
    expect(postUpdateMany).not.toHaveBeenCalled();
  });

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

describe("saveGridLayout — a post's card", () => {
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

  const card = {
    media: {
      dark: {
        type: "media" as const,
        kind: "image" as const,
        src: "https://cdn.test/media/dark.png",
      },
    },
    scrim: false,
    tone: "dark" as const,
  };

  it("writes the card to the post's own column", async () => {
    await saveGridLayout(draft({ cards: { "post:abc": card } }));
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { card },
    });
  });

  it("writes an emptied card as empty", async () => {
    await saveGridLayout(draft({ cards: { "post:abc": {} } }));
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { card: {} },
    });
  });

  it("sends a seat and a card as one update", async () => {
    await saveGridLayout(
      draft({ pins: { "post:abc": 1 }, cards: { "post:abc": card } }),
    );
    expect(postUpdate).toHaveBeenCalledOnce();
    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { gridIndex: 1, card },
    });
  });

  it("attempts no write for a component", async () => {
    await saveGridLayout(draft({ cards: { "component:xyz": card } }));
    expect(componentUpdate).not.toHaveBeenCalled();
    expect(componentUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses a tone that is not one of the two", async () => {
    await expect(
      saveGridLayout(
        // @ts-expect-error -- a tampered client is exactly what the door is for
        draft({ cards: { "post:abc": { tone: "sepia" } } }),
      ),
    ).rejects.toThrow();
    expect(postUpdate).not.toHaveBeenCalled();
  });
});
