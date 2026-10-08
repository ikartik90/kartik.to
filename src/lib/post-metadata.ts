import type { Metadata } from "next";
import { AUTHOR, SITE_LOCALE, SITE_NAME, SITE_TITLE } from "@/data/site";
import { OG_SIZE } from "@/lib/og/card";
import { SITE_URL } from "@/lib/site-url";
import { postDescription } from "@/utils/post-summary";
import type { Post } from "@/domain/post";

// No og:image here: each route's opengraph-image.tsx supplies it.

/**
 * A bare title when `post` is null: generateMetadata runs before notFound(), and a throw
 * would be a 500. `searchTitle` replaces the title everywhere, skipping the layout template.
 * `canonical`, another address search engines should index in its place.
 */
export function postMetadata(
  post: Post | null,
  path: string,
  fallbackTitle: string,
  { searchTitle, canonical = path }: { searchTitle?: string; canonical?: string } = {},
): Metadata {
  if (!post) return { title: fallbackTitle };

  const title = searchTitle ?? post.title ?? fallbackTitle;
  // Left unset, the root layout's site description applies.
  const description = postDescription(post) ?? undefined;

  return {
    title: searchTitle ? { absolute: searchTitle } : title,
    description,
    alternates: {
      canonical,
      types: { "text/markdown": `${path}.md` },
    },
    openGraph: {
      type: "article",
      url: path,
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [AUTHOR.name],
      // Restated from the root layout: Next replaces `openGraph` wholesale rather than merging.
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: AUTHOR.twitterHandle,
    },
  };
}

/** The root layout's card with a given description; Next replaces `openGraph`/`twitter` wholesale. */
export function siteCard(
  description: string,
): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url: SITE_URL,
      title: SITE_TITLE,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description,
      creator: AUTHOR.twitterHandle,
    },
  };
}

/** A homepage project's own address, where its sheet opens over the homepage; `image`, its card as a link preview. */
export function projectMetadata(
  title: string,
  description: string,
  path: string,
  image: string,
): Metadata {
  const images = [{ url: image, ...OG_SIZE, alt: `${title}: ${description}` }];
  return {
    title,
    description,
    alternates: { canonical: path, types: { "text/markdown": `${path}.md` } },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url: path,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: AUTHOR.twitterHandle,
      images,
    },
  };
}

/** Canonical set here, not in the layout, which would make `/` every page's canonical. */
export function homeMetadata(description: string | null): Metadata {
  const canonical: Metadata = { alternates: { canonical: "/" } };
  return description
    ? { ...canonical, description, ...siteCard(description) }
    : canonical;
}
