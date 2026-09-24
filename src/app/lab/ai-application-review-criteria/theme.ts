import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { css } from "../../../../styled-system/css";

// ---------------------------------------------------------------------------
// The look of the product this prototype is set in, and nobody else's.
//
// The prototype is a feature proposed INSIDE a recruiting product, so it is
// drawn in that product's clothes — Figma 94:4840 — and not the site's. None of
// these values belongs in panda.config.ts: they are one screen's props, and a
// site token named after them would be offered to every other page.
//
// So they are custom properties on the prototype's root, set once here and read
// as `var(--cashby-…)` by every style under it. "Cashby" is the invented
// company in the mock's account menu.
// ---------------------------------------------------------------------------

/** Inter, loaded for this route alone — `next/font` scopes it to where it is applied. */
export const inter = Inter({
  subsets: ["latin"],
  // The drawer sets one phrase in italic; without the face the browser slants
  // the upright one.
  style: ["normal", "italic"],
  variable: "--font-cashby",
  display: "swap",
});

/**
 * Inter's → and nothing else. Google's `latin` subset of Inter has ↑ and ↓ but
 * not →, which the benchmark's outcomes are written with, and `next/font` has
 * no way to ask for one more character — so it is here, cut from the same
 * Inter by Google Fonts' `text=` subsetting, and limited to that one code
 * point. No fallback of its own: next/font's would stand in for EVERY other
 * character, ahead of Inter.
 */
export const interArrow = localFont({
  src: "./fonts/inter-arrow.woff2",
  weight: "400",
  variable: "--font-cashby-arrow",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+2192" }],
});

export const cashbyTheme = css({
  // Palette. Hairlines and washes are translucent in the source, so they are
  // here too: they tint whatever they sit on.
  "--cashby-canvas": "#f6f5fa",
  "--cashby-bar": "#fcfcfe",
  "--cashby-surface": "#ffffff",
  "--cashby-ink": "#414244",
  "--cashby-ink-muted": "rgba(65, 66, 68, 0.5)",
  "--cashby-ink-disabled": "rgba(65, 66, 68, 0.25)",
  "--cashby-slate": "#576675",
  "--cashby-slate-muted": "rgba(87, 102, 117, 0.5)",
  "--cashby-slate-subtle": "rgba(87, 102, 117, 0.75)",
  "--cashby-hairline": "rgba(87, 102, 117, 0.15)",
  "--cashby-border": "rgba(87, 102, 117, 0.25)",
  "--cashby-fill": "rgba(216, 221, 227, 0.5)",
  // What a disabled button is washed with, over the bar it sits on.
  "--cashby-veil": "rgba(255, 255, 255, 0.15)",
  "--cashby-accent": "#473bce",
  "--cashby-accent-wash": "rgba(71, 59, 206, 0.15)",
  "--cashby-accent-ring": "rgba(71, 59, 206, 0.5)",
  "--cashby-positive": "#00875a",
  "--cashby-positive-ink": "#046b3d",
  "--cashby-positive-wash": "rgba(4, 107, 61, 0.1)",
  "--cashby-positive-border": "rgba(4, 107, 61, 0.25)",
  "--cashby-caution-ink": "#ab4a00",
  "--cashby-caution-wash": "rgba(171, 74, 0, 0.1)",
  "--cashby-caution-border": "rgba(171, 74, 0, 0.25)",
  // The benchmark's results (Figma 73:2989): a criterion met, not met or
  // undecided; the three known outcomes; a score at, below or without the bar.
  "--cashby-negative": "#d92616",
  "--cashby-caution": "#e06100",
  "--cashby-warning": "#f3bf4f",
  "--cashby-fill-solid": "#d8dde3",
  "--cashby-positive-tag": "rgba(4, 107, 61, 0.15)",
  "--cashby-caution-tag": "rgba(171, 74, 0, 0.15)",
  // What a mismatched row is washed with, and every other row is striped with.
  "--cashby-caution-tint": "rgba(171, 74, 0, 0.05)",
  // What the results' footer is washed with when every one of them matches.
  "--cashby-positive-tint": "rgba(4, 107, 61, 0.05)",
  "--cashby-stripe": "rgba(216, 221, 227, 0.15)",
  // What a modal lays over everything behind it: the ink, at half.
  "--cashby-scrim": "rgba(65, 66, 68, 0.5)",
  // The wash the intro's pictures are laid on, lilac into rose (Figma 133:6248).
  "--cashby-cover-lilac": "#dedcf7",
  "--cashby-cover-rose": "#f4d1db",

  // Type, as `font` shorthands: weight, size / line height, family. The source
  // sets every run at one of these.
  // The arrow first: it answers for → alone, which Inter's subset lacks and
  // Inter's own fallback (Arial) would otherwise draw.
  "--cashby-family":
    "var(--font-cashby-arrow), var(--font-cashby), system-ui, sans-serif",
  "--cashby-text-fine": "400 10px/16px var(--cashby-family)",
  // The small evaluation ring's count and average score's figure, in the
  // intro's pictures (Figma 133:6294, 132:6205).
  "--cashby-text-ring-small": "400 9px/15px var(--cashby-family)",
  "--cashby-text-small": "400 12px/20px var(--cashby-family)",
  "--cashby-text-label": "500 12px/20px var(--cashby-family)",
  "--cashby-text-small-bold": "700 12px/20px var(--cashby-family)",
  "--cashby-text-body": "400 14px/24px var(--cashby-family)",
  "--cashby-text-body-strong": "500 14px/24px var(--cashby-family)",
  "--cashby-text-tab": "500 14px/20px var(--cashby-family)",
  "--cashby-text-button": "400 16px/28px var(--cashby-family)",
  "--cashby-text-card-title": "600 16px/28px var(--cashby-family)",
  "--cashby-text-section-title": "600 20px/32px var(--cashby-family)",
  "--cashby-text-page-title": "600 32px/40px var(--cashby-family)",

  // The hairline every border in the source is drawn at.
  "--cashby-rule": "0.5px",

  // The source draws no focus state, so this is ours: the product's accent, at
  // the weight the site's own ring is drawn at.
  "--cashby-focus-ring": "0 0 0 1.5px var(--cashby-accent)",

  // A light product whatever the site's own theme is — the scrollbars and any
  // native control included.
  colorScheme: "light",
  font: "var(--cashby-text-body)",
  color: "var(--cashby-ink)",
  backgroundColor: "var(--cashby-canvas)",
  // The site selects text in its own pink; the product in its accent.
  "& ::selection": {
    backgroundColor: "var(--cashby-accent-wash)",
    color: "inherit",
  },
});
