import type { BlockNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Sidenotes — shared derivation used by both the editor and the reader.
//
// A sidenote lives as a `{ type: "sidenote", id, text }` mark on a run of inline
// text. Its visible ordinal is NOT stored: it is derived from the order the note
// first appears in the document, so inserting a note before an existing one
// renumbers everything downstream automatically. The inline superscript gets its
// number from a CSS counter (see globals.css) and the aside card gets the same
// number from `number` below — both count in document order, so they always agree.
// ---------------------------------------------------------------------------

export interface SidenoteEntry {
  /** Stable id shared by every run of this note (from the mark). */
  id: string;
  /** Index of the block the annotation lives in. */
  blockIndex: number;
  /** 1-based ordinal in document order. */
  number: number;
  /** Note body shown in the aside card. */
  text: string;
  /** CSS anchor-name the annotation exposes and the card positions against. */
  anchorName: string;
}

/** CSS dashed-ident anchor name for a sidenote id (sanitised to ident-safe chars). */
export function sidenoteAnchorName(id: string): string {
  return `--sn-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Fresh, stable id for a new sidenote (UUID where available, else a random fallback). */
export function makeSidenoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Per-block base offset for sidenote numbering: `bases[i]` is the count of
 * distinct notes appearing before block `i`. Adding the note's first-appearance
 * index within its block yields the global ordinal — this lets each block be
 * serialised independently (see inlineNodesToHtml) while staying in sync with
 * `collectSidenotes`.
 */
export function sidenoteBases(blocks: BlockNode[]): number[] {
  const bases: number[] = [];
  const seen = new Set<string>();
  let count = 0;
  for (const block of blocks) {
    bases.push(count);
    if ("children" in block) {
      for (const node of block.children) {
        const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
        if (mark?.type === "sidenote" && !seen.has(mark.id)) {
          seen.add(mark.id);
          count++;
        }
      }
    }
  }
  return bases;
}

/**
 * Walk the document in order and collect one entry per distinct sidenote id,
 * numbered by first appearance. Blocks without an inline `children` array (rules,
 * images, components) carry no marks and are skipped.
 */
export function collectSidenotes(blocks: BlockNode[]): SidenoteEntry[] {
  const entries: SidenoteEntry[] = [];
  const seen = new Set<string>();

  blocks.forEach((block, blockIndex) => {
    if (!("children" in block)) return;
    for (const node of block.children) {
      const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
      if (mark?.type !== "sidenote" || seen.has(mark.id)) continue;
      seen.add(mark.id);
      entries.push({
        id: mark.id,
        blockIndex,
        number: entries.length + 1,
        text: mark.text,
        anchorName: sidenoteAnchorName(mark.id),
      });
    }
  });

  return entries;
}
