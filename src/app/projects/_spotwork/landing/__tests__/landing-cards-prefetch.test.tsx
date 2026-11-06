// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

const loadLiveApp = vi.hoisted(() => vi.fn(() => new Promise(() => {})));
vi.mock("../../use-live-app", async (original) => ({ ...(await original()), loadLiveApp }));

describe("the project cards' module", () => {
  it("starts fetching the prototype's code as soon as it runs, before any card renders", async () => {
    await import("../landing-cards");
    expect(loadLiveApp).toHaveBeenCalledOnce();
  });
});
