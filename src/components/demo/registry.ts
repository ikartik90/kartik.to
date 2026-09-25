import type { ComponentType } from "react";
import { filenameToLabel } from "@/utils/filename-to-label";
import type { DemoFrameAspectRatio } from "@/components/demo-frame";
import type { DemoLoggerConfig } from "@/components/demo-logger";
import type { DemoAsset } from "@/utils/demo-assets";
import {
  nextPendingKey,
  type PendingComponentInsert,
} from "@/utils/grid-draft";

/** What a demo is told about the showing it is in. */
export interface DemoProps {
  /** The frame's shape; a publication may override the entry's `aspectRatio`. */
  aspect?: DemoFrameAspectRatio;
}

export interface DemoLink {
  href: string;
  /** The link's only accessible name (the card has no text), so it names the destination. */
  label: string;
}

export interface DemoComponentEntry {
  id: string;
  label: string;
  /** Lazily imports the demo's chunk; absent for a `card` entry. */
  load?: () => Promise<ComponentType<DemoProps>>;
  aspectRatio?: DemoFrameAspectRatio;
  /** `"none"` drops the frame's outline, for a demo that should read as part of the page. */
  chrome?: "none";
  /** Lays itself out against the frame instead of being measured and centred in it. */
  fill?: boolean;
  logger?: boolean | DemoLoggerConfig;
  /** Demo-specific assets, on top of the shared common/logger asset sets. */
  assets?: DemoAsset[];
  /** Only for a demo that pictures another page: a linked card is view-only. */
  link?: DemoLink;
  /** Draws itself bare, outside a demo frame, from its publication's `props`. */
  card?: true;
}

type DemoRegistryEntry = Omit<DemoComponentEntry, "id" | "label">;

/** One entry per demo; shared modules such as `shift-form-shell` stay out. */
const registry: Record<string, DemoRegistryEntry> = {
  "shift-scheduling-v0": {
    load: async () => (await import("./shift-scheduling-v0")).ShiftSchedulingV0,
    aspectRatio: "3/2",
    // Decoded before the tour's cursor fades in.
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
    aspectRatio: "3/2",
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
    aspectRatio: "3/2",
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
    aspectRatio: "2/1",
  },
  "position-fields-consolidation": {
    load: async () =>
      (await import("./position-fields-consolidation"))
        .PositionFieldsConsolidation,
    aspectRatio: "3/2",
  },
  "shader-preset-reel": {
    load: async () => {
      const mod = await import("./shader-preset-reel-demo");
      // Fetches under the frame's preloader; published cards render on the server (`server-demos.tsx`).
      return mod.prepareShaderPresetReel();
    },
    aspectRatio: "1/1",
    link: { href: "/playground/shader", label: "Shader playground" },
  },
  "weather-widget": {
    load: async () => {
      const mod = await import("./weather-widget-demo");
      // Fetches under the frame's preloader; published cards render on the server (`server-demos.tsx`).
      return mod.prepareWeatherWidget();
    },
    aspectRatio: "1/1",
    chrome: "none",
  },
  // Not a demo: a configurable card, listed here because the insert dialog lists this registry.
  "link-card": {
    card: true,
    aspectRatio: "16/9",
  },
  "calchemy-demo": {
    fill: true,
    load: async () => {
      const mod = await import("./calchemy-demo");
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

/** A drafted card for this demo, with the entry's defaults copied onto it. */
export function pendingInsertFor(
  componentId: string,
  index: number | null,
): PendingComponentInsert {
  const entry = getDemoComponent(componentId);
  return {
    key: nextPendingKey(),
    componentId,
    index,
    aspect: entry?.aspectRatio ?? "3/2",
    logger: Boolean(entry?.logger),
  };
}
