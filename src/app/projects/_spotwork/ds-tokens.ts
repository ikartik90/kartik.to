// SW Curie's variables and styles (Figma ehbl79zwNAXmMHQLT6D95G) as data, for the design system's foundation pages.

import type { TypographyVariant } from "./ui";

export type Ramp = { name: string; steps: [step: string, color: string][] };

/** Figma's white, a colour of its own beside the ramps. */
export const BASE: Ramp = { name: "Base", steps: [["", "oklch(100% 0 0)"]] };

/** The palette's colours in OKLCH, in Figma's order, each ramp from the palette generator. */
export const PALETTE: Ramp[] = [
  {
    name: "Blue Ribbon",
    steps: [
      ["50", "oklch(97% 0.0446 263.14)"],
      ["100", "oklch(93.22% 0.0578 263.14)"],
      ["200", "oklch(85.67% 0.0841 263.14)"],
      ["300", "oklch(78.11% 0.1105 263.14)"],
      ["400", "oklch(70.56% 0.1369 263.14)"],
      ["500", "oklch(63% 0.1633 263.14)"],
      ["600", "oklch(55.44% 0.1896 263.14)"],
      ["700", "oklch(47.89% 0.216 263.14)"],
      ["800", "oklch(40.33% 0.1474 263.14)"],
      ["900", "oklch(32.78% 0.0789 263.14)"],
      ["950", "oklch(29% 0.0446 263.14)"],
    ],
  },
  {
    name: "Woodsmoke",
    steps: [
      ["50", "oklch(97% 0 0)"],
      ["100", "oklch(93.22% 0 0)"],
      ["200", "oklch(85.67% 0 0)"],
      ["300", "oklch(78.11% 0 0)"],
      ["400", "oklch(70.56% 0 0)"],
      ["500", "oklch(63% 0 0)"],
      ["600", "oklch(55.44% 0 0)"],
      ["700", "oklch(47.89% 0 0)"],
      ["800", "oklch(40.33% 0 0)"],
      ["900", "oklch(32.78% 0 0)"],
      ["950", "oklch(29% 0 0)"],
    ],
  },
  {
    name: "Cinnabar",
    steps: [
      ["50", "oklch(97% 0.0446 29.72)"],
      ["100", "oklch(93.22% 0.0578 29.72)"],
      ["200", "oklch(85.67% 0.0841 29.72)"],
      ["300", "oklch(78.11% 0.1105 29.72)"],
      ["400", "oklch(70.56% 0.1369 29.72)"],
      ["500", "oklch(63% 0.1633 29.72)"],
      ["600", "oklch(55.44% 0.1896 29.72)"],
      ["700", "oklch(47.89% 0.216 29.72)"],
      ["800", "oklch(40.33% 0.1474 29.72)"],
      ["900", "oklch(32.78% 0.0789 29.72)"],
      ["950", "oklch(29% 0.0446 29.72)"],
    ],
  },
  {
    name: "Sun",
    steps: [
      ["50", "oklch(97% 0.0446 75.15)"],
      ["100", "oklch(93.22% 0.0578 75.15)"],
      ["200", "oklch(85.67% 0.0841 75.15)"],
      ["300", "oklch(78.11% 0.1105 75.15)"],
      ["400", "oklch(70.56% 0.1369 75.15)"],
      ["500", "oklch(63% 0.1633 75.15)"],
      ["600", "oklch(55.44% 0.1896 75.15)"],
      ["700", "oklch(47.89% 0.216 75.15)"],
      ["800", "oklch(40.33% 0.1474 75.15)"],
      ["900", "oklch(32.78% 0.0789 75.15)"],
      ["950", "oklch(29% 0.0446 75.15)"],
    ],
  },
  {
    name: "Crusta",
    steps: [
      ["50", "oklch(97% 0.0446 40.27)"],
      ["100", "oklch(93.22% 0.0637 40.27)"],
      ["200", "oklch(85.67% 0.1017 40.27)"],
      ["300", "oklch(78.11% 0.1398 40.27)"],
      ["400", "oklch(70.56% 0.1779 40.27)"],
      ["500", "oklch(63% 0.216 40.27)"],
      ["600", "oklch(55.44% 0.1779 40.27)"],
      ["700", "oklch(47.89% 0.1398 40.27)"],
      ["800", "oklch(40.33% 0.1017 40.27)"],
      ["900", "oklch(32.78% 0.0637 40.27)"],
      ["950", "oklch(29% 0.0446 40.27)"],
    ],
  },
  {
    name: "Apple",
    steps: [
      ["50", "oklch(97% 0.0446 147.79)"],
      ["100", "oklch(93.22% 0.0578 147.79)"],
      ["200", "oklch(85.67% 0.0841 147.79)"],
      ["300", "oklch(78.11% 0.1105 147.79)"],
      ["400", "oklch(70.56% 0.1369 147.79)"],
      ["500", "oklch(63% 0.1633 147.79)"],
      ["600", "oklch(55.44% 0.1896 147.79)"],
      ["700", "oklch(47.89% 0.216 147.79)"],
      ["800", "oklch(40.33% 0.1474 147.79)"],
      ["900", "oklch(32.78% 0.0789 147.79)"],
      ["950", "oklch(29% 0.0446 147.79)"],
    ],
  },
];

