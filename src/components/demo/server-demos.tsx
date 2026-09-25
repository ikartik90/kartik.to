import type { ReactNode } from "react";
import { ShaderPresetReel } from "@/components/shader-preset-reel";
import { WeatherWidget } from "@/components/weather-widget";
import { getCurrentWeather } from "@/lib/weather";
import type { DemoProps } from "@/components/demo/registry";
import type { GridCard } from "@/lib/grid";

// Demos with a server half. Kept apart from `registry.ts`, which client components import.

type ServerDemo = (props: DemoProps) => ReactNode | Promise<ReactNode>;

async function WeatherWidgetCard() {
  return <WeatherWidget reading={await getCurrentWeather()} />;
}

export const serverDemos: Record<string, ServerDemo> = {
  "shader-preset-reel": ShaderPresetReel,
  "weather-widget": WeatherWidgetCard,
};

/** Keyed by card, not `componentId`: one demo may be published twice. A missing key means client-loaded. */
export function serverDemoSlots(
  cards: readonly GridCard[],
): Record<string, ReactNode> {
  const slots: Record<string, ReactNode> = {};

  for (const card of cards) {
    if (card.kind !== "component") continue;
    const Demo = serverDemos[card.componentId];
    if (Demo) slots[card.key] = <Demo aspect={card.aspect} />;
  }

  return slots;
}
