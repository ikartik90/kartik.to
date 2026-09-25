import type { BlockNode } from "@/domain/nodes";

// Ordinals come from first appearance and are never stored. The inline superscript counts
// with a CSS counter (globals.css), so both must count in document order.

export interface SidenoteEntry {
  id: string;
  blockIndex: number;
  /** 1-based, in document order. */
  number: number;
  text: string;
  /** The CSS anchor-name the card positions against. */
  anchorName: string;
}

export function sidenoteAnchorName(id: string): string {
  return `--sn-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function makeSidenoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** `bases[i]` counts distinct notes before block `i`, so a block can be serialised alone and still agree with `collectSidenotes`. */
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
