import { describe, it, expect } from "vitest";
import { listingColumnsFor } from "@/utils/listing-columns";

describe("listingColumnsFor", () => {
  it("gives a lone card the whole grid", () => {
    expect(listingColumnsFor(1)).toBe(1);
  });

  it("splits two and four in half", () => {
    expect(listingColumnsFor(2)).toBe(2);
    expect(listingColumnsFor(4)).toBe(2);
  });

  it("runs three-up for a set of three, which fills one row exactly", () => {
    expect(listingColumnsFor(3)).toBe(3);
  });

  it("runs three-up past four, whatever the remainder", () => {
    expect(listingColumnsFor(5)).toBe(3);
    expect(listingColumnsFor(6)).toBe(3);
    expect(listingColumnsFor(7)).toBe(3);
    expect(listingColumnsFor(8)).toBe(3);
    expect(listingColumnsFor(100)).toBe(3);
  });

  it("never asks for fewer than one column, so an empty listing stays valid CSS", () => {
    expect(listingColumnsFor(0)).toBe(1);
    expect(listingColumnsFor(-1)).toBe(1);
  });
});
