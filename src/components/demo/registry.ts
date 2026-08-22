import type { ComponentType } from "react";
import { filenameToLabel } from "@/utils/filename-to-label";
import type { DemoFrameAspectRatio } from "@/components/demo-frame";
import type { DemoLoggerConfig } from "@/components/demo-logger";
import type { DemoAsset } from "@/utils/demo-assets";

export interface DemoComponentEntry {
  id: string;
  label: string;
  /** Lazily imports the demo's module chunk (loaded after the page loads). */
  load: () => Promise<ComponentType>;
  aspectRatio?: DemoFrameAspectRatio;
  logger?: boolean | DemoLoggerConfig;
  /** Demo-specific assets, on top of the shared common/logger asset sets. */
  assets?: DemoAsset[];
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
  "calchemy-demo": {
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
