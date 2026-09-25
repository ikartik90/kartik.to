import { describe, it, expect } from "vitest";
import { readIconSvg } from "@/utils/icon-svg";
import { iconTitleFrom, type IconAsset } from "@/domain/icon";
import { archiveNameFor, downloadPlanFor, iconFilesFor } from "../icon-download";

const CHECK = `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10L9 15L16 5" stroke="white" stroke-width="1.25"/></svg>`;
const CLOSE = `<svg viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12" stroke="#000" stroke-width="1"/></svg>`;

function asset(name: string, native: number): IconAsset {
  return {
    key: `icons/${name}`,
    url: `https://cdn.example.com/icons/${name}`,
    name,
    native,
    flattened: false,
    review: "approved",
    title: iconTitleFrom(name),
    aliases: [],
  };
}

const CHOSEN = [
  { icon: asset("check.svg", 20), svg: readIconSvg(CHECK)! },
  { icon: asset("close.svg", 16), svg: readIconSvg(CLOSE)! },
];

describe("iconFilesFor", () => {
  it("bakes each icon at the settings on screen", () => {
    const files = iconFilesFor(CHOSEN, { size: 24, stroke: 1.5 });

    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("check-24-1.5.svg");
    expect(files[0].text).toContain('viewBox="0 0 24 24"');
    expect(files[0].text).toContain('stroke-width="1.25"');
  });

  it("scales the 16-grid half of the set up to the same box", () => {
    const [, close] = iconFilesFor(CHOSEN, { size: 24, stroke: 1.5 });
    expect(close.text).toContain('viewBox="0 0 24 24"');
    expect(close.text).toContain('<g transform="scale(1.5)">');
    // 1.5px at 24 is 1 unit on a 16 grid — the weight it was drawn at.
    expect(close.text).toContain('stroke-width="1"');
  });

  it("skips an icon whose file never arrived rather than writing an empty one", () => {
    const files = iconFilesFor(
      [...CHOSEN, { icon: asset("ghost.svg", 20), svg: null }],
      { size: 20, stroke: 1.25 },
    );
    expect(files.map((file) => file.name)).toEqual([
      "check-20-1.25.svg",
      "close-20-1.25.svg",
    ]);
  });

  it("numbers a repeated name, since two objects may share one", () => {
    const files = iconFilesFor(
      [CHOSEN[0], { icon: asset("check.svg", 20), svg: readIconSvg(CHECK)! }],
      { size: 20, stroke: 1.25 },
    );
    expect(files.map((file) => file.name)).toEqual([
      "check-20-1.25.svg",
      "check-20-1.25-2.svg",
    ]);
  });
});

describe("downloadPlanFor", () => {
  it("hands back one icon as the icon itself, not an archive of one", async () => {
    const plan = downloadPlanFor(iconFilesFor([CHOSEN[0]], { size: 20, stroke: 1.25 }));

    expect(plan?.filename).toBe("check-20-1.25.svg");
    expect(plan?.blob.type).toBe("image/svg+xml");
    expect(await plan?.blob.text()).toContain("<svg");
  });

  it("archives two or more", async () => {
    const plan = downloadPlanFor(
      iconFilesFor(CHOSEN, { size: 20, stroke: 1.25 }),
      "icons-20-1.25.zip",
    );

    expect(plan?.filename).toBe("icons-20-1.25.zip");
    expect(plan?.blob.type).toBe("application/zip");
    const head = new Uint8Array(await plan!.blob.arrayBuffer()).subarray(0, 4);
    expect(Array.from(head)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("plans nothing for nothing", () => {
    expect(downloadPlanFor([])).toBeNull();
  });
});

describe("archiveNameFor", () => {
  it("says the settings the set was baked at", () => {
    expect(archiveNameFor({ size: 24, stroke: 1.5 })).toBe("icons-24-1.5.zip");
  });
});
