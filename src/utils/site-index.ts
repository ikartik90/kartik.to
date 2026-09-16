import type { MetadataRoute } from "next";
import type { Post } from "@/domain/post";
import { AUTHOR, SITE_DESCRIPTION, SITE_TITLE, SOCIAL_PROFILES } from "@/data/site";
import { HOME_SLUG } from "@/data/page-slugs";
import { SITE_PATHS } from "@/data/site-paths";
import { postCover } from "@/utils/post-cover";
import { postSummary } from "@/utils/post-summary";
import { getPostMarkdownUrl, getPostReadUrl } from "@/utils/post-urls";

// ---------------------------------------------------------------------------
// The site's public pages, listed for machines: `sitemap.xml` for search
// engines and `llms.txt` for AI agents.
//
// Both are built from the published posts, so a post appears in each the
// moment it is published and leaves the moment it is not. Drafts, `/edit`, and
// `/vouch` are never named — the admin surface must not be advertised to
// crawlers, and `/vouch` is reached only by a link handed out by hand.
// ---------------------------------------------------------------------------

/** Published projects and articles, newest first. */
function listedPosts(posts: Post[]): Post[] {
  return posts
    .filter((post) => post.publishedAt && post.category !== "PAGE")
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
}

/**
 * Published pages with an address of their own — the About page. The homepage
 * is a PAGE too, but its record is not a page to list: it IS the site's entry.
 */
function listedPages(posts: Post[]): Post[] {
  return posts.filter(
    (post) =>
      post.publishedAt && post.category === "PAGE" && post.slug !== HOME_SLUG,
  );
}

export function sitemapEntries(
  posts: Post[],
  siteUrl: string,
): MetadataRoute.Sitemap {
  const pages = listedPages(posts);
  // The homepage shows every post's card, so any post's edit changes it. A page
  // like About has no card there, so its edits do not.
  const homeModified = posts
    .filter((post) => post.publishedAt && !pages.includes(post))
    .reduce<Date | undefined>(
      (latest, post) =>
        !latest || post.updatedAt > latest ? post.updatedAt : latest,
      undefined,
    );

  const entry = (post: Post) => {
    const cover = postCover(post.content);
    return {
      url: `${siteUrl}${getPostReadUrl(post.category, post.slug)}`,
      lastModified: post.updatedAt,
      ...(cover?.kind === "image" ? { images: [cover.src] } : {}),
    };
  };

  return [
    { url: siteUrl, ...(homeModified ? { lastModified: homeModified } : {}) },
    ...pages.map(entry),
    // Oldest first reads as the order the work happened; the order has no
    // meaning to a crawler either way, so it follows publication.
    ...listedPosts(posts).reverse().map(entry),
    // Every playground: the pages that are not posts, read off the one list
    // that names them so a new one cannot be left out of the index.
    ...SITE_PATHS.map(({ path }) => ({ url: `${siteUrl}${path}` })),
  ];
}

const PROFILE_LABELS: Record<keyof typeof SOCIAL_PROFILES, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  twitter: "X (Twitter)",
};

/** The `llms.txt` file — https://llmstxt.org — for the published site. */
export function llmsTxt(posts: Post[], siteUrl: string): string {
  const { locality, region, country } = AUTHOR.location;
  const listed = listedPosts(posts);

  const postLink = (post: Post) => {
    const summary = postSummary(post.content);
    const link = `[${post.title ?? "Untitled"}](${siteUrl}${getPostMarkdownUrl(post.category, post.slug)})`;
    return `- ${link}${summary ? `: ${summary}` : ""}`;
  };

  const postLinks = (category: Post["category"]) =>
    listed.filter((post) => post.category === category).map(postLink);

  const section = (heading: string, lines: string[]) =>
    lines.length ? [`## ${heading}\n\n${lines.join("\n")}`] : [];

  const blocks = [
    `# ${AUTHOR.name}`,
    `> ${SITE_DESCRIPTION}`,
    [
      `${SITE_TITLE}. This is ${AUTHOR.name}'s personal site. Each post below links to a Markdown copy of its page.`,
      "",
      `- Roles: ${AUTHOR.jobTitles.join(", ")}`,
      `- Based in: ${locality}, ${region}, ${country}`,
      `- Website: ${siteUrl}`,
    ].join("\n"),
    ...section("Pages", listedPages(posts).map(postLink)),
    ...section("Work", postLinks("WORK")),
    ...section("Writing", postLinks("ARTICLE")),
    ...section(
      "Playgrounds",
      SITE_PATHS.map(({ path, title }) => `- [${title}](${siteUrl}${path})`),
    ),
    ...section(
      "Profiles",
      (Object.keys(PROFILE_LABELS) as (keyof typeof SOCIAL_PROFILES)[]).map(
        (key) => `- [${PROFILE_LABELS[key]}](${SOCIAL_PROFILES[key]})`,
      ),
    ),
  ];

  return `${blocks.join("\n\n")}\n`;
}
