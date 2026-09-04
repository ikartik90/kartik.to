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
  /** Lazily imports the demo's module chunk (loaded after the page loads). */
  load: () => Promise<ComponentType<DemoProps>>;
  aspectRatio?: DemoFrameAspectRatio;
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
