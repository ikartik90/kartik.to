import { expect, test } from "./fixtures";

test.describe("command palette", () => {
  test("opens on Cmd+K and closes on Escape", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeHidden();

    await page.keyboard.press("Meta+k");
    await expect(palette).toBeVisible();
    await expect(page.getByPlaceholder("Search…")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    expect(pageFailures).toEqual([]);
  });

  test("filters commands as you type", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    await page.getByPlaceholder("Search…").fill("theme");
    await expect(page.getByText("Switch to dark theme")).toBeVisible();

    await page.getByPlaceholder("Search…").fill("zzzzz");
    await expect(page.getByText("Switch to dark theme")).toBeHidden();
  });

  test("does not expose admin commands to an anonymous visitor", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");

    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    // Admin-only groups are gated on a client-side session; a logged-out
    // visitor must never see them, which is the same invariant the 404 mask
    // enforces server-side.
    await expect(page.getByText("New Blog Article")).toBeHidden();
    await expect(page.getByText("Publish")).toBeHidden();
  });
});

test.describe("theme", () => {
  test("toggling from the palette flips the theme and survives a reload", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    // `colorScheme: light` is pinned in the config, so `system` resolves light
    // and the offered command is deterministic.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.keyboard.press("Meta+k");
    await page.getByText("Switch to dark theme").click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // The inline <head> script re-applies the persisted mode before first
    // paint; if it regresses the page reloads light and flashes.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    expect(pageFailures).toEqual([]);
  });
});
