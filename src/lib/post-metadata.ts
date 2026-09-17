import type { Metadata } from "next";
import { AUTHOR, SITE_LOCALE, SITE_NAME, SITE_TITLE } from "@/data/site";
import { SITE_URL } from "@/lib/site-url";
import { postDescription } from "@/utils/post-summary";
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
 *
 * `searchTitle` replaces the post's title in the tab, the search result and the
 * card, stated in full — the layout's `%s — Kartik Iyer` template is skipped,
 * since a title written for search already says who it is about.
 */
export function postMetadata(
  post: Post | null,
  path: string,
  fallbackTitle: string,
  { searchTitle }: { searchTitle?: string } = {},
): Metadata {
  if (!post) return { title: fallbackTitle };

  const title = searchTitle ?? post.title ?? fallbackTitle;
  // What the author wrote for search, else the post's own opening, else
  // nothing — the site's description is inherited from the root layout for a
  // post with no prose in it, which is a better thing to say than a sentence
  // invented here.
  const description = postDescription(post) ?? undefined;

  return {
    title: searchTitle ? { absolute: searchTitle } : title,
    description,
    // Relative, and resolved against `metadataBase` in the root layout. It is
    // stated at all because a post is reachable at exactly one address and a
    // link shared with a tracking query on it should still be understood as
    // that address.
    //
    // The Markdown alternate is the same post for AI agents, served by the `md`
    // route beside the page (see `getPostMarkdownUrl`).
    alternates: {
      canonical: path,
      types: { "text/markdown": `${path}.md` },
    },
    openGraph: {
      // `article` rather than the site's `website`: it is what the post IS,
      // and it is the type that carries a publication date.
      type: "article",
      url: path,
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [AUTHOR.name],
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
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: AUTHOR.twitterHandle,
    },
  };
}

/**
 * The site's own link-preview card — the root layout's, with the line under
 * the title as given.
 *
 * A function rather than two literals because the card has two authors: the
 * layout, which says the site's description, and the homepage, which says the
 * one written for it in the metadata sidebar. Next replaces `openGraph` and
 * `twitter` WHOLESALE rather than merging a page's into the layout's, so the
 * homepage cannot say only the line that changed; it restates the card, and
 * this is what keeps the restatement and the original the same card.
 */
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
      // The large card, because what is being shared is a PICTURE of the
      // post's tile — at `summary` it is cropped to a square thumbnail beside
      // the text, which throws away the half of the card that is the cover.
      card: "summary_large_image",
      title: SITE_TITLE,
      description,
      creator: AUTHOR.twitterHandle,
    },
  };
}

/**
 * The homepage's metadata: its canonical address, and — only where the author
 * has written one — its own description, which otherwise is the site's,
 * inherited from the root layout.
 *
 * Canonical here rather than in the layout, which every page inherits: a
 * layout-level canonical would name the homepage as the address of every page
 * that does not state its own.
 */
export function homeMetadata(description: string | null): Metadata {
  const canonical: Metadata = { alternates: { canonical: "/" } };
  return description
    ? { ...canonical, description, ...siteCard(description) }
    : canonical;
}
