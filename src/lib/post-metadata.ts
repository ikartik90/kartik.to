import type { Metadata } from "next";
import { SITE_LOCALE, SITE_NAME } from "@/data/site";
import { postSummary } from "@/utils/post-summary";
import type { Post } from "@/domain/post";

// ---------------------------------------------------------------------------
// What a post says about itself to everything that is not a browser.
//
// One function for both routes, because an article and a project describe
// themselves identically — a name, a line about what they are, a canonical
// address and a card. What differs is which table the slug was looked up in,
// and that is settled before this is called.
//
// The IMAGE is not named here, and that is the file convention rather than an
// omission: `opengraph-image.tsx` sits beside each page, and Next resolves it
// into `og:image` (and `twitter:image`) with its size and type already filled
// in. Naming it here as well would be a second URL to keep in step with the
// route that actually serves it.
// ---------------------------------------------------------------------------

/**
 * A post's metadata, or a bare title for a slug that resolves to nothing.
 *
 * The missing case is handled rather than thrown, because `generateMetadata`
 * runs BEFORE the page: the page will `notFound()` a moment later and Next
 * will serve the 404, but this has to return something in the meantime, and
 * a throw here is a 500 where a 404 was the right answer.
 */
export function postMetadata(
  post: Post | null,
  path: string,
  fallbackTitle: string,
): Metadata {
  if (!post) return { title: fallbackTitle };

  const title = post.title ?? fallbackTitle;
  // The post's own opening, or nothing — the site's description is inherited
  // from the root layout for a post with no prose in it, which is a better
  // thing to say than a sentence invented here.
  const description = postSummary(post.content) ?? undefined;

  return {
    title,
    description,
    // Relative, and resolved against `metadataBase` in the root layout. It is
    // stated at all because a post is reachable at exactly one address and a
    // link shared with a tracking query on it should still be understood as
    // that address.
    alternates: { canonical: path },
    openGraph: {
      // `article` rather than the site's `website`: it is what the post IS,
      // and it is the type that carries a publication date.
      type: "article",
      url: path,
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      // RESTATED from the root layout, which looks redundant and is not: Next
      // REPLACES `openGraph` and `twitter` wholesale rather than merging into
      // the parent's, so a page that says anything at all about its card says
      // everything about it. Left out, these two simply vanished from every
      // post — `og:site_name` and `og:locale` were emitted on the homepage and
      // nowhere else, and `twitter:card` fell back to `summary`, which crops
      // the card to a square thumbnail and throws the cover away.
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
