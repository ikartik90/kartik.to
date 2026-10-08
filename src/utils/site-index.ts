import type { MetadataRoute } from "next";
import type { Post } from "@/domain/post";
import { AUTHOR, SITE_DESCRIPTION, SITE_TITLE, SOCIAL_PROFILES } from "@/data/site";
import { HOME_SLUG } from "@/data/page-slugs";
import { SITE_PATHS } from "@/data/site-paths";
import { postCover } from "@/utils/post-cover";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "@/data/post-categories";
import { postDescription } from "@/utils/post-summary";
import { getPostMarkdownUrl, getPostReadUrl } from "@/utils/post-urls";

// Drafts, `/edit` and `/vouch` are never named: the admin surface must not be advertised,
// and `/vouch` is reached only by a link handed out by hand.

export interface ListedProject {
  title: string;
  summary: string;
  path: string;
  /** A post's address that this project's copy stands in for. */
  replaces?: string;
}

function listedPosts(posts: Post[], projects: ListedProject[] = []): Post[] {
  const replaced = new Set(projects.map((project) => project.replaces));
  return posts
    .filter((post) => post.publishedAt && POST_CATEGORIES[post.category].listed)
    .filter((post) => !replaced.has(getPostReadUrl(post.category, post.slug)))
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());
}

/** The homepage's record is left out: it is the site's entry, not a page to list. */
function listedPages(posts: Post[]): Post[] {
  return posts.filter(
    (post) =>
      post.publishedAt && post.category === "PAGE" && post.slug !== HOME_SLUG,
  );
}

/** `projects`: the homepage's, each with an address of its own where its sheet opens. */
export function sitemapEntries(
  posts: Post[],
  siteUrl: string,
  projects: ListedProject[] = [],
): MetadataRoute.Sitemap {
  const pages = listedPages(posts);
  // Any post's edit changes the homepage, where its card is; a page like About has none.
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
    ...projects.map(({ path }) => ({ url: `${siteUrl}${path}` })),
    ...pages.map(entry),
    ...listedPosts(posts, projects).reverse().map(entry),
    ...SITE_PATHS.map(({ path }) => ({ url: `${siteUrl}${path}` })),
  ];
}

const PROFILE_LABELS: Record<keyof typeof SOCIAL_PROFILES, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  twitter: "X (Twitter)",
};

/** https://llmstxt.org */
export function llmsTxt(posts: Post[], siteUrl: string, projects: ListedProject[] = []): string {
  const { locality, region, country } = AUTHOR.location;
  const listed = listedPosts(posts, projects);

  const postLink = (post: Post) => {
    const summary = postDescription(post);
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
    ...section(POST_CATEGORIES.PAGE.section, listedPages(posts).map(postLink)),
    ...section(
      "Projects",
      projects.map(({ title, summary, path }) => `- [${title}](${siteUrl}${path}.md): ${summary}`),
    ),
    ...LISTED_CATEGORIES.flatMap((category) =>
      section(POST_CATEGORIES[category].section, postLinks(category)),
    ),
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
