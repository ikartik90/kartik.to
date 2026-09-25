import type { PostCategory } from "@/domain/post";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "@/data/post-categories";
import { ABOUT_SLUG, HOME_SLUG } from "@/data/page-slugs";

export function getPostReadUrl(category: PostCategory, slug: string): string {
  // The homepage's record has a slug (for `/edit/home`), but it lives at the root.
  if (category === "PAGE" && slug === HOME_SLUG) return "/";
  return `${POST_CATEGORIES[category].path}/${slug}`;
}

/** Inverse of `getPostReadUrl`; pages match only the slugs the site routes. */
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

/** `next.config.ts` rewrites it to the `md` route handler beside the page. */
export function getPostMarkdownUrl(category: PostCategory, slug: string): string {
  return `${getPostReadUrl(category, slug)}.md`;
}

export function getEditUrl(category: PostCategory, slug?: string): string {
  // A page has its own static edit route, which creates its record the first time.
  if (slug && category === "PAGE") return `/edit/${slug}`;
  if (slug) {
    return `/edit/${slug}?category=${category}`;
  }
  return `/edit/new?category=${category}`;
}
