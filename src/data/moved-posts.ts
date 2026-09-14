import type { PostCategory } from "@/domain/post";
import { getPostReadUrl } from "@/utils/post-urls";

// ---------------------------------------------------------------------------
// Posts that were live at one slug and now live at another.
//
// An address that was indexed or shared keeps working: the post's page sends
// the old slug on with a permanent redirect. It does that only when nothing is
// published at the old slug any more — a redirect in `next.config.ts` would
// fire before the database is consulted, so the address would point at a page
// that does not exist yet for as long as the deploy and the rename are apart.
// Checked at the page, the two can land in either order.
//
// The app has no way to rename a slug, so an entry here goes with a rename made
// in the database.
// ---------------------------------------------------------------------------

const MOVED: Record<PostCategory, Record<string, string>> = {
  WORK: { "scheduling-extensions": "redesigning-shift-scheduling" },
  ARTICLE: {},
  PAGE: {},
};

/** Where a post that used to live at `slug` lives now, or null. */
export function movedPostPath(
  category: PostCategory,
  slug: string,
): string | null {
  const to = Object.hasOwn(MOVED[category], slug) ? MOVED[category][slug] : null;
  return to ? getPostReadUrl(category, to) : null;
}
