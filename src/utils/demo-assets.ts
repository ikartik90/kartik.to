/**
 * Lazy, shared asset loading for component demos.
 *
 * Each demo declares the fonts and images it renders with. Assets are loaded
 * once (after the page's `load` event) and cached by `id`, so common assets —
 * the body/mono fonts, the logger's terminal illustration — are downloaded a
 * single time and shared across every demo frame on the page.
 *
 * Fonts gate the demo's reveal (so it paints in the right typeface, no FOUT);
 * images are decorative (logger empty-state art) and preload in the background.
 */

export type DemoAsset =
  | {
      id: string;
      kind: "font";
      /**
       * CSS custom property holding the font-family (e.g. `--font-switzer`),
       * resolved from `<html>` at load time. Preferred over a literal family
       * since `next/font` hashes the family name.
       */
      cssVar?: string;
      /** Literal font-family, used when there is no `cssVar`. */
      family?: string;
    }
  | { id: string; kind: "image"; src: string };

/** Fonts every demo renders body copy with. */
export const COMMON_DEMO_ASSETS: DemoAsset[] = [
  { id: "font-switzer", kind: "font", cssVar: "--font-switzer" },
];

/** Extra shared assets a logger-enabled frame needs (mono output font). The
 *  logger's terminal art is a `next/image` and warms through its optimizer, so
 *  it is intentionally not a raw-URL preload here. */
export const LOGGER_DEMO_ASSETS: DemoAsset[] = [
  { id: "font-jetbrains-mono", kind: "font", cssVar: "--font-jetbrains-mono" },
];

/** Upper bound on any single asset load so a stalled font/image never hangs
 *  the preloader (it resolves as "settled" and the demo still reveals). */
const ASSET_LOAD_TIMEOUT_MS = 6000;

interface ResolvedDemoAssets {
  /** Reveal-gating assets (fonts). */
  fonts: DemoAsset[];
  /** Background assets (images) that preload without blocking the reveal. */
  images: DemoAsset[];
}

interface DemoAssetSource {
  logger?: unknown;
  assets?: DemoAsset[];
}

/**
 * The effective, de-duplicated asset list for a demo: shared fonts, plus the
 * logger's assets when a logger is configured, plus any demo-specific extras.
 */
export function resolveDemoAssets(entry: DemoAssetSource): ResolvedDemoAssets {
  const seen = new Set<string>();
  const fonts: DemoAsset[] = [];
  const images: DemoAsset[] = [];

  const push = (asset: DemoAsset) => {
    if (seen.has(asset.id)) return;
    seen.add(asset.id);
    if (asset.kind === "font") fonts.push(asset);
    else images.push(asset);
  };

  COMMON_DEMO_ASSETS.forEach(push);
  if (entry.logger) LOGGER_DEMO_ASSETS.forEach(push);
  entry.assets?.forEach(push);

  return { fonts, images };
}

const cache = new Map<string, Promise<void>>();

/** Loads an asset once; subsequent calls (any frame) reuse the same promise. */
export function loadDemoAsset(asset: DemoAsset): Promise<void> {
  const cached = cache.get(asset.id);
  if (cached) return cached;

  // Never reject — a failed asset must not wedge a demo behind its preloader.
  const promise = withTimeout(loadAssetOnce(asset)).catch(() => undefined);
  cache.set(asset.id, promise);
  return promise;
}

/** Test-only: clears the shared cache between cases. */
export function __resetDemoAssetCache(): void {
  cache.clear();
}

function withTimeout(promise: Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ASSET_LOAD_TIMEOUT_MS);
    promise.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function loadAssetOnce(asset: DemoAsset): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return asset.kind === "font" ? loadFont(asset) : loadImage(asset.src);
}

function loadFont(asset: Extract<DemoAsset, { kind: "font" }>): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.load !== "function") return Promise.resolve();

  const family = resolveFontFamily(asset);
  if (!family) return Promise.resolve();

  // `document.fonts.load` triggers the load (if not already) and resolves when
  // the face is ready; it is global, so the load is inherently shared.
  return fonts.load(`1em ${family}`).then(() => undefined);
}

function resolveFontFamily(
  asset: Extract<DemoAsset, { kind: "font" }>,
): string | null {
  if (asset.cssVar) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(asset.cssVar)
      .trim();
    // The var holds a family list (`__switzer_x, __switzer_Fallback_x`); the
    // first entry is the real face we want to wait on.
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }
  return asset.family ?? null;
}

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}
