import { describe, expect, it } from "vitest";
import {
  ComponentAspectSchema,
  ComponentSchema,
  GridSpanSchema,
  CreateComponentInputSchema,
  UpdateComponentInputSchema,
} from "../component";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { MAX_GRID_SPAN } from "@/utils/listing-columns";

const publishedRow = {
  id: "ckl0000000000000000000000",
  componentId: "calchemy-demo",
  aspect: "3/2",
  logger: true,
  gridIndex: 0,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ComponentSchema", () => {
  it("accepts a row with every override stated", () => {
    expect(ComponentSchema.safeParse(publishedRow).success).toBe(true);
  });

  it("rejects a negative grid position", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridIndex: -1 }).success,
    ).toBe(false);
  });

  it("accepts a row that states no overrides at all", () => {
    const { aspect, logger, gridIndex, publishedAt, ...bare } = publishedRow;
    expect(ComponentSchema.safeParse(bare).success).toBe(true);
  });

  it("accepts the nulls Prisma returns for unset columns", () => {
    expect(
      ComponentSchema.safeParse({
        ...publishedRow,
        aspect: null,
        logger: null,
        gridIndex: null,
        publishedAt: null,
      }).success,
    ).toBe(true);
  });

  it("accepts position zero — the front of the grid is pinnable", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridIndex: 0 }).success,
    ).toBe(true);
  });

  it("rejects a fractional grid position", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridIndex: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects an empty componentId", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, componentId: "" }).success,
    ).toBe(false);
  });

  it("accepts two publications of the same demo at different aspects", () => {
    const wide = { ...publishedRow, id: "a", aspect: "16/9" };
    const tall = { ...publishedRow, id: "b", aspect: "9/16" };
    expect(ComponentSchema.safeParse(wide).success).toBe(true);
    expect(ComponentSchema.safeParse(tall).success).toBe(true);
  });

  it("accepts a componentId no registry entry claims", () => {
    expect(
      ComponentSchema.safeParse({
        ...publishedRow,
        componentId: "demo-that-was-deleted",
      }).success,
    ).toBe(true);
  });

  it("rejects a logger override that is a config object rather than a flag", () => {
    expect(
      ComponentSchema.safeParse({
        ...publishedRow,
        logger: { emptyHint: "Type something" },
      }).success,
    ).toBe(false);
  });
});

describe("ComponentAspectSchema", () => {
  // Literals on purpose: looping over `ASPECT_RATIOS` could never disagree with the implementation.
  it.each([
    "1/1",
    "4/3",
    "3/4",
    "16/9",
    "9/16",
    "2/1",
    "1/2",
    "3/2",
    "2/3",
    "6/5",
    "5/6",
  ])("accepts the %s frame", (ratio) => {
    expect(ComponentAspectSchema.safeParse(ratio).success).toBe(true);
  });

  it("rejects a ratio the frame cannot draw", () => {
    expect(ComponentAspectSchema.safeParse("7/5").success).toBe(false);
    expect(ComponentAspectSchema.safeParse("21/9").success).toBe(false);
  });

  it("rejects the retired size names", () => {
    expect(ComponentAspectSchema.safeParse("lg").success).toBe(false);
  });

  it("rejects the colon spelling — the keys match CSS aspect-ratio", () => {
    expect(ComponentAspectSchema.safeParse("16:9").success).toBe(false);
  });

  it("offers exactly the ratios ASPECT_RATIOS defines", () => {
    expect([...ComponentAspectSchema.options].sort()).toEqual(
      Object.keys(ASPECT_RATIOS).sort(),
    );
  });
});

describe("CreateComponentInputSchema", () => {
  it("accepts a publication that names only the demo it publishes", () => {
    expect(
      CreateComponentInputSchema.safeParse({ componentId: "calchemy-demo" })
        .success,
    ).toBe(true);
  });

  it("strips id when included (Zod default strip mode)", () => {
    const result = CreateComponentInputSchema.safeParse({
      id: "ckl0000000000000000000000",
      componentId: "calchemy-demo",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("id" in result.data).toBe(false);
  });

  it("rejects input with no componentId — a publication must publish something", () => {
    expect(CreateComponentInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("UpdateComponentInputSchema", () => {
  it("accepts an id plus the single field being changed", () => {
    expect(
      UpdateComponentInputSchema.safeParse({
        id: "ckl0000000000000000000000",
        gridIndex: 4,
      }).success,
    ).toBe(true);
  });

  it("accepts clearing an override back to the registry's value", () => {
    const result = UpdateComponentInputSchema.safeParse({
      id: "ckl0000000000000000000000",
      aspect: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.aspect).toBeNull();
  });

  it("rejects an update with no id — there is nothing to address", () => {
    expect(UpdateComponentInputSchema.safeParse({ gridIndex: 4 }).success).toBe(
      false,
    );
  });
});

describe("GridSpanSchema", () => {
  it("accepts every width the grid can actually draw", () => {
    for (let span = 1; span <= MAX_GRID_SPAN; span += 1) {
      expect(GridSpanSchema.safeParse(span).success).toBe(true);
    }
  });

  it("rejects a span narrower than one column", () => {
    expect(GridSpanSchema.safeParse(0).success).toBe(false);
    expect(GridSpanSchema.safeParse(-1).success).toBe(false);
  });

  it("rejects a span wider than the grid", () => {
    expect(GridSpanSchema.safeParse(MAX_GRID_SPAN + 1).success).toBe(false);
  });

  it("rejects a fractional span", () => {
    expect(GridSpanSchema.safeParse(1.5).success).toBe(false);
  });
});

describe("ComponentSchema — gridSpan", () => {
  it("accepts a widened publication", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridSpan: 2 }).success,
    ).toBe(true);
  });

  it("accepts a publication with no width of its own", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridSpan: null }).success,
    ).toBe(true);
  });

  it("rejects a width the grid cannot draw", () => {
    expect(
      ComponentSchema.safeParse({ ...publishedRow, gridSpan: 0 }).success,
    ).toBe(false);
  });
});
