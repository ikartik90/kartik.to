import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@js-temporal/polyfill");
  vi.resetModules();
});

describe("Temporal", () => {
  it("is the browser's own where it has one, and the polyfill is never fetched", async () => {
    const native = { Now: {} };
    vi.stubGlobal("Temporal", native);
    const fetched = vi.fn();
    vi.doMock("@js-temporal/polyfill", () => {
      fetched();
      return { Temporal: { polyfill: true } };
    });
    const { Temporal } = await import("../temporal");
    expect(Temporal).toBe(native);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("is the polyfill where the browser has none", async () => {
    vi.stubGlobal("Temporal", undefined);
    const polyfill = { polyfill: true };
    vi.doMock("@js-temporal/polyfill", () => ({ Temporal: polyfill }));
    const { Temporal } = await import("../temporal");
    expect(Temporal).toBe(polyfill);
  });
});
