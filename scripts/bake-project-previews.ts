// Bakes each homepage project's link preview: its card's face, hovered, filling 1200 × 630, without its frame or icon.
// Run against a dev server whenever a card's words or figure change:
//   node scripts/bake-project-previews.ts [https://localhost:3000]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import { OPEN_CARDS, projectPreviewPath } from "../src/app/_project-stacks/data.ts";

const BASE = process.argv[2] ?? "https://localhost:3000";
// Drawn at 1.5x, so the face is about as tall as a full-size card (400px), the size its figure is drawn for.
const SCALE = 1.5;
const STAGE = { width: 1200 / SCALE, height: 630 / SCALE };
const clip = { x: 0, y: 0, ...STAGE };

const browser = await chromium.launch();
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: SCALE,
  colorScheme: "light",
});

for (const { id } of OPEN_CARDS) {
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    ({ id, STAGE }) => {
      const card = document.querySelector<HTMLElement>(`a[data-sheet-card="${id}"]`);
      const surface = card?.querySelector<HTMLElement>("[data-sheet-source]");
      const text = card?.querySelector<HTMLElement>("[data-face-text]");
      if (!card || !surface || !text) throw new Error(`No card for ${id}`);
      // At the card's own measure, so the heading wraps where it does on the card.
      text.style.width = `${text.offsetWidth}px`;
      const stage = document.createElement("div");
      stage.id = "preview-stage";
      Object.assign(stage.style, {
        position: "fixed",
        inset: "0 auto auto 0",
        zIndex: "2147483647",
        width: `${STAGE.width}px`,
        height: `${STAGE.height}px`,
        background: "var(--colors-bg-canvas)",
      });
      card.style.setProperty("width", `${STAGE.width}px`, "important");
      card.style.setProperty("margin", "0", "important");
      card.style.setProperty("--slide-aspect", String(STAGE.width / STAGE.height));
      // Square, and without the surface's two drawn layers: the frame's line and the expand icon.
      surface.style.setProperty("clip-path", "none", "important");
      surface.querySelectorAll<HTMLElement>(":scope > [aria-hidden]").forEach((layer) => (layer.style.display = "none"));
      stage.append(card);
      document.body.append(stage);
    },
    { id, STAGE },
  );
  await page.hover(`#preview-stage [data-sheet-card="${id}"]`);

  // Until the figure's hover play settles.
  let shot = await page.screenshot({ clip });
  for (let tries = 0; tries < 30; tries++) {
    await page.waitForTimeout(400);
    const next = await page.screenshot({ clip });
    if (next.equals(shot)) break;
    shot = next;
  }

  const file = `public${projectPreviewPath(id)}`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, shot);
  console.log(`${id} → ${file}`);
}

await browser.close();