export type SystemToken = { name: string; alias: string };

const tokens = (prefix: string, entries: [name: string, alias: string][]): SystemToken[] =>
  entries.map(([name, alias]) => ({ name: `${prefix}/${name}`, alias: `Colors/${alias}` }));

/** System Tokens' colours, by their first folder; outlines beside borders. */
export const SYSTEM: { group: string; tokens: SystemToken[] }[] = [
  {
    group: "Surface",
    tokens: tokens("Surface", [
      ["Default", "Base"],
      ["Subdued", "Woodsmoke/50"],
      ["Hover", "Woodsmoke/50"],
      ["Selected", "Blue Ribbon/50"],
      ["Target", "Blue Ribbon/50"],
      ["Info", "Blue Ribbon/50"],
      ["Success", "Apple/50"],
      ["Warning", "Sun/50"],
      ["Alert", "Cinnabar/50"],
      ["Badge Alert", "Cinnabar/500"],
      ["Disabled", "Woodsmoke/100"],
      ["Avatar", "Crusta/50"],
      ["Inverted/Default", "Woodsmoke/950"],
      ["Inverted/Subdued", "Woodsmoke/900"],
      ["Inverted/Selected", "Blue Ribbon/700"],
      ["Inverted/Info", "Blue Ribbon/700"],
      ["Inverted/Success", "Apple/700"],
      ["Inverted/Warning", "Sun/700"],
      ["Inverted/Alert", "Cinnabar/700"],
      ["Inverted/Disabled", "Woodsmoke/600"],
      ["Inverted/Disabled Selected", "Blue Ribbon/200"],
      ["Button/Primary/Affirmative Default", "Blue Ribbon/600"],
      ["Button/Primary/Affirmative Hover", "Blue Ribbon/700"],
      ["Button/Primary/Affirmative Pressed", "Blue Ribbon/800"],
      ["Button/Primary/Destructive Default", "Cinnabar/600"],
      ["Button/Primary/Destructive Hover", "Cinnabar/700"],
      ["Button/Primary/Destructive Pressed", "Cinnabar/800"],
      ["Button/Primary/Disabled", "Woodsmoke/100"],
      ["Button/Secondary/Affirmative Hover", "Blue Ribbon/100"],
      ["Button/Secondary/Affirmative Pressed", "Blue Ribbon/200"],
      ["Button/Secondary/Destructive Hover", "Cinnabar/100"],
      ["Button/Secondary/Destructive Pressed", "Cinnabar/200"],
      ["Button/Secondary/Warning Hover", "Sun/100"],
      ["Button/Secondary/Warning Pressed", "Sun/200"],
      ["Button/Tertiary/Affirmative Hover", "Blue Ribbon/100"],
      ["Button/Tertiary/Affirmative Pressed", "Blue Ribbon/200"],
      ["Button/Tertiary/Destructive Hover", "Cinnabar/100"],
      ["Button/Tertiary/Destructive Pressed", "Cinnabar/200"],
      ["Button/Tertiary/Warning Hover", "Sun/100"],
      ["Button/Tertiary/Warning Pressed", "Sun/200"],
      ["Button/Tertiary/Dark Hover", "Woodsmoke/900"],
      ["Button/Tertiary/Dark Pressed", "Woodsmoke/800"],
      ["Data Viz/Track/Default", "Woodsmoke/100"],
      ["Data Viz/Track/Active", "Blue Ribbon/200"],
    ]),
  },
  {
    group: "Glyph",
    tokens: tokens("Glyph", [
      ["Default", "Woodsmoke/950"],
      ["Subdued", "Woodsmoke/600"],
      ["Placeholder", "Woodsmoke/400"],
      ["Selected", "Blue Ribbon/700"],
      ["Target", "Blue Ribbon/700"],
      ["Info", "Blue Ribbon/700"],
      ["Success", "Apple/700"],
      ["Warning", "Sun/700"],
      ["Alert", "Cinnabar/700"],
      ["Disabled", "Woodsmoke/500"],
      ["Avatar", "Crusta/700"],
      ["Inverted/Default", "Base"],
      ["Inverted/Subdued", "Woodsmoke/500"],
      ["Inverted/Info", "Blue Ribbon/100"],
      ["Inverted/Success", "Apple/100"],
      ["Inverted/Warning", "Sun/100"],
      ["Inverted/Alert", "Cinnabar/100"],
      ["Inverted/Disabled", "Woodsmoke/100"],
      ["Button/Primary", "Base"],
      ["Button/Secondary/Affirmative Default", "Blue Ribbon/700"],
      ["Button/Secondary/Affirmative Hover", "Blue Ribbon/800"],
      ["Button/Secondary/Affirmative Pressed", "Blue Ribbon/900"],
      ["Button/Secondary/Destructive Default", "Cinnabar/700"],
      ["Button/Secondary/Destructive Hover", "Cinnabar/800"],
      ["Button/Secondary/Destructive Pressed", "Cinnabar/900"],
      ["Button/Secondary/Warning Default", "Sun/700"],
      ["Button/Secondary/Warning Hover", "Sun/800"],
      ["Button/Secondary/Warning Pressed", "Sun/900"],
      ["Button/Tertiary/Affirmative Default", "Blue Ribbon/700"],
      ["Button/Tertiary/Affirmative Hover", "Blue Ribbon/800"],
      ["Button/Tertiary/Affirmative Pressed", "Blue Ribbon/900"],
      ["Button/Tertiary/Destructive Default", "Cinnabar/700"],
      ["Button/Tertiary/Destructive Hover", "Cinnabar/800"],
      ["Button/Tertiary/Destructive Pressed", "Cinnabar/900"],
      ["Button/Tertiary/Warning Default", "Sun/700"],
      ["Button/Tertiary/Warning Hover", "Sun/800"],
      ["Button/Tertiary/Warning Pressed", "Sun/900"],
      ["Button/Tertiary/Dark Default", "Crusta/400"],
      ["Button/Tertiary/Dark Hover", "Crusta/300"],
      ["Button/Tertiary/Dark Pressed", "Crusta/200"],
      ["Button/Disabled", "Woodsmoke/600"],
      ["Link/Primary/Default", "Blue Ribbon/600"],
      ["Link/Primary/Hover", "Blue Ribbon/700"],
      ["Link/Primary/Active", "Blue Ribbon/800"],
      ["Link/Primary/Disabled", "Woodsmoke/600"],
      ["Tier/Gold", "Sun/400"],
      ["Tier/Silver", "Blue Ribbon/200"],
      ["Tier/Bronze", "Crusta/400"],
      ["Data Viz/Hue/1", "Blue Ribbon/500"],
      ["Data Viz/Hue/2", "Crusta/500"],
      ["Data Viz/Hue/3", "Apple/500"],
      ["Data Viz/Hue/4", "Woodsmoke/950"],
      ["Data Viz/Hue/5", "Woodsmoke/500"],
      ["Data Viz/Shade/1", "Blue Ribbon/900"],
      ["Data Viz/Shade/2", "Blue Ribbon/700"],
      ["Data Viz/Shade/3", "Blue Ribbon/500"],
      ["Data Viz/Shade/4", "Blue Ribbon/400"],
      ["Data Viz/Shade/5", "Blue Ribbon/300"],
      ["Data Viz/Progress/1", "Apple/700"],
      ["Data Viz/Progress/2", "Blue Ribbon/700"],
      ["Data Viz/Progress/3", "Sun/700"],
      ["Data Viz/Progress/4", "Cinnabar/700"],
    ]),
  },
  {
    group: "Border and outline",
    tokens: [
      ...tokens("Border", [
      ["Default", "Woodsmoke/300"],
      ["Subdued", "Woodsmoke/200"],
      ["Focus", "Blue Ribbon/700"],
      ["Selected", "Blue Ribbon/700"],
      ["Target", "Blue Ribbon/700"],
      ["Success", "Apple/700"],
      ["Warning", "Sun/700"],
      ["Alert", "Cinnabar/700"],
      ["Inverted/Info", "Blue Ribbon/200"],
      ["Inverted/Success", "Apple/200"],
      ["Inverted/Warning", "Sun/200"],
      ["Inverted/Alert", "Cinnabar/200"],
      ]),
      ...tokens("Outline", [
        ["Focus", "Blue Ribbon/200"],
        ["Selected", "Blue Ribbon/200"],
        ["Success", "Apple/200"],
        ["Warning", "Sun/200"],
        ["Alert", "Cinnabar/200"],
      ]),
      ...tokens("Border", [
        ["Button/Secondary/Affirmative Default", "Blue Ribbon/600"],
        ["Button/Secondary/Destructive Default", "Cinnabar/600"],
        ["Button/Secondary/Warning Default", "Sun/600"],
        ["Button/Secondary/Disabled", "Woodsmoke/200"],
      ]),
    ],
  },
];

