import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { filenameToLabel } from "@/utils/filename-to-label";
import type { DemoFrameAspectRatio } from "@/components/demo-frame";
import type { DemoLoggerConfig } from "@/components/demo-logger";

export interface DemoComponentEntry {
  id: string;
  label: string;
  Component: ComponentType;
  aspectRatio?: DemoFrameAspectRatio;
  logger?: boolean | DemoLoggerConfig;
}

interface DemoRegistryEntry {
  Component: ComponentType;
  aspectRatio?: DemoFrameAspectRatio;
  logger?: boolean | DemoLoggerConfig;
}

/** Add one import + entry here for each new file in this directory. */
const registry: Record<string, DemoRegistryEntry> = {
  "calchemy-demo": {
    Component: dynamic(
      () => import("./calchemy-demo").then((module) => module.CalchemyDemo),
      { ssr: false },
    ),
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
    Component: entry.Component,
    aspectRatio: entry.aspectRatio,
    logger: entry.logger,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function getDemoComponent(
  componentId: string,
): DemoComponentEntry | undefined {
  return demoComponents.find((entry) => entry.id === componentId);
}
