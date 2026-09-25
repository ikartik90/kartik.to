import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { css } from "../../../../styled-system/css";

// The mocked product's look, scoped to the prototype root. Deliberately not Panda
// tokens: these belong to this one screen, not the site.

export const inter = Inter({
  subsets: ["latin"],
  // One phrase is italic; without the face the browser fakes the slant.
  style: ["normal", "italic"],
  variable: "--font-cashby",
  display: "swap",
});

// Inter's → alone, which its `latin` subset lacks. No fallback font: next/font's
// would stand in ahead of Inter for every other character.
export const interArrow = localFont({
  src: "./fonts/inter-arrow.woff2",
  weight: "400",
  variable: "--font-cashby-arrow",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+2192" }],
});

export const cashbyTheme = css({
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
  "--cashby-negative": "#d92616",
  "--cashby-caution": "#e06100",
  "--cashby-warning": "#f3bf4f",
  "--cashby-fill-solid": "#d8dde3",
  "--cashby-positive-tag": "rgba(4, 107, 61, 0.15)",
  "--cashby-caution-tag": "rgba(171, 74, 0, 0.15)",
  "--cashby-caution-tint": "rgba(171, 74, 0, 0.05)",
  "--cashby-positive-tint": "rgba(4, 107, 61, 0.05)",
  "--cashby-stripe": "rgba(216, 221, 227, 0.15)",
  "--cashby-scrim": "rgba(65, 66, 68, 0.5)",
  "--cashby-cover-lilac": "#dedcf7",
  "--cashby-cover-rose": "#f4d1db",

  // Arrow face first: it covers only →, which Inter's subset lacks.
  "--cashby-family":
    "var(--font-cashby-arrow), var(--font-cashby), system-ui, sans-serif",
  "--cashby-text-fine": "400 10px/16px var(--cashby-family)",
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

  "--cashby-rule": "0.5px",

  "--cashby-focus-ring": "0 0 0 1.5px var(--cashby-accent)",

  colorScheme: "light",
  font: "var(--cashby-text-body)",
  color: "var(--cashby-ink)",
  backgroundColor: "var(--cashby-canvas)",
  "& ::selection": {
    backgroundColor: "var(--cashby-accent-wash)",
    color: "inherit",
  },
});