/** A palette colour's token: its ramp and step, or Base alone. */
export const paletteKey = (ramp: string, step: string) => (step ? `Colors/${ramp}/${step}` : `Colors/${ramp}`);

const paletteColor = new Map([BASE, ...PALETTE].flatMap((ramp) => ramp.steps.map(([step, color]) => [paletteKey(ramp.name, step), color])));
/** The ramps by how often the app's own pages and parts read their colours, through system tokens or directly. */
export const RAMPS_BY_USAGE = ["Woodsmoke", "Blue Ribbon", "Cinnabar", "Sun", "Apple", "Crusta"];

/** The palette's ramps by role: Blue Ribbon the primary, the rest accents by usage, then Base and Woodsmoke the neutrals. */
export const PALETTE_ROLES = [
  { role: "Primary", ramps: ["Blue Ribbon"] },
  { role: "Accents", ramps: RAMPS_BY_USAGE.filter((ramp) => ramp !== "Blue Ribbon" && ramp !== "Woodsmoke") },
  { role: "Neutral", ramps: ["Base", "Woodsmoke"] },
];

/** The palette colours a system token takes; the rest of the ramps go unused. */
export const USED_PALETTE = new Set(SYSTEM.flatMap((group) => group.tokens.map((token) => token.alias)));

const systemAlias = new Map(SYSTEM.flatMap((group) => group.tokens.map((token) => [token.name, token.alias])));

