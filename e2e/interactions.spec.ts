import { expect, test } from "./fixtures";

// `ControlOrMeta` rather than `Meta`: the palette answers to ⌘ on Apple
// hardware and to Ctrl everywhere else, so a spec pressing one of them is only
// true on half the machines this suite runs on — a developer's Mac locally, a
// Linux runner in CI. Playwright's modifier resolves the same way the app does.
test.describe("command palette", () => {
  test("opens on the platform's shortcut and closes on Escape", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeHidden();

    // The chip and the listener are one fact — whichever key opens the palette
    // is the key the header offers — so the browser's platform has to be
    // readable from both ends. `process.platform` is what `ControlOrMeta`
    // resolves against, and (with the descriptor's UA override dropped in the
    // config) what the page reads too.
    await expect(page.locator("[data-site-menu-shortcut]")).toHaveText(
      process.platform === "darwin" ? "⌘K" : "Ctrl K",
    );

    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible();
    await expect(page.getByPlaceholder("Search…")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    expect(pageFailures).toEqual([]);
  });

  test("filters commands as you type", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");

    // Scoped to the dialog: the gutter's theme control offers the same act in
    // the same words, so its resting tooltip answers to this text too.
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await page.getByPlaceholder("Search…").fill("theme");
    await expect(palette.getByText("Dark theme")).toBeVisible();

    await page.getByPlaceholder("Search…").fill("zzzzz");
    await expect(palette.getByText("Dark theme")).toBeHidden();
  });

  test("does not expose admin commands to an anonymous visitor", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");

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

    await page.keyboard.press("ControlOrMeta+k");
    await page
      .getByRole("dialog", { name: "Command palette" })
      .getByText("Dark theme")
      .click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // The inline <head> script re-applies the persisted mode before first
    // paint; if it regresses the page reloads light and flashes.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    expect(pageFailures).toEqual([]);
  });

  test("the gutter control flips the theme and renames itself", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    // Scoped to the banner because the palette offers the same act in the same
    // words — this is the control in the header's right-hand gutter.
    const gutter = page.getByRole("banner");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await gutter
      .getByRole("button", { name: "Dark theme" })
      .click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // It names the theme it OFFERS, so flipping the page has to rename it —
    // a control still offering dark on a dark page is the regression here.
    await expect(
      gutter.getByRole("button", { name: "Light theme" }),
    ).toBeVisible();

    expect(pageFailures).toEqual([]);
  });
});
