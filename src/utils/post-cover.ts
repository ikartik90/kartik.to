import type { MediaNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";

/** The first media in the document (a collection's slot 0), whole, so its ground and fit travel with it. */
export function postCover(document: Document): MediaNode | null {
  for (const block of document.content) {
    if (block.type === "media") return block;
    // An empty collection is legal, so the walk goes on past it.
    if (block.type === "collection" && block.items[0]) {
      return block.items[0];
    }
  }
  return null;
}
