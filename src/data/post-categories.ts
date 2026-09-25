import type { PostCategory } from "@/domain/post";

// Every listed category needs a reading route at `src/app/<path>/[slug]` (tested).

export interface PostCategoryInfo {
  label: string;
  /** Its heading in `llms.txt`. */
  section: string;
  /** Reading-URL prefix and `src/app` folder; empty for a page, read at `/<slug>`. */
  path: string;
  schemaType: string;
  /** Whether its card shows the publish date. */
  dated: boolean;
  /** Offered in the metadata sidebar's category choice. */
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

/** In declaration order, which is also the `llms.txt` section order. */
export const LISTED_CATEGORIES = (
  Object.keys(POST_CATEGORIES) as PostCategory[]
).filter((category) => POST_CATEGORIES[category].listed);
