// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { segmentEntries } from "../entries.ts";

let app: string;
const touch = (file: string) => {
  mkdirSync(dirname(join(app, file)), { recursive: true });
  writeFileSync(join(app, file), "");
};
const relative = (file: string) => file.slice(app.length + 1);

beforeAll(() => {
  app = mkdtempSync(join(tmpdir(), "page-styles-entries-"));
  ["layout.tsx", "page.tsx", "not-found.tsx", "dive/layout.tsx", "dive/page.tsx", "dive/projects/[id]/page.tsx", "writing/[slug]/page.tsx"].forEach(touch);
  ["writing/[slug]/opengraph-image.tsx", "writing/[slug]/md/route.ts", "__tests__/page.test.tsx", "dive/card.tsx"].forEach(touch);
});

afterAll(() => rmSync(app, { recursive: true, force: true }));

describe("segmentEntries", () => {
  it("lists every page and not-found page, each with the layouts it renders in, outermost first", () => {
    const entries = segmentEntries(app).map(({ entry, files }) => [relative(entry), files.map(relative)]);
    expect(Object.fromEntries(entries)).toEqual({
      "page.tsx": ["layout.tsx", "page.tsx"],
      "not-found.tsx": ["layout.tsx", "not-found.tsx"],
      "dive/page.tsx": ["layout.tsx", "dive/layout.tsx", "dive/page.tsx"],
      "dive/projects/[id]/page.tsx": ["layout.tsx", "dive/layout.tsx", "dive/projects/[id]/page.tsx"],
      "writing/[slug]/page.tsx": ["layout.tsx", "writing/[slug]/page.tsx"],
    });
  });

  it("names each entry's stylesheet beside it", () => {
    const sheets = segmentEntries(app).map(({ sheet }) => relative(sheet));
    expect(sheets).toContain("not-found.styles.css");
    expect(sheets).toContain("dive/projects/[id]/page.styles.css");
  });
});
