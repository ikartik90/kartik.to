import type { ComponentType } from "react";
import { filenameToLabel } from "@/utils/filename-to-label";
import type { DemoFrameAspectRatio } from "@/components/demo-frame";
import type { DemoLoggerConfig } from "@/components/demo-logger";
import type { DemoAsset } from "@/utils/demo-assets";

/**
 * What every demo may be told about the SHOWING it is in, as opposed to about
 * itself. One optional field so far, and a named type rather than an inline one
 * because it is the contract three call sites hand down — the grid, the article
 * block and the insert dialog's preview.
 */
export interface DemoProps {
  /**
   * The shape its frame is drawn at.
   *
   * Passed rather than looked up, because the entry's `aspectRatio` is only the
   * DEFAULT: a publication may override it per row, so the registry's answer
   * and the frame's are not always the same number. A demo that draws to fill
   * its box can ignore this; one that frames its contents for a shape — the
   * reel does, through `shaderParamsFor` — would otherwise compose itself for a
   * box it is not in.
   */
  aspect?: DemoFrameAspectRatio;
}

/** Where a demo's card points, and what that link is called. */
export interface DemoLink {
  href: string;
  /**
   * The link's accessible name. Required, not derived from `label`: the card is
   * a picture with no text in it (the reel's canvas is `aria-hidden`), so this
   * is the ONLY name the link has — and it should name the destination, which
   * is a different sentence from what the demo is called.
   */
  label: string;
}

export interface DemoComponentEntry {
  id: string;
  label: string;
  /**
   * Lazily imports the demo's module chunk (loaded after the page loads).
   *
   * Absent for a {@link DemoComponentEntry.card} entry, which has no chunk: it
   * is drawn from its publication's own configuration, so there is nothing to
   * fetch and no loader to show. Nothing calls this without checking `card`
   * first — the grid and the insert dialog both branch on it before they render
   * anything at all.
   */
  load?: () => Promise<ComponentType<DemoProps>>;
  aspectRatio?: DemoFrameAspectRatio;
  /**
   * `"none"` drops the frame's outline. Set it for a demo that is a WIDGET
   * rather than a specimen — the box says where a prototype ends and the page
   * begins, which is the wrong sentence for something meant to read as a
   * native part of the page.
   */
  chrome?: "none";
  /**
   * The demo lays itself out against the frame rather than being measured and
   * centred in it — see {@link DemoFrame}'s own `fill`.
   */
  fill?: boolean;
  logger?: boolean | DemoLoggerConfig;
  /** Demo-specific assets, on top of the shared common/logger asset sets. */
  assets?: DemoAsset[];
  /**
   * Where this demo's card takes the reader — set only for a demo that is a
   * PICTURE of somewhere else on the site.
   *
   * Absent for every demo that is played in place, and that is the rule rather
   * than an oversight: a scheduler card is a thing you use, and putting a link
   * over it would take the click you meant for the scheduler. A linked card is
   * view-only by construction — see `ComponentCard` in `home-grid.tsx`, which
   * makes the demo inside one inert to the pointer.
   */
  link?: DemoLink;
  /**
   * This entry is a CARD, not a specimen: it draws itself, and it draws itself
   * bare rather than inside a demo frame.
   *
   * The distinction is what the frame MEANS. A frame is a box that says "this
   * is a prototype, and it ends here" — right for a scheduler you play with,
   * and wrong for a tile whose whole job is to be one of the cards on the grid.
   * `chrome: "none"` is not the same concession: that drops the outline and
   * keeps the measured, centred, aspect-floored box, which a card does not want
   * either.
   *
   * It also names the entries whose publication carries a `props` blob. A
   * specimen's content is its own code, so a row publishing one has nothing to
   * configure; a card is a shell, and its row IS the card — see
   * `LinkCardConfigSchema`.
   */
  card?: true;
}

type DemoRegistryEntry = Omit<DemoComponentEntry, "id" | "label">;

/**
 * Add one entry here for each DEMO in this directory. Modules the demos merely
 * share (`shift-form-shell`) are not demos and stay unregistered.
 */
