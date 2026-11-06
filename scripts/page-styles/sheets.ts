import { createRequire } from "node:module";
import type { PandaContext } from "@pandacss/node";

// The copy `@pandacss/dev` runs on, so the generator and the CLI can't drift apart.
const fromDev = createRequire(createRequire(import.meta.url).resolve("@pandacss/dev"));
const { loadConfigAndCreateContext } = fromDev("@pandacss/node") as typeof import("@pandacss/node");
// The browsers Next builds the pages' CSS for. The whole sheet skips Next, so it is lowered for them here, the same way.
const NEXT_TARGETS: string[] = createRequire(import.meta.url)("next/dist/shared/lib/modern-browserslist-target");

type Encoder = PandaContext["encoder"];

function merge(into: Encoder, from: Encoder) {
  from.atomic.forEach((hash) => into.atomic.add(hash));
  from.compound_variants.forEach((hash) => into.compound_variants.add(hash));
  for (const kind of ["recipes", "recipes_base"] as const) {
    from[kind].forEach((hashes, name) => {
      const set = into[kind].get(name) ?? new Set<string>();
      hashes.forEach((hash) => set.add(hash));
      into[kind].set(name, set);
    });
  }
}

export interface Sheets {
  /** Every file Panda's config scans: the whole site's. */
  files: string[];
  /** A stylesheet of what `files` use, which stands alone: its layer order, reset, tokens and globals included. */
  css: (files: string[], options?: { minify?: boolean }) => string;
}

/**
 * Panda, set up from the config in `cwd`; each file is parsed once, however many sheets it is in. Only files in the
 * config's `include`, or the `include` given, can be in a sheet.
 */
export async function loadSheets(cwd: string, include?: string[]): Promise<Sheets> {
  const ctx = await loadConfigAndCreateContext({
    cwd,
    config: { lightningcss: true, browserslist: NEXT_TARGETS, ...(include && { include }) },
  });
  const parsed = new Map<string, Encoder>();
  const encoderOf = (file: string) => {
    let encoder = parsed.get(file);
    if (!encoder) {
      encoder = ctx.encoder.clone();
      ctx.parseFile(file, encoder);
      parsed.set(file, encoder);
    }
    return encoder;
  };

  return {
    files: ctx.getFiles(),
    css: (files, { minify = false } = {}) => {
      const encoder = ctx.encoder.clone();
      [...files].sort().forEach((file) => merge(encoder, encoderOf(file)));
      const sheet = ctx.createSheet();
      ctx.appendLayerParams(sheet);
      ctx.appendBaselineCss(sheet);
      sheet.processDecoder(ctx.decoder.clone().collect(encoder));
      return sheet.toCss({ minify });
    },
  };
}
