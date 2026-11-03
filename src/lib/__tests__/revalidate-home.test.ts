import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

import { revalidateHome } from "../revalidate-home";

beforeEach(() => revalidatePath.mockClear());

describe("revalidateHome", () => {
  it("refreshes every page that shows the homepage: its own, each project's, and the review copy's", () => {
    revalidateHome();
    expect(revalidatePath.mock.calls).toHaveLength(4);
    expect(revalidatePath.mock.calls).toEqual(
      expect.arrayContaining([["/"], ["/projects/[id]", "page"], ["/dive"], ["/dive/projects/[id]", "page"]]),
    );
  });
});
