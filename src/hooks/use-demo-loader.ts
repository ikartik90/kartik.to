import { useEffect, useMemo, useState, type ComponentType } from "react";
import { usePageLoaded } from "@/hooks/use-page-loaded";
import { loadDemoAsset, resolveDemoAssets } from "@/utils/demo-assets";
import type { DemoComponentEntry, DemoProps } from "@/components/demo/registry";

// Loaded modules are cached per session, so later instances render without the loader.
const loadedComponents = new Map<string, ComponentType<DemoProps>>();
const loadPromises = new Map<string, Promise<ComponentType<DemoProps>>>();

function loadDemoModule(entry: DemoComponentEntry): Promise<ComponentType<DemoProps>> {
  const cached = loadedComponents.get(entry.id);
  if (cached) return Promise.resolve(cached);

  let promise = loadPromises.get(entry.id);
  if (!promise) {
    const load = entry.load;
    if (!load) {
      return Promise.reject(
        new Error(`Demo "${entry.id}" is a card and has no module to load`),
      );
    }
    promise = load()
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
  Component: ComponentType<DemoProps> | null;
  /** True once the module and all reveal-gating fonts have settled. */
  ready: boolean;
  /** 0–1 across the module and gating fonts. */
  fraction: number;
}

/** Lazy-loads a demo's module and gating fonts once the page has loaded, with progress. */
export function useDemoLoader(entry: DemoComponentEntry): DemoLoaderState {
  const pageLoaded = usePageLoaded();
  const [Component, setComponent] = useState<ComponentType<DemoProps> | null>(
    () => loadedComponents.get(entry.id) ?? null,
  );
  const [settled, setSettled] = useState(0);
  // Captured at mount (and on entry change) so a mid-load cache write can't skip the fill.
  const [preloaded, setPreloaded] = useState(() =>
    loadedComponents.has(entry.id),
  );

  const { fonts, images } = useMemo(() => resolveDemoAssets(entry), [entry]);
  const total = fonts.length + 1;

  const [loadedEntry, setLoadedEntry] = useState(entry);
  if (loadedEntry !== entry) {
    setLoadedEntry(entry);
    // Via an updater: a component is a function, which setState would call as `updater(prev)`.
    setComponent(() => loadedComponents.get(entry.id) ?? null);
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

/** Eases toward ~0.9 while `active`, so the preloader keeps moving between milestones. */
export function useTrickleProgress(active: boolean): number {
  const [progress, setProgress] = useState(active ? 0.06 : 0);

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