/** A token's colour, through its alias. */
export function colorOf(token: string): string | undefined {
  const alias = systemAlias.get(token);
  return paletteColor.get(token) ?? (alias ? colorOf(alias) : undefined);
}

/** A token's variable in theme.ts: its full name in kebab case. */
export function variableOf(token: string): string {
  return `--sw-${token.toLowerCase().replaceAll(/[\s/]+/g, "-")}`;
}

export type TokenRow = { key: string; label: string; depth: number; token?: SystemToken };

/**
 * A group's tokens in Figma's order: its own first, then each folder's under the folder's path inside the group, its
 * parts spaced ("Button Secondary"), each folder once; another family's under its own name ("Outline").
 */
export function byFolder(tokens: SystemToken[]): TokenRow[] {
  const root = tokens[0].name.split("/")[0];
  const folders = Map.groupBy(tokens, (token) => token.name.split("/").slice(0, -1).join("/"));
  return [...folders].flatMap(([folder, held]) => {
    const own = folder === root;
    const path = folder.split("/");
    return [
      ...(own ? [] : [{ key: folder, label: (path[0] === root ? path.slice(1) : path).join(" "), depth: 0 }]),
      ...held.map((token) => ({ key: token.name, label: token.name.split("/").at(-1)!, depth: own ? 0 : 1, token })),
    ];
  });
}

type Effect = { spec: string; variable: string };

