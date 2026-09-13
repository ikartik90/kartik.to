import { describe, it, expect } from "vitest";
import {
  bakeIconSvg,
  nativeStrokeOf,
  readIconSvg,
  serializeIconSvg,
  strokeUnitsFor,
} from "../icon-svg";

/** A 20-grid icon at the house weight: one stroked path, nothing filled. */
const TWENTY = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 10L9 15L16 5" stroke="white" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** The same mark drawn on a 16 grid, where the house weight is 1. */
const SIXTEEN = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3 8L7 12L13 4" stroke="#000" stroke-width="1"/>
</svg>`;

/** Strokes flattened to outlines — nothing here answers to a stroke width. */
const FLATTENED = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<path d="M4 10L9 15L16 5L15 4L9 13L5 9Z" fill="white"/>
</svg>`;

describe("readIconSvg", () => {
  it("reads the grid the icon is drawn on", () => {
    expect(readIconSvg(TWENTY)?.viewBox).toBe(20);
    expect(readIconSvg(SIXTEEN)?.viewBox).toBe(16);
  });

  it("falls back to width/height when there is no viewBox", () => {
    const icon = readIconSvg(`<svg width="24" height="24"><path d="M0 0"/></svg>`);
    expect(icon?.viewBox).toBe(24);
  });

  it("refuses anything that is not a square SVG", () => {
    expect(readIconSvg(`<div>not an icon</div>`)).toBeNull();
    expect(readIconSvg(`<svg viewBox="0 0 32 20"><path d="M0 0"/></svg>`)).toBeNull();
    expect(readIconSvg(`<svg viewBox="0 0 20 20"></svg>`)).toBeNull();
  });

  it("marks an icon whose strokes were flattened into fills", () => {
    expect(readIconSvg(TWENTY)?.flattened).toBe(false);
    expect(readIconSvg(SIXTEEN)?.flattened).toBe(false);
    expect(readIconSvg(FLATTENED)?.flattened).toBe(true);
  });

  it("counts a mixed icon as flattened — the slider cannot tell the truth about it", () => {
    const mixed = `<svg viewBox="0 0 20 20"><path d="M1 1" stroke="#000" stroke-width="1.25"/><circle cx="5" cy="5" r="2" fill="#000"/></svg>`;
    expect(readIconSvg(mixed)?.flattened).toBe(true);
  });

  it("drops scripts, event handlers and anything else not on the allowlist", () => {
    const hostile = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <script>alert(1)</script>
      <foreignObject><div onclick="alert(2)">hi</div></foreignObject>
      <path d="M4 10L9 15" stroke="#000" stroke-width="1.25" onload="alert(3)" href="javascript:alert(4)"/>
    </svg>`;

    const icon = readIconSvg(hostile);
    const out = serializeIconSvg(icon!, { size: 20, stroke: 1.25 });

    expect(out).not.toMatch(/script|foreignObject|onload|onclick|javascript:/i);
    expect(out).toContain('d="M4 10L9 15"');
  });

  it("keeps nested groups and their transforms", () => {
    const nested = `<svg viewBox="0 0 20 20"><g transform="translate(2 2)"><path d="M1 1" stroke="#000" stroke-width="1.25"/></g></svg>`;
    const out = serializeIconSvg(readIconSvg(nested)!, { size: 20, stroke: 1.25 });
    expect(out).toContain('<g transform="translate(2 2)">');
  });
});

describe("nativeStrokeOf", () => {
  it("reads the weight the icon was drawn at", () => {
    expect(nativeStrokeOf(readIconSvg(TWENTY)!)).toBe(1.25);
    expect(nativeStrokeOf(readIconSvg(SIXTEEN)!)).toBe(1);
  });

  it("takes the commonest weight where an icon mixes two", () => {
    const twoWeights = `<svg viewBox="0 0 20 20">
      <path d="M1 1" stroke="#000" stroke-width="1.25"/>
      <path d="M2 2" stroke="#000" stroke-width="1.25"/>
      <path d="M3 3" stroke="#000" stroke-width="0.5"/>
    </svg>`;
    expect(nativeStrokeOf(readIconSvg(twoWeights)!)).toBe(1.25);
  });

  it("assumes the grid's house weight where no stroke says otherwise", () => {
    // A flattened icon has no stroke to read, and 20-grid icons are drawn at
    // 1.25 — so the ratio it would be re-weighted by is 1, not a division by
    // zero.
    expect(nativeStrokeOf(readIconSvg(FLATTENED)!)).toBe(1.25);
  });
});

describe("strokeUnitsFor", () => {
  it("renders the three house pairings at their own weight, untouched", () => {
    // 16 at 1, 20 at 1.25 and 24 at 1.5 are the SAME optical weight, so a
    // 20-grid icon asked for any of them needs exactly its drawn 1.25.
    expect(strokeUnitsFor(20, 16, 1)).toBeCloseTo(1.25);
    expect(strokeUnitsFor(20, 20, 1.25)).toBeCloseTo(1.25);
    expect(strokeUnitsFor(20, 24, 1.5)).toBeCloseTo(1.25);
  });

  it("scales a 16-grid icon's units so it lands on the asked-for pixels", () => {
    // Drawn on 16 and shown at 20: a 1.25px stroke is 1 unit on that grid,
    // which is exactly what a 16px icon is drawn at.
    expect(strokeUnitsFor(16, 20, 1.25)).toBeCloseTo(1);
    expect(strokeUnitsFor(16, 16, 1)).toBeCloseTo(1);
    expect(strokeUnitsFor(16, 24, 1.5)).toBeCloseTo(1);
  });

  it("answers in units, so the same pixels cost less on a bigger box", () => {
    expect(strokeUnitsFor(20, 20, 1.5)).toBeCloseTo(1.5);
    expect(strokeUnitsFor(20, 40, 1.5)).toBeCloseTo(0.75);
  });
});

describe("serializeIconSvg", () => {
  it("wears the asked-for box and a viewBox that agrees with it", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 24, stroke: 1.5 });
    expect(out).toContain('width="24"');
    expect(out).toContain('height="24"');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("scales a smaller grid up to the box rather than rewriting its path data", () => {
    const out = serializeIconSvg(readIconSvg(SIXTEEN)!, { size: 20, stroke: 1.25 });
    expect(out).toContain('<g transform="scale(1.25)">');
    expect(out).toContain('d="M3 8L7 12L13 4"');
  });

  it("leaves a grid that already matches the box unwrapped", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 20, stroke: 1.25 });
    expect(out).not.toContain("<g transform");
  });

  it("writes the weight the settings asked for", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 20, stroke: 1.5 });
    expect(out).toContain('stroke-width="1.5"');
  });

  it("keeps a two-weight icon's proportions when it re-weights", () => {
    const twoWeights = `<svg viewBox="0 0 20 20">
      <path d="M1 1" stroke="#000" stroke-width="1.25"/>
      <path d="M2 2" stroke="#000" stroke-width="1.25"/>
      <path d="M3 3" stroke="#000" stroke-width="0.625"/>
    </svg>`;
    // The dominant 1.25 goes to 2.5, so the hairline at half of it goes to
    // 1.25 — the icon is re-weighted, not levelled.
    const out = serializeIconSvg(readIconSvg(twoWeights)!, { size: 20, stroke: 2.5 });
    expect(out).toContain('stroke-width="2.5"');
    expect(out).toContain('stroke-width="1.25"');
  });

  it("hands its colour over to the page it is dropped into", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 20, stroke: 1.25 });
    expect(out).toContain('stroke="currentColor"');
    expect(out).not.toContain("white");

    const filled = serializeIconSvg(readIconSvg(FLATTENED)!, { size: 20, stroke: 1.25 });
    expect(filled).toContain('fill="currentColor"');
  });

  it("leaves an explicit no-fill alone — it is not a colour", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 20, stroke: 1.25 });
    expect(out).toContain('fill="none"');
  });

  it("keeps the caps and joins the icon was drawn with", () => {
    const out = serializeIconSvg(readIconSvg(TWENTY)!, { size: 20, stroke: 1.25 });
    expect(out).toContain('stroke-linecap="round"');
    expect(out).toContain('stroke-linejoin="round"');
  });
});

describe("bakeIconSvg", () => {
  it("is the whole trip from an uploaded file to a downloadable one", () => {
    const out = bakeIconSvg(SIXTEEN, { size: 24, stroke: 1.5 });
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('<g transform="scale(1.5)">');
    expect(out).toContain('stroke-width="1"');
  });

  it("returns nothing for a file that is not an icon", () => {
    expect(bakeIconSvg("<html><body>nope</body></html>", { size: 20, stroke: 1.25 }))
      .toBeNull();
  });
});
