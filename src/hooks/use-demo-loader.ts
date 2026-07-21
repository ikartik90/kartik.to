import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePageLoaded } from "@/hooks/use-page-loaded";
import { loadDemoAsset, resolveDemoAssets } from "@/utils/demo-assets";
import type { DemoComponentEntry } from "@/components/demo/registry";

// A demo's module (including its warm-up, e.g. the Calchemy engine) is loaded
// once per session and cached by id. Any later instance — a second copy on the
// page, a re-mount, scrolling back after it finished — reads this cache and
// renders the component immediately, so the loader only ever shows for a
// genuine first load, never a fake replay.
const loadedComponents = new Map<string, ComponentType>();
const loadPromises = new Map<string, Promise<ComponentType>>();

function loadDemoModule(entry: DemoComponentEntry): Promise<ComponentType> {
  const cached = loadedComponents.get(entry.id);
  if (cached) return Promise.resolve(cached);

  let promise = loadPromises.get(entry.id);
  if (!promise) {
    // De-duplicate concurrent instances so the module loads a single time.
    promise = entry
      .load()
      .then((component) => {
        loadedComponents.set(entry.id, component);
        loadPromises.delete(entry.id);
        return component;
      })
      .catch((error) => {
        loadPromises.delete(entry.id); // allow a retry on the next mount
        throw error;
      });
    loadPromises.set(entry.id, promise);
  }
  return promise;
}

/** Test-only: forget loaded demos so cases start cold. */
export function __resetDemoLoadCache(): void {
  loadedComponents.clear();
  loadPromises.clear();
}

interface DemoLoaderState {
  /** The demo component, once its module chunk has loaded. */
  Component: ComponentType | null;
  /** True once the module and all reveal-gating fonts have settled. */
  ready: boolean;
  /** Real completion fraction (0–1) across the module + gating fonts. */
  fraction: number;
}

/**
 * Drives a component demo's lazy load: after the page has loaded, it fetches the
 * demo's module chunk and its gating fonts in parallel (kicking off decorative
 * image preloads in the background), tracking progress for the preloader. A demo
 * already loaded earlier in the session resolves synchronously — no loader.
 */
export function useDemoLoader(entry: DemoComponentEntry): DemoLoaderState {
  const pageLoaded = usePageLoaded();
  const [Component, setComponent] = useState<ComponentType | null>(
    () => loadedComponents.get(entry.id) ?? null,
  );
  const [settled, setSettled] = useState(0);
  // Was this demo already loaded when this instance mounted? Captured once (and
  // on entry change) so a mid-load cache write doesn't retroactively skip the
  // fill; a fresh instance of an already-loaded demo reveals with no loader.
  const [preloaded, setPreloaded] = useState(() =>
    loadedComponents.has(entry.id),
  );

  const { fonts, images } = useMemo(() => resolveDemoAssets(entry), [entry]);
  const total = fonts.length + 1;

  // Reset during render (not in an effect) when the demo changes, reusing the
  // cache for the new entry.
  const [loadedEntry, setLoadedEntry] = useState(entry);
  if (loadedEntry !== entry) {
    setLoadedEntry(entry);
    setComponent(loadedComponents.get(entry.id) ?? null);
    setPreloaded(loadedComponents.has(entry.id));
    setSettled(0);
  }

  useEffect(() => {
    if (!pageLoaded || preloaded) return;

    let cancelled = false;
    const bump = () => {
      if (!cancelled) setSettled((n) => n + 1);
    };

    void loadDemoModule(entry).then((loaded) => {
      if (cancelled) return;
      setComponent(() => loaded);
      bump();
    });
    fonts.forEach((font) => void loadDemoAsset(font).then(bump));
    // Images are decorative — warm the shared cache but never gate the reveal.
    images.forEach((image) => void loadDemoAsset(image));

    return () => {
      cancelled = true;
    };
  }, [pageLoaded, preloaded, entry, fonts, images]);

  const ready =
    preloaded || (pageLoaded && Component !== null && settled >= total);
  const fraction = ready ? 1 : Math.min(settled / total, 0.99);

  return { Component, ready, fraction };
}

/**
 * A self-incrementing "trickle" that eases toward ~90% while `active`, so the
 * preloader keeps moving during long, milestone-sparse loads (and covers
 * indeterminate phases). Returns 0–1.
 */
export function useTrickleProgress(active: boolean): number {
  const [progress, setProgress] = useState(active ? 0.06 : 0);

  // Re-seed during render on an active transition, avoiding setState-in-effect.
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setProgress(active ? 0.06 : 0);
  }

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      setProgress((prev) => (prev >= 0.9 ? prev : prev + (0.9 - prev) * 0.1));
    }, 180);

    return () => clearInterval(id);
  }, [active]);

  return progress;
}
