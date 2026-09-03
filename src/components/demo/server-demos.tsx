import type { ReactNode } from "react";
import { ShaderPresetReel } from "@/components/shader-preset-reel";
import { WeatherWidget } from "@/components/weather-widget";
import { getCurrentWeather } from "@/lib/weather";
import type { DemoProps } from "@/components/demo/registry";
import type { GridCard } from "@/lib/grid";

// ---------------------------------------------------------------------------
// The demos that have a SERVER half, and the nodes the page renders for them.
//
// The registry is the catalogue of demos this codebase has, and every one of
// them loads in the browser: `DemoComponent` is a client component that fetches
// the demo's chunk after the page has loaded and shows a progress bar until it
// arrives. That is the right default for a demo you interact with — its chunk
// is the demo — and the wrong one for a demo whose CONTENT is a database read.
//
// The reel is the second kind. Its presets are a query, its first paint is a
// CSS gradient, and neither needs the browser: rendered here, the card arrives
// in the initial HTML already showing the newest preset's colours, and the only
// thing still to load is the shader that resolves onto them. Rendered the
// ordinary way it would show a progress bar, then fetch a chunk, then make a
// round trip for the presets, then paint.
//
// A SEPARATE module from `registry.ts` because that file is imported by client
// components (`home-grid`, the insert dialog) and this one reaches the database
// through a server action. The two lists are joined by `componentId` and
// nowhere else, which is also why a demo can be in this one without any change
// to its registry entry.
// ---------------------------------------------------------------------------

/**
 * A demo the page can render itself. Async, because that is the whole point —
 * it is a component that awaits its own data before it returns any markup.
 */
type ServerDemo = (props: DemoProps) => ReactNode | Promise<ReactNode>;

/**
 * The weather card, with its reading already taken.
 *
 * The second kind of server demo, and for a slightly different reason from the
 * reel's: this one's content is an OUTBOUND request, and a cached one. Rendered
 * here it costs a single upstream call per revalidation window shared by every
 * visitor; rendered in the browser it would be one call per person, per load,
 * for a number that only changes every fifteen minutes.
 */
async function WeatherWidgetCard() {
  return <WeatherWidget reading={await getCurrentWeather()} />;
}

export const serverDemos: Record<string, ServerDemo> = {
  "shader-preset-reel": ShaderPresetReel,
  "weather-widget": WeatherWidgetCard,
};

/**
 * The server-rendered demo for each card that has one, keyed BY CARD.
 *
 * Not by `componentId`: the same demo is publishable more than once — that is
 * the reason `Component.componentId` carries no unique constraint — and the two
 * showings are different elements, because a row may override the shape it is
 * drawn at. Keyed by demo, both cards would get whichever element was built
 * last, one of them framed for a box it is not in.
 *
 * A card with no entry here is simply ABSENT rather than mapped to null, so the
 * grid's fallback is a plain missing-key check. That fallback is load-bearing
 * twice over: for every demo that has no server half, and for a card inserted
 * into an unsaved layout, which the server has never seen.
 */
export function serverDemoSlots(
  cards: readonly GridCard[],
): Record<string, ReactNode> {
  const slots: Record<string, ReactNode> = {};

  for (const card of cards) {
    if (card.kind !== "component") continue;
    const Demo = serverDemos[card.componentId];
    // The CARD's aspect, which `getGridCards` has already resolved from the
    // row's override, then the registry's default, then the grid's fallback.
    if (Demo) slots[card.key] = <Demo aspect={card.aspect} />;
  }

  return slots;
}
