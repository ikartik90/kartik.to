import type { BlockNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";

// ---------------------------------------------------------------------------
// What a post is about, in one line — read off the post, the way its cover is.
//
// It is for the places the page is described rather than shown: the `description`
// meta tag, and the line under the title in every link preview a shared URL
// turns into. Those wanted a field, and a field is what `postCover` already
// argued its way out of: a summary authored beside the document is a second
// copy of something the writing already says, set once and then quietly wrong
// for the rest of the post's life. Nothing about a stale summary looks stale.
//
// So the rule is the plainest one there is, and it is `postCover`'s rule
// applied to words: whatever the reader meets first. Headings are skipped —
// a heading names a section, and the opening one usually restates the title —
// and so is everything that is not prose. The first real paragraph is where a
// writer says what they are about, because it has to be.
//
// The run it starts in is joined rather than the paragraph alone, and that is
// the one departure from "the first of them". An opening line is regularly a
// sentence fragment — a date, a client, a one-clause hook — and a description
// that reads "Shift scheduling." tells a reader nothing they did not get from
// the title. Reading on until there is enough to be a description, or until
// the prose stops, costs nothing and fails in the direction of saying more.
// ---------------------------------------------------------------------------

/**
 * How long a description may run.
 *
 * Search engines show around 155 characters and the social cards show fewer
 * still, but what is CUT is the reader's loss and what is never sent is
 * nobody's gain — a description trimmed to the shortest of them would be
 * trimmed for every surface by the strictest one. 200 is past every card's own
 * cut and short enough that the trim lands in a sentence rather than an essay.
 */
export const SUMMARY_MAX_CHARS = 200;

/** The text of one block, with its inline pieces run together as written. */
function blockText(block: BlockNode): string {
  return "children" in block && Array.isArray(block.children)
    ? block.children.map((child) => child.text ?? "").join("")
    : "";
}

/**
 * Whether this block is the kind of thing a post is described by.
 *
 * Paragraphs and pull quotes. Not headings (a heading names a section, and the
 * first one is usually the title again), not list items (a fragment out of
 * context), and nothing that is not words at all.
 */
function isProse(block: BlockNode): boolean {
  return block.type === "paragraph" || block.type === "blockquote";
}

/** Cut to the cap on a word boundary, marked as cut. */
function trim(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) return text;
  const cut = text.slice(0, SUMMARY_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  // A single unbroken run longer than the cap has no word to break on, and is
  // cut where it falls rather than thrown away.
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The post in a line, or `null` for one with no prose in it at all.
 *
 * `null` rather than the title or a house string, because what to say instead
 * is the CALLER's question: a page with no description falls back to the
 * site's, and the site's is not this module's to know.
 */
export function postSummary(document: Document): string | null {
  const parts: string[] = [];

  for (const block of document.content) {
    if (!isProse(block)) {
      // Only before it has started. A media block partway down an article is
      // not the end of the summary's run — but one at the top, which is where
      // a cover lives, must not stop the walk before it has found anything.
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
