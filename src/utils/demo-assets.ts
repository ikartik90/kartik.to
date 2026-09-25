// Fonts gate a demo's reveal (no FOUT); images preload in the background. Loads are shared by id.

export type DemoAsset =
  | {
      id: string;
      kind: "font";
      /** Preferred over `family`: `next/font` hashes the family name. */
      cssVar?: string;
      family?: string;
    }
  | { id: string; kind: "image"; src: string };

export const COMMON_DEMO_ASSETS: DemoAsset[] = [
  { id: "font-switzer", kind: "font", cssVar: "--font-switzer" },
];

/** The terminal art is a `next/image` warmed by its optimizer, so it is not preloaded here. */
export const LOGGER_DEMO_ASSETS: DemoAsset[] = [
  { id: "font-jetbrains-mono", kind: "font", cssVar: "--font-jetbrains-mono" },
];

const ASSET_LOAD_TIMEOUT_MS = 6000;

interface ResolvedDemoAssets {
  fonts: DemoAsset[];
  images: DemoAsset[];
}

interface DemoAssetSource {
  logger?: unknown;
  assets?: DemoAsset[];
}

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

export function loadDemoAsset(asset: DemoAsset): Promise<void> {
  const cached = cache.get(asset.id);
  if (cached) return cached;

  // Never reject — a failed asset must not wedge a demo behind its preloader.
  const promise = withTimeout(loadAssetOnce(asset)).catch(() => undefined);
  cache.set(asset.id, promise);
  return promise;
}

/** Test-only. */
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

  return fonts.load(`1em ${family}`).then(() => undefined);
}

function resolveFontFamily(
  asset: Extract<DemoAsset, { kind: "font" }>,
): string | null {
  if (asset.cssVar) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(asset.cssVar)
      .trim();
    // The var holds a family list; the first entry is the real face.
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
