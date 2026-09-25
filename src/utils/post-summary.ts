import type { BlockNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";

export const SUMMARY_MAX_CHARS = 200;

function blockText(block: BlockNode): string {
  return "children" in block && Array.isArray(block.children)
    ? block.children.map((child) => child.text ?? "").join("")
    : "";
}

/** Not headings (usually the title again) or list items (fragments out of context). */
function isProse(block: BlockNode): boolean {
  return block.type === "paragraph" || block.type === "blockquote";
}

function trim(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) return text;
  const cut = text.slice(0, SUMMARY_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The opening prose run, trimmed to the cap; null (the caller's fallback) when there is none. */
export function postSummary(document: Document): string | null {
  const parts: string[] = [];

  for (const block of document.content) {
    if (!isProse(block)) {
      // Non-prose is skipped before the run starts (a cover at the top) and ends it after.
      if (parts.length === 0) continue;
      break;
    }
    const text = blockText(block).trim();
    if (!text) continue;
    parts.push(text);
    if (parts.join(" ").length >= SUMMARY_MAX_CHARS) break;
  }

  const summary = parts.join(" ").trim();
  return summary ? trim(summary) : null;
}

/** The one place the authored description and the derived summary are chosen between. */
export function postDescription(post: {
  description?: string | null;
  content: Document;
}): string | null {
  return post.description?.trim() || postSummary(post.content);
}
