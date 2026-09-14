import type { MetadataRoute } from "next";
import type { Post } from "@/domain/post";
import { AUTHOR, SITE_DESCRIPTION, SITE_TITLE, SOCIAL_PROFILES } from "@/data/site";
import { sitePathLabel } from "@/data/site-paths";
import { postCover } from "@/utils/post-cover";
import { postSummary } from "@/utils/post-summary";
import { getPostMarkdownUrl, getPostReadUrl } from "@/utils/post-urls";

// ---------------------------------------------------------------------------
// The site's public pages, listed for machines: `sitemap.xml` for search
// engines and `llms.txt` for AI agents.
//
// Both are built from the published posts, so a post appears in each the
// moment it is published and leaves the moment it is not. Drafts, `/edit`, and
// the pages kept out of the index on purpose (`/vouch`, and the Calchemy and
// Icons playgrounds, "a tool with a name rather than a page with a subject")
// are never named — the admin surface must not be advertised to crawlers.
// ---------------------------------------------------------------------------

/** Pages that are not posts and are meant to be found. */
const INDEXED_PATHS = ["/playground/shader"];

/** Published projects and articles, newest first. Home is a PAGE and is not one. */
function listedPosts(posts: Post[]): Post[] {
  return posts
    .filter((post) => post.publishedAt && post.category !== "PAGE")
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
}

export function sitemapEntries(
  posts: Post[],
  siteUrl: string,
): MetadataRoute.Sitemap {
  const published = posts.filter((post) => post.publishedAt);
  // The homepage shows every post's card, so any post's edit changes it.
  const homeModified = published.reduce<Date | undefined>(
    (latest, post) =>
      !latest || post.updatedAt > latest ? post.updatedAt : latest,
    undefined,
  );

  // Oldest first reads as the order the work happened; the order has no meaning
  // to a crawler either way, so it follows publication.
  const postEntries = listedPosts(posts)
    .reverse()
    .map((post) => {
      const cover = postCover(post.content);
      return {
        url: `${siteUrl}${getPostReadUrl(post.category, post.slug)}`,
        lastModified: post.updatedAt,
        ...(cover?.kind === "image" ? { images: [cover.src] } : {}),
      };
    });

  return [
    { url: siteUrl, ...(homeModified ? { lastModified: homeModified } : {}) },
    ...postEntries,
    ...INDEXED_PATHS.map((path) => ({ url: `${siteUrl}${path}` })),
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

  const postLinks = (category: Post["category"]) =>
    listed
      .filter((post) => post.category === category)
      .map((post) => {
        const summary = postSummary(post.content);
        const link = `[${post.title ?? "Untitled"}](${siteUrl}${getPostMarkdownUrl(post.category, post.slug)})`;
        return `- ${link}${summary ? `: ${summary}` : ""}`;
      });

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
    ...section("Work", postLinks("WORK")),
    ...section("Writing", postLinks("ARTICLE")),
    ...section(
      "Playgrounds",
      INDEXED_PATHS.map(
        (path) => `- [${sitePathLabel(path) ?? path}](${siteUrl}${path})`,
      ),
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