/** A control's states as its edges draw them: its border and the outline round it, which Default lacks, each `width` px. */
export const EDGE_STATES: { name: string; border: Effect & { width: number }; outline?: Effect & { width: number } }[] = [
  {
    name: "Default",
    border: { spec: "Border · 1 · Woodsmoke/300", variable: "--sw-border-default", width: 1 },
  },
  {
    name: "Focus",
    border: { spec: "Border · 1.5 · Blue Ribbon/700", variable: "--sw-border-focus", width: 1.5 },
    outline: { spec: "Outline · 2 · Blue Ribbon/200", variable: "--sw-outline-focus", width: 2 },
  },
  {
    name: "Selected",
    border: { spec: "Border · 1.5 · Blue Ribbon/700", variable: "--sw-border-selected", width: 1.5 },
    outline: { spec: "Outline · 2 · Blue Ribbon/200", variable: "--sw-outline-selected", width: 2 },
  },
  {
    name: "Target",
    border: { spec: "Border · 1.5 · Blue Ribbon/700", variable: "--sw-border-target", width: 1.5 },
  },
  {
    name: "Success",
    border: { spec: "Border · 1.5 · Apple/700", variable: "--sw-border-success", width: 1.5 },
    outline: { spec: "Outline · 2 · Apple/200", variable: "--sw-outline-success", width: 2 },
  },
  {
    name: "Alert",
    border: { spec: "Border · 1.5 · Cinnabar/700", variable: "--sw-border-alert", width: 1.5 },
    outline: { spec: "Outline · 2 · Cinnabar/200", variable: "--sw-outline-alert", width: 2 },
  },
  {
    name: "Warning",
    border: { spec: "Border · 1.5 · Sun/700", variable: "--sw-border-warning", width: 1.5 },
    outline: { spec: "Outline · 2 · Sun/200", variable: "--sw-outline-warning", width: 2 },
  },
];

/** Figma's shadow styles: the overlay's one. */
export const SHADOWS: (Effect & { name: string })[] = [
  { name: "Overlay", spec: "Drop shadow · Blur 10 · Woodsmoke/300", variable: "--sw-overlay-shadow" },
];

/** Backgrounds a part takes over its fill: the hatch on today's shifts, submitted hours and waitlisted days. */
export const BACKGROUNDS: (Effect & { name: string })[] = [
  { name: "Hatched", spec: "Repeating linear gradient · 135° · 1 every 6 · Blue Ribbon/100", variable: "--sw-hatch-gradient" },
];

/** System Tokens' sizes, in px. Margin, which Figma lacks, takes Padding's steps. */
export const SPACING: { group: string; steps: [name: string, px: number][] }[] = [
  {
    group: "Padding",
    steps: [
      ["None", 0],
      ["xxs", 2],
      ["xs", 4],
      ["sm", 8],
      ["md", 10],
      ["lg", 12],
      ["xl", 16],
      ["xxl", 20],
      ["3xl", 24],
    ],
  },
  {
    group: "Margin",
    steps: [
      ["None", 0],
      ["xxs", 2],
      ["xs", 4],
      ["sm", 8],
      ["md", 10],
      ["lg", 12],
      ["xl", 16],
      ["xxl", 20],
      ["3xl", 24],
    ],
  },
  {
    group: "Gap",
    steps: [
      ["None", 0],
      ["3xs", 1],
      ["xxs", 2],
      ["xs", 4],
      ["sm", 8],
      ["md", 10],
      ["lg", 12],
      ["xl", 16],
      ["xxl", 20],
      ["3xl", 24],
    ],
  },
];

/** The widths frames and containers take, in px. */
export const WIDTHS: [name: string, px: number][] = [
  ["Side Sheet/Large", 1216],
  ["Side Sheet/Small", 704],
  ["Overlay/Large", 704],
  ["Overlay/Small", 560],
  ["Card", 704],
  ["Dialog", 500],
  ["Nav Sidebar", 256],
  ["Nav Rail", 64],
  ["Calendar", 300],
  ["Dropdown", 200],
  ["Snackbar", 400],
];

/** A size in rem at a 16px root, or in px given `pixels`; none is 0 either way. */
export const sizeOf = (px: number, pixels: boolean) => (px ? (pixels ? `${px}px` : `${+(px / 16).toFixed(7)}rem`) : "0");

