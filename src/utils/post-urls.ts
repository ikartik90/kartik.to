import type { PostCategory } from "@/domain/post";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "@/data/post-categories";
import { ABOUT_SLUG, HOME_SLUG } from "@/data/page-slugs";

export function getPostReadUrl(category: PostCategory, slug: string): string {
  // The homepage's record has a slug so it can be edited at `/edit/home`; the
  // page itself is the site's root.
  if (category === "PAGE" && slug === HOME_SLUG) return "/";
  return `${POST_CATEGORIES[category].path}/${slug}`;
}

/**
 * The post a reading address names, or null for any other page — the inverse
 * of `getPostReadUrl`. A page is recognised only by the slugs the site has a
 * route for, since every other single-segment path (`/vouch`) is not a post.
 */
export function parsePostReadUrl(
  pathname: string,
): { category: PostCategory; slug: string } | null {
  if (pathname === "/") return { category: "PAGE", slug: HOME_SLUG };
  if (pathname === `/${ABOUT_SLUG}`) {
    return { category: "PAGE", slug: ABOUT_SLUG };
  }
  for (const category of LISTED_CATEGORIES) {
    const prefix = `${POST_CATEGORIES[category].path}/`;
    if (!pathname.startsWith(prefix)) continue;
    const slug = pathname.slice(prefix.length);
    if (slug && !slug.includes("/")) return { category, slug };
  }
  return null;
}

/**
 * The post as Markdown, for AI agents — the `llms.txt` convention of the page's
 * own address with `.md` appended. `next.config.ts` rewrites it to the `md`
 * route handler beside the page.
 */
export function getPostMarkdownUrl(category: PostCategory, slug: string): string {
  return `${getPostReadUrl(category, slug)}.md`;
}

export function getEditUrl(category: PostCategory, slug?: string): string {
  // A page has a static edit route of its own (`/edit/home`, `/edit/about`),
  // which is what creates its record the first time; there is no category for
  // it to be told.
  if (slug && category === "PAGE") return `/edit/${slug}`;
  if (slug) {
    return `/edit/${slug}?category=${category}`;
  }
  return `/edit/new?category=${category}`;
}