const registry: Record<string, DemoRegistryEntry> = {
  "shift-scheduling-v0": {
    load: async () => (await import("./shift-scheduling-v0")).ShiftSchedulingV0,
    // The "Old Shift Scheduling" frame (745:4375 light / 745:4080 dark) — the
    // same 960×640 showcase as v1 and v2.
    aspectRatio: "3/2",
    // The stand-in cursor its walkthrough performs with. Warmed here so the
    // arrow is decoded before it is asked to fade in — a first paint that
    // arrives a frame late is the one thing that would give it away.
    assets: [
      {
        id: "cursor-selection",
        kind: "image",
        src: "/cursors/cursor-selection.svg",
      },
    ],
  },
  "shift-scheduling-v1": {
    load: async () => (await import("./shift-scheduling-v1")).ShiftSchedulingV1,
    // 960×640 showcase = 3:2, so it fills the frame at the article width.
    aspectRatio: "3/2",
    // Its walkthrough performs with the same stand-in cursor v0's does, and
    // wants it decoded for the same reason.
    assets: [
      {
        id: "cursor-selection",
        kind: "image",
        src: "/cursors/cursor-selection.svg",
      },
    ],
  },
  "shift-scheduling-v2": {
    load: async () => (await import("./shift-scheduling-v2")).ShiftSchedulingV2,
    // Same 960×640 Figma frame as v1 (723:1952).
    aspectRatio: "3/2",
    // Its walkthrough performs with the same stand-in cursor v0's and v1's do,
    // and wants it decoded for the same reason.
    assets: [
      {
        id: "cursor-selection",
        kind: "image",
        src: "/cursors/cursor-selection.svg",
      },
    ],
  },
  "scheduling-layout-redesign": {
    load: async () =>
      (await import("./scheduling-layout-redesign")).SchedulingLayoutRedesign,
    // The four Figma frames are 960×480 (1143:6560), so it fills the frame at
    // the article width exactly as the Shift Scheduling showcases do.
    aspectRatio: "2/1",
  },
  "position-fields-consolidation": {
    load: async () =>
      (await import("./position-fields-consolidation"))
        .PositionFieldsConsolidation,
    // The four Figma frames are 960×640 (1167:8542) — taller than the layout
    // redesign's, because the card it annotates is the BEFORE's own 332px body
    // and the redlines have to reach their full length inside it.
    aspectRatio: "3/2",
  },
  "shader-preset-reel": {
    load: async () => {
      const mod = await import("./shader-preset-reel-demo");
      // Fetches the presets as part of LOADING, so the frame's preloader covers
      // the query — the same bargain `calchemy-demo` strikes below. Only the
      // dialog preview and unsaved inserts get here; a published card is
      // rendered on the server instead (`server-demos.tsx`).
      return mod.prepareShaderPresetReel();
    },
    // Square, because that is the shape a preset is authored at — the
    // playground's canvas is `DEFAULT_SHADER_PRESET_ASPECT` — so the card shows
    // the preset framed the way it was tuned. A row may still override it, and
    // the reel is told which shape it actually landed in either way.
    aspectRatio: "1/1",
    // The one demo that is a picture of somewhere else: it is the shader
    // playground's window, so its card is the way in.
    link: { href: "/playground/shader", label: "Shader playground" },
  },
  "weather-widget": {
    load: async () => {
      const mod = await import("./weather-widget-demo");
      // Fetches the reading as part of LOADING, so the frame's preloader
      // covers it — the same bargain the reel and calchemy strike. Only the
      // insert dialog and unsaved inserts get here; a published card is
      // rendered on the server instead (`server-demos.tsx`).
      return mod.prepareWeatherWidget();
    },
    // Square, and unusually this is the component's shape rather than a Figma
    // frame's: it is a home-screen widget, and the square is the format every
    // phone's weather widget already comes in — place at the top, drawing, then
    // the number and the word.
    aspectRatio: "1/1",
    // No outline. Every other card here is a specimen of a prototype and wants
    // the box that says so; this one is supposed to read as a widget sitting on
    // the page, and a hairline around it makes it a picture of one instead.
    chrome: "none",
  },
  // The one entry that is not a demo. It publishes a CARD — a picture, some
  // words and a destination — and everything about it is configured per
  // publication in the properties rail rather than written in a module here.
  //
  // It is in this registry because this registry is what the insert dialog
  // lists, and putting a card on the grid is the same act as publishing a demo:
  // you choose it, you place it, you size it, and one `Component` row records
  // all of that. A second library beside this one would be a second dialog, a
  // second table and a second `saveGridLayout` fan-out, to add one kind of card.
  //
  // What it exists FOR is the pages that have no card of their own — the
  // playgrounds. Articles and projects already put themselves on the grid; see
  // `SITE_PATHS`, which is the list this card may point into.
  "link-card": {
    card: true,
    // The shape a project's tile has always been. A row overrides it like any
    // other, and a link card frequently will — a square window onto a
    // playground, a tall one onto a document.
    aspectRatio: "16/9",
  },
  "calchemy-demo": {
    // The playground in a frame: the calendar takes the middle and the query
    // bar sits on the frame's own bottom inset, so the demo needs the frame's
    // height rather than its own.
    fill: true,
    load: async () => {
      const mod = await import("./calchemy-demo");
      // Warm the engine as part of loading so the single frame preloader covers
      // it — the component then mounts ready, no second internal spinner.
      await mod.prepareCalchemyDemo();
      return mod.CalchemyDemo;
    },
    logger: {
      emptyHint:
        "Enter a text expression in the date picker input to see output logs",
    },
  },
};

export const demoComponents: DemoComponentEntry[] = Object.entries(registry)
  .map(([id, entry]) => ({
    id,
    label: filenameToLabel(id),
    ...entry,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function getDemoComponent(
  componentId: string,
): DemoComponentEntry | undefined {
  return demoComponents.find((entry) => entry.id === componentId);
}