/** The prototype's radius tokens (none of Figma's radii is a variable), in px; `inPx` is written in px either way. */
export const RADII: { name: string; variable: string; px: number; inPx?: true }[] = [
  { name: "none", variable: "--sw-radius-none", px: 0 },
  { name: "xxs", variable: "--sw-radius-xxs", px: 2 },
  { name: "xs", variable: "--sw-radius-xs", px: 4 },
  { name: "sm", variable: "--sw-radius-sm", px: 8 },
  { name: "md", variable: "--sw-radius-md", px: 10 },
  { name: "lg", variable: "--sw-radius-lg", px: 12 },
  { name: "xl", variable: "--sw-radius-xl", px: 16 },
  { name: "xxl", variable: "--sw-radius-xxl", px: 20 },
  { name: "3xl", variable: "--sw-radius-3xl", px: 24 },
  { name: "full", variable: "--sw-radius-full", px: 9999, inPx: true },
];

const FACES = { heading: "Manrope", body: "Poppins" };
const WEIGHTS: Record<number, string> = { 500: "Medium", 600: "SemiBold", 800: "ExtraBold" };

export type TextStyle = {
  name: string;
  token: string;
  variable: string;
  variant: TypographyVariant;
  face: keyof typeof FACES;
  weight: number;
  size: number;
  lineHeight: number;
  letterSpacing: number;
};

/**
 * Typography's styles, sizes in px, each on its token (Style 1 the smallest): its font through the token's variable, its
 * letter spacing (if any) beside it.
 */
export const TEXT_STYLES: TextStyle[] = (
  [
    { name: "Title", token: "Style 10", variant: "title", face: "heading", weight: 800, size: 30, lineHeight: 44, letterSpacing: -0.8 },
    { name: "Heading", token: "Style 9", variant: "heading", face: "heading", weight: 600, size: 20, lineHeight: 28, letterSpacing: 0 },
    { name: "Subheading", token: "Style 8", variant: "subheading", face: "heading", weight: 600, size: 16, lineHeight: 24, letterSpacing: 0 },
    { name: "Subheading Small", token: "Style 6", variant: "subheadingSmall", face: "heading", weight: 600, size: 14, lineHeight: 24, letterSpacing: 0 },
    { name: "Badge", token: "Style 5", variant: "badge", face: "heading", weight: 600, size: 14, lineHeight: 16, letterSpacing: 0 },
    { name: "Body Large", token: "Style 7", variant: "bodyLarge", face: "body", weight: 500, size: 16, lineHeight: 24, letterSpacing: 0 },
    { name: "Body Strong", token: "Style 4", variant: "bodyStrong", face: "body", weight: 600, size: 14, lineHeight: 24, letterSpacing: 0 },
    { name: "Body", token: "Style 3", variant: "body", face: "body", weight: 500, size: 14, lineHeight: 24, letterSpacing: 0 },
    { name: "Metadata Strong", token: "Style 2", variant: "metadataStrong", face: "body", weight: 600, size: 12, lineHeight: 20, letterSpacing: 0 },
    { name: "Metadata", token: "Style 1", variant: "metadata", face: "body", weight: 500, size: 12, lineHeight: 20, letterSpacing: 0 },
  ] satisfies Omit<TextStyle, "variable">[]
).map((style) => ({ ...style, variable: variableOf(`Text/${style.token}`) }));

/** A text style's values as written: font with its weight, size/line height, tracking, in rem or in px. */
export function partsOf(style: TextStyle, pixels: boolean) {
  return {
    font: `${FACES[style.face]} ${WEIGHTS[style.weight]}`,
    size: `${sizeOf(style.size, pixels)}/${sizeOf(style.lineHeight, pixels)}`,
    letterSpacing: sizeOf(style.letterSpacing, pixels).replaceAll("-", "−"),
  };
}

/** A text style as CSS's font shorthand writes it: font and weight, size/line height, tracking, in rem or in px. */
export function specOf(style: TextStyle, pixels: boolean) {
  const { font, size, letterSpacing } = partsOf(style, pixels);
  return [font, size, ...(style.letterSpacing ? [`${letterSpacing} tracking`] : [])].join(" · ");
}
