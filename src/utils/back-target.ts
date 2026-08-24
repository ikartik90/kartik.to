import { filenameToLabel } from "./filename-to-label";

// ---------------------------------------------------------------------------
// Where "back" goes, and what that place is called.
//
// The site's back control used to be an icon button hanging in the left gutter
// of every page that had one; it is a command now ("Back to index", ⌘[), so the
// destination it used to hard-code has to be worked out from the path instead.
//
// Up the tree, never one blind segment up: `/writing` and `/work` are prefixes
// with no page behind them, so dropping the last segment of `/writing/a-post`
// would offer a link to a 404. Only an ancestor that is a page of its own can
// be a destination; when none is, the index is the floor.
// ---------------------------------------------------------------------------

export interface BackTarget {
  /** Where the command goes. */
  href: string;
  /** What that place is called, as the palette says it: "Back to index". */
  label: string;
}

const INDEX: BackTarget = { href: "/", label: "index" };

/** Ancestor paths that are pages in their own right — a post, read. */
const POST_PATH = /^\/(?:writing|work)\/[^/]+$/;

/**
 * The page one step back from `pathname`, or `null` at the index — which is
 * the floor, and so has nothing behind it.
 */
export function getBackTarget(pathname: string): BackTarget | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // Nearest first: an article's editor answers to the article, not to the index.
  for (let depth = segments.length - 1; depth > 0; depth--) {
    const ancestor = `/${segments.slice(0, depth).join("/")}`;
    if (POST_PATH.test(ancestor)) {
      return { href: ancestor, label: filenameToLabel(segments[depth - 1]) };
    }
  }
  return INDEX;
}
