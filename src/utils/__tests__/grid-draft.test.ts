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
  gridIndex,
  publishedAt: new Date(`2026-01-0${id.length}`),
  aspect: "16/9",
  span: 1,
});

const comp = (id: string, gridIndex: number | null = null): GridCard => ({
  kind: "component",
  key: `component:${id}`,
  id,
  componentId: "demo",
  logger: false,
  gridIndex,
  publishedAt: new Date("2026-01-01"),
  aspect: "3/2",
  span: 1,
});

const keys = (cards: GridCard[]) => cards.map((c) => c.key);

describe("applyGridDraft", () => {
  // Identity, on input that is ALREADY in grid order — which is what
  // `getGridCards` hands over. Newest first, so "ccc" (Jan 3) leads.
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
    // The input is the server's list and must survive for a discard.
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

  // A pending card has no database row, so anything acting on it must be able
  // to tell — sending its key to the server as an id would 500.
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
    // The server's copy is what a discard restores, so it must be untouched.
    expect(cards[0].span).toBe(1);
  });

  it("leaves every card the draft did not widen at the width it came with", () => {
    const out = applyGridDraft([post("a"), post("bb")], {
      ...emptyGridDraft(),
      spans: { "post:a": 3 },
    });
    expect(out.find((c) => c.key === "post:bb")?.span).toBe(1);
  });

  // A card can be widened and moved in the same session, and the two edits are
  // recorded separately — applying one must not drop the other.
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
  // A shape is a property of the CARD, not of its seat, but it is edited in the
  // same session as the seat and has to be discardable with it — so it buffers
  // here alongside the placements and only parts ways at the write.
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

  // The registry hands an unsaved insert its default shape; overriding it
  // before the row exists has to reach the card on screen, or the picker looks
  // broken on exactly the card you just added.
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

  // Widening a card is an edit like any other: an exit that called this draft
  // clean would throw the change away without saying it had.
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
