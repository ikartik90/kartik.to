// ---------------------------------------------------------------------------
// Where "back" goes, and what that place is called.
//
// The site's back control used to be an icon button hanging in the left gutter
// of every page that had one; it is a command now ("Back to index", ⌘/).
//
// ONE destination, the index, from wherever you are. It used to climb the tree
// — an article's editor answering to the article, a page with no real ancestor
// falling through to the index — which made the command a step in a history
// the site was not otherwise keeping. It is not browser Back and should not
// imitate it: it is the way home, and the way home does not depend on the
// route you took. The index is also the only page here with no destination of
// its own, which is why it alone answers `null`.
// ---------------------------------------------------------------------------

export interface BackTarget {
  /** Where the command goes. */
  href: string;
  /** What that place is called, as the palette says it: "Back to index". */
  label: string;
}

const INDEX: BackTarget = { href: "/", label: "index" };

/**
 * The index, from anywhere but the index itself — which is the floor, and so
 * has nothing behind it. A trailing slash reads as the same page.
 */
export function getBackTarget(pathname: string): BackTarget | null {
  const isIndex = pathname.split("/").filter(Boolean).length === 0;
  return isIndex ? null : INDEX;
}
