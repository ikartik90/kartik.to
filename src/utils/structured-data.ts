import type { Post, PostCategory } from "@/domain/post";
import {
  AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SOCIAL_PROFILES,
} from "@/data/site";
import { ABOUT_SLUG } from "@/data/page-slugs";
import { postSummary } from "@/utils/post-summary";
import { getPostReadUrl } from "@/utils/post-urls";

// ---------------------------------------------------------------------------
// What a page IS, stated as schema.org JSON-LD.
//
// A search engine reading the homepage sees a grid of cards; an answer engine
// asked "who is a product designer in Toronto" needs to know that the grid is
// one person's, what they do, where they are, and that the GitHub and LinkedIn
// profiles are the same person. None of that is in the markup, so it is said
// here, as a graph whose nodes point at each other by `@id`.
//
// Every published post gets its own description built from the post, so a
// page published later is described with no extra step.
// ---------------------------------------------------------------------------

type JsonLdNode = Record<string, unknown>;

export interface JsonLd {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

const LANGUAGE = "en";

const ids = (siteUrl: string) => ({
  person: `${siteUrl}/#person`,
  website: `${siteUrl}/#website`,
  profile: `${siteUrl}/#profile`,
});

function personNode(siteUrl: string): JsonLdNode {
  const { locality, region, country, countryCode } = AUTHOR.location;
  return {
    "@type": "Person",
    "@id": ids(siteUrl).person,
    name: AUTHOR.name,
    alternateName: AUTHOR.fullName,
    url: siteUrl,
    image: `${siteUrl}${AUTHOR.avatar}`,
    jobTitle: [...AUTHOR.jobTitles],
    description: SITE_DESCRIPTION,
    knowsAbout: [...AUTHOR.knowsAbout],
    homeLocation: {
      "@type": "Place",
      name: `${locality}, ${region}, ${country}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: locality,
        addressRegion: region,
        addressCountry: countryCode,
      },
    },
    sameAs: Object.values(SOCIAL_PROFILES),
  };
}

function websiteNode(siteUrl: string): JsonLdNode {
  const { person, website } = ids(siteUrl);
  return {
    "@type": "WebSite",
    "@id": website,
    url: siteUrl,
    name: SITE_NAME,
    alternateName: AUTHOR.name,
    description: SITE_DESCRIPTION,
    inLanguage: LANGUAGE,
    publisher: { "@id": person },
  };
}

const graph = (...nodes: JsonLdNode[]): JsonLd => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

/** The homepage: the site, the person, and the page as their profile. */
export function homeJsonLd(siteUrl: string): JsonLd {
  const { person, website, profile } = ids(siteUrl);
  return graph(
    {
      "@type": "ProfilePage",
      "@id": profile,
      url: siteUrl,
      name: SITE_TITLE,
      description: SITE_DESCRIPTION,
      inLanguage: LANGUAGE,
      mainEntity: { "@id": person },
      isPartOf: { "@id": website },
    },
    websiteNode(siteUrl),
    personNode(siteUrl),
  );
}

const POST_TYPES: Record<PostCategory, { type: string; fallbackTitle: string }> =
  {
    WORK: { type: "Article", fallbackTitle: "Project" },
    ARTICLE: { type: "BlogPosting", fallbackTitle: "Article" },
    PAGE: { type: "WebPage", fallbackTitle: SITE_TITLE },
  };

/** One post, by the person, on the site. */
export function postJsonLd(post: Post, siteUrl: string): JsonLd {
  const { person, website } = ids(siteUrl);
  const { type, fallbackTitle } = POST_TYPES[post.category];
  const url = `${siteUrl}${getPostReadUrl(post.category, post.slug)}`;
  const description = postSummary(post.content);
  // schema.org has a type for exactly this page, and it is about the person.
  const isAbout = post.category === "PAGE" && post.slug === ABOUT_SLUG;

  return graph(
    {
      "@type": isAbout ? "AboutPage" : type,
      ...(isAbout ? { mainEntity: { "@id": person } } : {}),
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: post.title ?? fallbackTitle,
      ...(description ? { description } : {}),
      ...(post.publishedAt
        ? { datePublished: post.publishedAt.toISOString() }
        : {}),
      dateModified: post.updatedAt.toISOString(),
      // The card the post is shared with — `opengraph-image.tsx` beside the page.
      image: `${url}/opengraph-image`,
      inLanguage: LANGUAGE,
      author: { "@id": person },
      publisher: { "@id": person },
      isPartOf: { "@id": website },
    },
    websiteNode(siteUrl),
    personNode(siteUrl),
  );
}

/**
 * The graph as the body of a `<script>`, with every `<` escaped so a title
 * holding `</script>` cannot end the tag early — Next's JSON-LD guide.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
