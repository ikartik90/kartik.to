import { expect, test } from "./fixtures";

// `ControlOrMeta`, not `Meta`: the palette opens on ⌘ on Apple hardware and Ctrl elsewhere.
test.describe("command palette", () => {
  test("opens on the platform's shortcut and closes on Escape", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeHidden();

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

    // Scoped to the dialog: the gutter's theme tooltip has the same text.
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

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.keyboard.press("ControlOrMeta+k");
    await page
      .getByRole("dialog", { name: "Command palette" })
      .getByText("Dark theme")
      .click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    expect(pageFailures).toEqual([]);
  });

  test("the gutter control flips the theme and renames itself", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    // Scoped to the banner: the palette offers the same command text.
    const gutter = page.getByRole("banner");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await gutter
      .getByRole("button", { name: "Dark theme" })
      .click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      gutter.getByRole("button", { name: "Light theme" }),
    ).toBeVisible();

    expect(pageFailures).toEqual([]);
  });
});
