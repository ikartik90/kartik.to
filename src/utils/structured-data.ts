import type { Post, PostCategory } from "@/domain/post";
import {
  AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SOCIAL_PROFILES,
} from "@/data/site";
import { ABOUT_SLUG } from "@/data/page-slugs";
import { POST_CATEGORIES } from "@/data/post-categories";
import { postDescription } from "@/utils/post-summary";
import { getPostReadUrl } from "@/utils/post-urls";

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

const fallbackTitle = (category: PostCategory) =>
  category === "PAGE" ? SITE_TITLE : POST_CATEGORIES[category].label;

export function postJsonLd(post: Post, siteUrl: string): JsonLd {
  const { person, website } = ids(siteUrl);
  const type = POST_CATEGORIES[post.category].schemaType;
  const url = `${siteUrl}${getPostReadUrl(post.category, post.slug)}`;
  const description = postDescription(post);
  const isAbout = post.category === "PAGE" && post.slug === ABOUT_SLUG;

  return graph(
    {
      "@type": isAbout ? "AboutPage" : type,
      ...(isAbout ? { mainEntity: { "@id": person } } : {}),
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: post.title ?? fallbackTitle(post.category),
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

/** Escapes every `<`, so a title holding `</script>` can't end the tag early. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
