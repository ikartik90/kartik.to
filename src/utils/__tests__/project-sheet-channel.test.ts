import { describe, it, expect, vi } from "vitest";
import {
  openProjectSheet,
  subscribeProjectSheet,
} from "../project-sheet-channel";

describe("project sheet channel", () => {
  it("hands the project to the mounted sheets, and says one took it", () => {
    const listener = vi.fn();
    const stop = subscribeProjectSheet(listener);

    expect(openProjectSheet("onboarding")).toBe(true);
    expect(listener).toHaveBeenCalledExactlyOnceWith("onboarding");

    stop();
  });

  it("says none took it once the sheets unsubscribe", () => {
    const listener = vi.fn();
    subscribeProjectSheet(listener)();

    expect(openProjectSheet("onboarding")).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
