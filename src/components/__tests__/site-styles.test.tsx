import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteStyles } from "../site-styles";

const { loadSiteStyles, settled } = vi.hoisted(() => ({
  loadSiteStyles: vi.fn(() => Promise.resolve()),
  settled: { now: false },
}));
vi.mock("@/utils/site-styles", () => ({ loadSiteStyles }));
vi.mock("@/hooks/use-first-fold-settled", () => ({ useFirstFoldSettled: () => settled.now }));

afterEach(() => {
  cleanup();
  loadSiteStyles.mockClear();
});

describe("SiteStyles", () => {
  it("adds the whole stylesheet once the first fold has settled, and not before", () => {
    settled.now = false;
    const { rerender } = render(<SiteStyles />);
    expect(loadSiteStyles).not.toHaveBeenCalled();

    settled.now = true;
    rerender(<SiteStyles />);
    expect(loadSiteStyles).toHaveBeenCalledOnce();
  });
});
