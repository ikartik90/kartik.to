import type { PostCategory } from "@/domain/post";

// ---------------------------------------------------------------------------
// What each kind of post is called, where it is read, and how it describes
// itself — written once, so a new category is one entry here rather than a
// hunt through every surface that says "article" or "project".
//
// A Record over the enum, so adding a value to `PostCategorySchema` (and the
// Prisma enum beside it) is a compile error here until it has been described.
// What the compiler cannot check, a test does: every LISTED category needs a
// reading route at its prefix (`src/app/<path>/[slug]`), which is the one part
// of a new category that is a folder rather than a line.
//
// `PAGE` is described but not listed. A page has an address of its own rather
// than one under a prefix (`/about`, and the homepage at `/`), so a post cannot
// be moved into it or out of it — that is what `listed` records, and what the
// metadata sidebar offers its category choice from.
// ---------------------------------------------------------------------------

export interface PostCategoryInfo {
  /** The singular noun — "This Article", "Publish project", the sidebar's option. */
  label: string;
  /** The heading its posts are grouped under in `llms.txt`. */
  section: string;
  /**
   * The address prefix its posts are read under, and the folder under
   * `src/app` that serves them. Empty for a page, which is read at `/<slug>`.
   */
  path: string;
  /** What schema.org calls one of these. */
  schemaType: string;
  /**
   * Whether its card is filed by the date it went out. An article's is; a
   * project's line is whatever its author writes there instead.
   */
  dated: boolean;
  /** Whether a post can be filed under it from the metadata sidebar. */
  listed: boolean;
}

export const POST_CATEGORIES: Record<PostCategory, PostCategoryInfo> = {
  WORK: {
    label: "Project",
    section: "Work",
    path: "/work",
    schemaType: "Article",
    dated: false,
    listed: true,
  },
  ARTICLE: {
    label: "Article",
    section: "Writing",
    path: "/writing",
    schemaType: "BlogPosting",
    dated: true,
    listed: true,
  },
  PROTOTYPE: {
    label: "Prototype",
    section: "Prototypes",
    path: "/prototype",
    // A made thing rather than a piece of writing about one — schema.org's
    // general type for a work, where a project's case study is an Article.
    schemaType: "CreativeWork",
    dated: false,
    listed: true,
  },
  PAGE: {
    label: "Page",
    section: "Pages",
    path: "",
    schemaType: "WebPage",
    dated: false,
    listed: false,
  },
};

/**
 * The categories a post can be filed under, in the order they are offered —
 * the order the entries above are written in, which is also the order
 * `llms.txt` lists their sections.
 */
export const LISTED_CATEGORIES = (
  Object.keys(POST_CATEGORIES) as PostCategory[]
).filter((category) => POST_CATEGORIES[category].listed);
