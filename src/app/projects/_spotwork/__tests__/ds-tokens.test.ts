import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hexOf } from "../oklch";
import { EDGE_STATES, RADII, PALETTE, SPACING, SYSTEM, TEXT_STYLES, WIDTHS, byFolder, colorOf, partsOf, sizeOf, specOf, variableOf } from "../ds-tokens";

// The prototype's variables, as theme.ts sets them.
const folder = join(__dirname, "..");
const theme = readFileSync(join(folder, "theme.ts"), "utf8");
const values = Object.fromEntries([...theme.matchAll(/"(--sw-[a-z0-9-]+)": "([^"]+)"/g)].map(([, name, value]) => [name, value]));
const tokens = SYSTEM.flatMap((group) => group.tokens);

const OKLCH = /^oklch\(\d+(\.\d+)?% \d(\.\d+)? \d+(\.\d+)?\)$/;

const tokenVariables = new Set(tokens.map((token) => variableOf(token.name)));
const tokensOf = (group: string) => SYSTEM.find((entry) => entry.group === group)!.tokens;

describe("SW Curie's tokens", () => {
  it("resolve a system token through its palette colour, in OKLCH", () => {
    expect(colorOf("Surface/Selected")).toBe("oklch(97% 0.0446 263.14)");
    expect(colorOf("Glyph/Selected")).toBe("oklch(47.89% 0.216 263.14)");
    expect(colorOf("Colors/Woodsmoke/950")).toBe("oklch(29% 0 0)");
    expect(colorOf("Colors/Base")).toBe("oklch(100% 0 0)");
    expect(colorOf("Colors/Woodsmoke/0")).toBeUndefined();
  });

  it("alias only colours the palette has", () => {
    for (const group of SYSTEM) for (const token of group.tokens) expect(colorOf(token.alias), token.name).toMatch(OKLCH);
  });

  it("write every palette colour in OKLCH", () => {
    for (const ramp of PALETTE) for (const [step, colour] of ramp.steps) expect(colour, `${ramp.name}/${step}`).toMatch(OKLCH);
  });

  it("file a component's colours under the role they play: surface, glyph, or border and outline", () => {
    expect(SYSTEM.map((group) => group.group)).toEqual(["Surface", "Glyph", "Border and outline"]);
    expect(colorOf("Surface/Button/Primary/Affirmative Default")).toBe("oklch(55.44% 0.1896 263.14)");
    expect(colorOf("Glyph/Button/Secondary/Affirmative Default")).toBe("oklch(47.89% 0.216 263.14)");
    expect(colorOf("Border/Button/Secondary/Disabled")).toBe("oklch(85.67% 0 0)");
    expect(colorOf("Glyph/Link/Primary/Default")).toBe("oklch(55.44% 0.1896 263.14)");
    expect(colorOf("Surface/Button/Primary/Destructive Default")).toBe("oklch(55.44% 0.1896 29.72)");
    expect(colorOf("Glyph/Alert")).toBe("oklch(47.89% 0.216 29.72)");
    expect(colorOf("Glyph/Data Viz/Hue/1")).toBe("oklch(63% 0.1633 263.14)");
    expect(colorOf("Glyph/Success")).toBe("oklch(47.89% 0.216 147.79)");
    expect(colorOf("Glyph/Tier/Gold")).toBe("oklch(70.56% 0.1369 75.15)");
    expect(colorOf("Glyph/Warning")).toBe("oklch(47.89% 0.216 75.15)");
    expect(colorOf("Surface/Avatar")).toBe("oklch(97% 0.0446 40.27)");
    expect(colorOf("Surface/Alert")).toBe(colorOf("Colors/Cinnabar/50"));
    expect(colorOf("Glyph/Tier/Bronze")).toBe("oklch(70.56% 0.1779 40.27)");
  });

  it("keep each palette ramp in Figma's step order", () => {
    for (const ramp of PALETTE) {
      const steps = ramp.steps.map(([step]) => Number(step));
      expect(steps).toEqual(steps.toSorted((a, b) => a - b));
    }
  });
});

describe("SW Curie's tones", () => {
  const stepOf = (name: string) => tokens.find((token) => token.name === name)?.alias.split("/").at(-1);
  const luminance = (color: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexOf(color).slice(i, i + 2), 16) / 255);
    const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const same = (names: string[]) => expect(new Set(names.map(stepOf)), names.join(", ")).toEqual(new Set([stepOf(names[0])]));

  it("tint the hover, selected, target, info, success, warning, alert and avatar surfaces at 50", () => {
    for (const name of ["Hover", "Selected", "Target", "Info", "Success", "Warning", "Alert", "Avatar"]) expect(stepOf(`Surface/${name}`), name).toBe("50");
  });

  it("split what was Active by role: hover is grey, and selected, target and info share the blue", () => {
    expect(tokens.find((token) => token.name === "Surface/Active")).toBeUndefined();
    expect(colorOf("Surface/Hover")).toBe(colorOf("Surface/Subdued"));
    for (const role of ["Surface/Target", "Surface/Info"]) expect(colorOf(role), role).toBe(colorOf("Surface/Selected"));
    expect(colorOf("Glyph/Info")).toBe(colorOf("Glyph/Selected"));
    expect(colorOf("Surface/Inverted/Info")).toBe(colorOf("Surface/Inverted/Selected"));
    expect(colorOf("Surface/Inverted/Disabled Selected")).toBe(colorOf("Colors/Blue Ribbon/200"));
    expect(tokens.find((token) => token.name === "Surface/Disabled Active")).toBeUndefined();
  });

  it("leave a selected surface under the pointer to Hover multiplied onto it, with no token of its own", () => {
    expect(tokens.find((token) => token.name === "Surface/Selected Hover")).toBeUndefined();
  });

  it("draw a focus, a selection and a target in the same border blue", () => {
    for (const role of ["Border/Focus", "Border/Selected", "Border/Target"]) expect(colorOf(role), role).toBe(colorOf("Colors/Blue Ribbon/700"));
    for (const role of ["Outline/Focus", "Outline/Selected"]) expect(colorOf(role), role).toBe(colorOf("Colors/Blue Ribbon/200"));
    expect(tokens.find((token) => token.name === "Outline/Target")).toBeUndefined();
    for (const old of ["Border/Active", "Outline/Active"]) expect(tokens.find((token) => token.name === old), old).toBeUndefined();
  });

  it("give success, warning and alert the same step in every role", () => {
    for (const role of ["Surface/", "Surface/Inverted/", "Glyph/", "Glyph/Inverted/", "Border/"])
      same(["Success", "Warning", "Alert"].map((tone) => role + tone));
  });

  it("name a button's pressed state Pressed, never Active", () => {
    expect(tokens.filter((token) => token.name.includes("/Button/") && token.name.endsWith(" Active"))).toEqual([]);
  });

  it("give a button's tones the same step in each of its states", () => {
    const states: [kinds: string[], tones: string[], group: string, states: string[]][] = [
      [["Primary"], ["Affirmative", "Destructive"], "Surface", ["Default", "Hover", "Pressed"]],
      [["Secondary", "Tertiary"], ["Affirmative", "Destructive", "Warning"], "Surface", ["Hover", "Pressed"]],
      [["Secondary", "Tertiary"], ["Affirmative", "Destructive", "Warning"], "Glyph", ["Default", "Hover", "Pressed"]],
      [["Secondary"], ["Affirmative", "Destructive", "Warning"], "Border", ["Default"]],
    ];
    for (const [kinds, tones, group, each] of states)
      for (const kind of kinds)
        for (const state of each) {
          const names = tones.map((tone) => `${group}/Button/${kind}/${tone} ${state}`);
          for (const name of names) expect(stepOf(name), name).toBeDefined();
          same(names);
        }
  });

  it("give success, warning and alert info's step for surface and glyph, and selected's for border", () => {
    for (const [role, reference] of [["Surface/", "Info"], ["Glyph/", "Info"], ["Border/", "Selected"]])
      for (const tone of ["Success", "Warning", "Alert"]) expect(stepOf(role + tone), role + tone).toBe(stepOf(role + reference));
  });

  it("give selected, target and info the same text blue, and leave no Active glyph", () => {
    for (const role of ["Glyph/Target", "Glyph/Info"]) expect(colorOf(role), role).toBe(colorOf("Glyph/Selected"));
    expect(tokens.find((token) => token.name === "Glyph/Active")).toBeUndefined();
  });

  it("name the divider on an info surface Info", () => {
    expect(tokens.find((token) => token.name === "Border/Inverted/Active")).toBeUndefined();
    expect(stepOf("Border/Inverted/Info")).toBe("200");
  });

  it("give info, success, warning and alert one inverted surface and one inverted text, readable together", () => {
    for (const role of ["Surface/Inverted/", "Glyph/Inverted/"])
      same(["Info", "Success", "Warning", "Alert"].map((tone) => role + tone));
    for (const tone of ["Info", "Success", "Warning", "Alert"])
      expect(contrast(colorOf(`Glyph/Inverted/${tone}`)!, colorOf(`Surface/Inverted/${tone}`)!), tone).toBeGreaterThanOrEqual(4.5);
  });

  it("give info, success, warning and alert an inverted border at 200, Border/Subdued's step", () => {
    expect(stepOf("Border/Subdued")).toBe("200");
    for (const tone of ["Info", "Success", "Warning", "Alert"]) expect(stepOf(`Border/Inverted/${tone}`), tone).toBe("200");
  });

  it("give every edge state's outline 200, in the hue of its border", () => {
    for (const tone of ["Focus", "Selected", "Success", "Warning", "Alert"]) {
      expect(stepOf(`Outline/${tone}`), tone).toBe("200");
      expect(colorOf(`Outline/${tone}`)!.split(" ").at(-1), tone).toBe(colorOf(`Border/${tone}`)!.split(" ").at(-1));
    }
  });

  it("keep the data viz hues and shades under Glyph, the hues from Blue Ribbon to Woodsmoke, the fourth Woodsmoke's darkest", () => {
    const aliasOf = (name: string) => tokens.find((token) => token.name === name)?.alias;
    expect([1, 2, 3, 4, 5].map((n) => aliasOf(`Glyph/Data Viz/Hue/${n}`))).toEqual(
      ["Blue Ribbon/500", "Crusta/500", "Apple/500", "Woodsmoke/950", "Woodsmoke/500"].map((color) => `Colors/${color}`),
    );
    for (const n of [1, 2, 3, 4, 5]) {
      expect(stepOf(`Glyph/Data Viz/Shade/${n}`), `Shade ${n}`).toBeDefined();
      for (const kind of ["Hue", "Shade"]) expect(stepOf(`Surface/Data Viz/${kind}/${n}`), `Surface ${kind} ${n}`).toBeUndefined();
    }
  });

  it("give the progress bar its own four data viz colours, full to low", () => {
    const aliasOf = (name: string) => tokens.find((token) => token.name === name)?.alias;
    expect([1, 2, 3, 4].map((n) => aliasOf(`Glyph/Data Viz/Progress/${n}`))).toEqual(
      ["Apple", "Blue Ribbon", "Sun", "Cinnabar"].map((ramp) => `Colors/${ramp}/700`),
    );
  });

  it("fill an inverted badge at its tone's text step, so a chip's badge matches its words", () => {
    for (const tone of ["Selected", "Info", "Success", "Warning", "Alert"]) expect(stepOf(`Surface/Inverted/${tone}`), tone).toBe(stepOf(`Glyph/${tone}`));
  });

  it("keep selected, info, success, warning and alert text readable on white, on its own surface and on the subdued one, and borders visible", () => {
    // [glyph and surface, border]: info has no border of its own, so it borrows the selected one.
    for (const [tone, border] of [["Selected", "Selected"], ["Info", "Selected"], ["Success", "Success"], ["Warning", "Warning"], ["Alert", "Alert"]]) {
      for (const ground of ["Surface/Default", `Surface/${tone}`, "Surface/Subdued"])
        expect(contrast(colorOf(`Glyph/${tone}`)!, colorOf(ground)!), `Glyph/${tone} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      for (const ground of ["Surface/Default", `Surface/${tone}`])
        expect(contrast(colorOf(`Border/${border}`)!, colorOf(ground)!), `Border/${border} on ${ground}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("step secondary and tertiary button text from 700 to 800 to 900, readable on white and on its tone's surface", () => {
    const surfaces = { Affirmative: "Surface/Info", Destructive: "Surface/Alert", Warning: "Surface/Warning" };
    for (const kind of ["Secondary", "Tertiary"])
      for (const [tone, surface] of Object.entries(surfaces))
        for (const [state, step] of [["Default", "700"], ["Hover", "800"], ["Pressed", "900"]]) {
          const name = `Glyph/Button/${kind}/${tone} ${state}`;
          expect(stepOf(name), name).toBe(step);
          for (const ground of ["Surface/Default", surface])
            expect(contrast(colorOf(name)!, colorOf(ground)!), `${name} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
  });

  it("outline every state at one step, and border focus, selected, target, success, warning and alert at one", () => {
    const stepIn = (spec: string) => spec.split("/").at(-1);
    expect(new Set(EDGE_STATES.flatMap(({ outline }) => (outline ? [stepIn(outline.spec)] : []))).size).toBe(1);
    const borders = EDGE_STATES.filter(({ name }) => name !== "Default");
    expect(borders.map(({ name }) => name)).toEqual(["Focus", "Selected", "Target", "Success", "Alert", "Warning"]);
    expect(new Set(borders.map(({ border }) => stepIn(border.spec))).size).toBe(1);
  });

  it("give a target a border and no outline", () => {
    const target = EDGE_STATES.find(({ name }) => name === "Target")!;
    expect(target.border.variable).toBe("--sw-border-target");
    expect(target.outline).toBeUndefined();
  });
});

describe("a group's tokens by folder", () => {
  it("lists the group's own tokens first, unheaded, then heads each folder's with its path inside the group", () => {
    const rows = byFolder(tokensOf("Surface")).map((row) => [row.label, row.depth, row.token?.name]);
    expect(rows.slice(0, 2)).toEqual([
      ["Default", 0, "Surface/Default"],
      ["Subdued", 0, "Surface/Subdued"],
    ]);
    expect(rows.slice(12, 14)).toEqual([
      ["Inverted", 0, undefined],
      ["Default", 1, "Surface/Inverted/Default"],
    ]);
  });

  it("heads a second family by its own name, after the borders' states and before the button's borders", () => {
    const rows = byFolder(tokensOf("Border and outline")).map((row) => [row.label, row.depth, row.token?.name]);
    expect(rows.filter(([, , name]) => !name).map(([label]) => label)).toEqual(["Inverted", "Outline", "Button Secondary"]);
    const outline = rows.findIndex(([label]) => label === "Outline");
    expect(rows.slice(outline, outline + 6)).toEqual([
      ["Outline", 0, undefined],
      ["Focus", 1, "Outline/Focus"],
      ["Selected", 1, "Outline/Selected"],
      ["Success", 1, "Outline/Success"],
      ["Warning", 1, "Outline/Warning"],
      ["Alert", 1, "Outline/Alert"],
    ]);
  });

  it("heads only the folders that hold tokens, each once, by their path inside the group, and names each token by its last part", () => {
    const rows = byFolder(tokensOf("Surface"));
    expect(rows.slice(22, 32).map((row) => [row.label, row.depth])).toEqual([
      ["Button Primary", 0],
      ["Affirmative Default", 1],
      ["Affirmative Hover", 1],
      ["Affirmative Pressed", 1],
      ["Destructive Default", 1],
      ["Destructive Hover", 1],
      ["Destructive Pressed", 1],
      ["Disabled", 1],
      ["Button Secondary", 0],
      ["Affirmative Hover", 1],
    ]);
    const heads = rows.filter((row) => !row.token).map((row) => row.label);
    expect(new Set(heads).size).toBe(heads.length);
    expect(rows.filter((row) => row.label.includes("/"))).toEqual([]);
    expect(rows.filter((row) => row.token)).toHaveLength(tokensOf("Surface").length);
  });
});

describe("the prototype's padding, margin and gap variables", () => {
  it("set every step of Padding, Margin and Gap to its size, named after its token", () => {
    expect(variableOf("Margin/3xl")).toBe("--sw-margin-3xl");
    expect(variableOf("Gap/3xs")).toBe("--sw-gap-3xs");
    for (const group of SPACING)
      for (const [name, px] of group.steps) expect(values[variableOf(`${group.group}/${name}`)], `${group.group}/${name}`).toBe(`${px / 16}rem`);
  });
});

describe("the prototype's colour variables", () => {
  it("are named after their token", () => {
    expect(variableOf("Surface/Subdued")).toBe("--sw-surface-subdued");
    expect(variableOf("Surface/Badge Alert")).toBe("--sw-surface-badge-alert");
    expect(variableOf("Glyph/Data Viz/Hue/1")).toBe("--sw-glyph-data-viz-hue-1");
    expect(tokenVariables.size).toBe(tokens.length);
  });

  it("set every system token to its colour", () => {
    for (const token of tokens) expect(values[variableOf(token.name)], token.name).toBe(colorOf(token.name));
  });

  it("draw each edge state's outline at its spec's width in its Outline token, the palette colour the spec names", () => {
    for (const { name, outline } of EDGE_STATES) {
      if (!outline) continue;
      const [, width, colour] = outline.spec.split(" · ");
      expect(outline.variable, name).toBe(variableOf(`Outline/${name}`));
      expect(values[outline.variable], name).toBe(colorOf(`Colors/${colour}`));
      expect(outline.width, name).toBe(Number(width));
    }
  });

  it("write no colour in hex", () => {
    expect(Object.entries(values).filter(([, value]) => /#[0-9a-f]{3,8}\b/i.test(value))).toEqual([]);
  });

  it("have no names but tokens': any other colour is a palette colour's own variable", () => {
    const palette = PALETTE.flatMap((ramp) => ramp.steps.map(([step]) => `Colors/${ramp.name}/${step}`));
    expect(values["--sw-canvas"]).toBeUndefined();
    for (const [name, value] of Object.entries(values)) {
      if (tokenVariables.has(name) || !(OKLCH.test(value) || /^var\(--sw-[a-z0-9-]+\)$/.test(value))) continue;
      const colour = palette.find((token) => variableOf(token) === name);
      expect(colour, name).toBeDefined();
      expect(colorOf(colour!), name).toBe(value);
    }
  });

  it("draw every outline and inward ring through an Outline token, its width given where it's drawn", () => {
    const text = readdirSync(folder, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !file.startsWith("__tests__") && file !== "theme.ts")
      .map((file) => readFileSync(join(folder, file), "utf8"))
      .join("\n");
    expect(text).not.toMatch(/"var\(--sw-outline-[a-z]+\)"/);
    expect(text).not.toMatch(/(solid|inset 0 0 0 \d+(\.\d+)?px) var\(--sw-colors-/);
  });

  it("are all set by theme.ts wherever the prototype uses one", () => {
    const sources = readdirSync(folder, { recursive: true, encoding: "utf8" }).filter(
      (file) => /\.tsx?$/.test(file) && !file.startsWith("__tests__"),
    );
    for (const file of sources)
      for (const [name] of readFileSync(join(folder, file), "utf8").matchAll(/--sw-[a-z0-9-]*[a-z0-9](?![a-z0-9-]*\$\{)/g))
        expect(values[name], `${name} in ${file}`).toBeDefined();
  });
});

describe("the prototype's width variables", () => {
  it("size the two overlays and the one dialog", () => {
    expect(values["--sw-width-overlay-large"]).toBe("44rem");
    expect(values["--sw-width-overlay-small"]).toBe("35rem");
    expect(values["--sw-width-dialog"]).toBe("31.25rem");
    expect(values["--sw-width-dialog-large"]).toBeUndefined();
    expect(values["--sw-width-side-sheet-small"]).toBe(values["--sw-width-overlay-large"]);
  });

  it("are each listed at the size theme.ts sets", () => {
    const set = Object.keys(values).filter((name) => name.startsWith("--sw-width-"));
    expect(WIDTHS.map(([name]) => variableOf(`Width/${name}`)).toSorted()).toEqual(set.toSorted());
    for (const [name, px] of WIDTHS) expect(values[variableOf(`Width/${name}`)], name).toBe(`${px / 16}rem`);
  });
});

describe("the prototype's text styles", () => {
  const ui = readFileSync(join(folder, "ui.tsx"), "utf8");
  const style = (name: string) => TEXT_STYLES.find((entry) => entry.name === name)!;

  it("are Typography's variants, each setting its font through its variable, at its face, weight and sizes", () => {
    const variants = [...ui.matchAll(/"&\[data-typography=(\w+)\]": \{ font:/g)].map(([, variant]) => variant);
    expect(TEXT_STYLES.map((entry) => entry.variant)).toEqual(variants);
    for (const entry of TEXT_STYLES) {
      expect(values[entry.variable], entry.name).toBe(`${entry.weight} ${entry.size / 16}rem/${entry.lineHeight / 16}rem var(--sw-${entry.face})`);
      const tracking = entry.letterSpacing ? `, letterSpacing: "${entry.letterSpacing / 16}rem"` : "";
      expect(ui, entry.name).toContain(`"&[data-typography=${entry.variant}]": { font: "var(${entry.variable})"${tracking} }`);
    }
  });

  it("are tokens Style 1 to Style 10, smallest first, each variable named after its token", () => {
    const tokens = TEXT_STYLES.toSorted((a, b) => a.token.localeCompare(b.token, undefined, { numeric: true }));
    expect(tokens.map((entry) => entry.token)).toEqual(Array.from({ length: 10 }, (_, i) => `Style ${i + 1}`));
    for (const entry of tokens) expect(entry.variable, entry.token).toBe(variableOf(`Text/${entry.token}`));
    const sizes = tokens.map((entry) => entry.size);
    expect(sizes).toEqual(sizes.toSorted((a, b) => a - b));
    expect(style("Metadata").token).toBe("Style 1");
    expect(style("Title").token).toBe("Style 10");
  });

  it("leave letter spacing to Title alone", () => {
    expect(TEXT_STYLES.filter((entry) => entry.letterSpacing).map((entry) => entry.name)).toEqual(["Title"]);
  });

  it("are written as CSS's font shorthand: font and weight, size over line height, then tracking, in rem or in px", () => {
    expect(specOf(style("Title"), false)).toBe("Manrope ExtraBold · 1.875rem/2.75rem · −0.05rem tracking");
    expect(specOf(style("Heading"), false)).toBe("Manrope SemiBold · 1.25rem/1.75rem");
    expect(specOf(style("Body"), false)).toBe("Poppins Medium · 0.875rem/1.5rem");
    expect(specOf(style("Title"), true)).toBe("Manrope ExtraBold · 30px/44px · −0.8px tracking");
    expect(specOf(style("Metadata Strong"), true)).toBe("Poppins SemiBold · 12px/20px");
  });

  it("split into font with its weight, size over line height, and tracking, in rem or in px", () => {
    expect(partsOf(style("Title"), false)).toEqual({ font: "Manrope ExtraBold", size: "1.875rem/2.75rem", letterSpacing: "−0.05rem" });
    expect(partsOf(style("Title"), true)).toEqual({ font: "Manrope ExtraBold", size: "30px/44px", letterSpacing: "−0.8px" });
    expect(partsOf(style("Body"), true)).toEqual({ font: "Poppins Medium", size: "14px/24px", letterSpacing: "0" });
  });
});

describe("sizeOf", () => {
  it("writes a size in rem at a 16px root, or in px, and none as 0", () => {
    expect(sizeOf(4, false)).toBe("0.25rem");
    expect(sizeOf(4, true)).toBe("4px");
    expect(sizeOf(0, false)).toBe("0");
    expect(sizeOf(0, true)).toBe("0");
  });
});

describe("the prototype's radius variables", () => {
  it("take every step of Margin at its size, then full", () => {
    const margin = SPACING.find((group) => group.group === "Margin")!.steps;
    expect(RADII.map((radius) => radius.name)).toEqual([...margin.map(([name]) => name.toLowerCase()), "full"]);
    for (const [name, px] of margin) {
      const radius = RADII.find((entry) => entry.name === name.toLowerCase())!;
      expect(radius.px, name).toBe(px);
      expect(values[radius.variable], radius.variable).toBe(px ? `${px / 16}rem` : "0");
    }
    expect(RADII.at(-1)).toMatchObject({ name: "full", px: 9999, inPx: true });
  });
});
