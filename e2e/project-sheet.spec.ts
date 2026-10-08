import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// History steps taken while the sheet is still moving: once it settles, it shows what the address says.

const TITLES: Record<string, string> = { "shift-scheduling": "Shift scheduling", onboarding: "Company onboarding" };

// The sheet's own moving parts: the dialog and its backdrop, the panel, its track, the face's lines and the steps.
const SHEET_PARTS = "dialog, [data-sheet-panel], [data-sheet-panel] > div, [data-sheet-step], [data-face-title], [data-face-word]";

/** The address and the open sheet's name, once the sheet has been still for a while. */
async function settled(page: Page) {
  await page.waitForFunction(
    (parts) =>
      new Promise<boolean>((resolve) => {
        let still = 0;
        const frame = () => {
          const moving = document
            .getAnimations()
            .some(
              (a) =>
                (a.playState === "running" || a.playState === "paused") &&
                (a.effect as KeyframeEffect | null)?.target?.matches(parts),
            );
          still = moving ? 0 : still + 1;
          if (still >= 20) resolve(true);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    SHEET_PARTS,
  );
  return page.evaluate(() => ({
    path: window.location.pathname,
    sheet: document.querySelector("[data-sheet-panel]")?.closest("dialog[open]")?.getAttribute("aria-label") ?? null,
  }));
}

/** The sheet the address says, or none. */
const sheetAt = (path: string, base: string) => TITLES[path.slice(`${base}/projects/`.length)] ?? null;

// Each case a few times over: the race goes either way from one run to the next.
const RUNS = 4;

for (const base of ["", "/dive"]) {
  const home = base || "/";

  test.describe(`a project's sheet${base ? ` under ${base}` : ""}, mid-animation`, () => {
    test.describe.configure({ timeout: 120_000 });

    test.beforeEach(async ({ page }) => {
      await page.route("https://inflight.co/**", (route) => route.abort());
    });

    const openShift = async (page: Page) => {
      await page.goto(home);
      await page.getByRole("link", { name: /^Shift scheduling:/ }).click();
    };

    test("closes on Back taken as it goes to the next project", async ({ page, pageFailures }) => {
      for (let run = 0; run < RUNS; run++) {
        await openShift(page);
        await page.getByRole("dialog").getByRole("link", { name: /^Next/ }).click();
        await page.goBack({ waitUntil: "commit" });
        expect(await settled(page), `run ${run}`).toEqual({ path: home, sheet: null });

        await page.goForward({ waitUntil: "commit" });
        const { path, sheet } = await settled(page);
        expect(sheet, `run ${run}: ${path}`).not.toBeNull();
        expect(sheet, `run ${run}`).toBe(sheetAt(path, base));
      }
      expect(pageFailures).toEqual([]);
    });

    test("closes from its Close button pressed as it goes to the next project", async ({
      page,
      pageFailures,
      isMobile,
    }) => {
      test.skip(isMobile, "A bottom sheet has no Close button: it is swiped down.");
      for (let run = 0; run < RUNS; run++) {
        await openShift(page);
        const sheet = page.getByRole("dialog");
        await sheet.getByRole("link", { name: /^Next/ }).click();
        await sheet.getByRole("button", { name: "Close" }).click({ force: true });
        expect(await settled(page), `run ${run}`).toEqual({ path: home, sheet: null });
      }
      expect(pageFailures).toEqual([]);
    });

    test("opens again on Forward taken as Back closes it", async ({ page, pageFailures }) => {
      for (let run = 0; run < RUNS; run++) {
        await openShift(page);
        await page.goBack({ waitUntil: "commit" });
        await page.goForward({ waitUntil: "commit" });
        expect(await settled(page), `run ${run}`).toEqual({
          path: `${base}/projects/shift-scheduling`,
          sheet: "Shift scheduling",
        });
      }
      expect(pageFailures).toEqual([]);
    });
  });
}
