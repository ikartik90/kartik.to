import type { PostCategory } from "@/domain/post";

export function getPostReadUrl(category: PostCategory, slug: string): string {
  switch (category) {
    case "WORK":
      return `/work/${slug}`;
    case "ARTICLE":
      return `/writing/${slug}`;
    case "PAGE":
      return `/${slug}`;
  }
}

export function getEditUrl(category: PostCategory, slug?: string): string {
  if (slug) {
    return `/edit/${slug}?category=${category}`;
  }
  return `/edit/new?category=${category}`;
}
