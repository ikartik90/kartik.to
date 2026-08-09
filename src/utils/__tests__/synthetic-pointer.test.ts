// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isSyntheticPointer, markSyntheticPointer } from "../synthetic-pointer";

describe("synthetic pointer marking", () => {
  it("recognises an event it marked", () => {
    const event = markSyntheticPointer(new MouseEvent("pointermove"));

    expect(isSyntheticPointer(event)).toBe(true);
  });

  it("hands the event back, so a dispatch stays one expression", () => {
    const event = new MouseEvent("pointerdown");

    expect(markSyntheticPointer(event)).toBe(event);
  });

  it("leaves an unmarked event alone, untrusted or not", () => {
    // Everything jsdom (or a test) constructs is untrusted, which is exactly why
    // `isTrusted` cannot be the discriminator: it would read every stand-in for
    // a real visitor as the show.
    const event = new MouseEvent("pointermove");

    expect(event.isTrusted).toBe(false);
    expect(isSyntheticPointer(event)).toBe(false);
  });

  it("does not leak the mark onto its neighbours", () => {
    markSyntheticPointer(new MouseEvent("pointermove"));

    expect(isSyntheticPointer(new MouseEvent("pointermove"))).toBe(false);
  });
});
