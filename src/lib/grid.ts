import { prisma } from "@/lib/prisma";
import { getDemoComponent } from "@/components/demo/registry";
import { orderGridItems } from "@/utils/grid-order";
import { parsePost } from "@/lib/posts";
import { listingDate } from "@/utils/listing-date";
import { postCover } from "@/utils/post-cover";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import { LinkCardConfigSchema, type LinkCardConfig } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";
import type { Post, PostCardConfig } from "@/domain/post";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "@/data/post-categories";
import { getPostReadUrl } from "@/utils/post-urls";

// The homepage feed: published posts and components as one list in grid order, so a pin's seat counts across all.

/** Default tile shape; a post's own `aspect` overrides it. */
const POST_ASPECT: DemoFrameAspectRatio = "16/9";
const COMPONENT_FALLBACK_ASPECT: DemoFrameAspectRatio = "3/2";

interface GridCardBase {
  /** Stable across renders and unique across the two tables. */
  key: string;
  id: string;
  gridIndex: number | null;
  publishedAt: Date | null;
  aspect: DemoFrameAspectRatio;
  span: number;
}

export interface GridPostCard extends GridCardBase {
  kind: "post";
  title: string;
  href: string;
  date: string | null;
  /** Derived here on the server, so the client never needs the post's whole AST. */
  cover: MediaNode | null;
  /** Resolved against `cover` at render, not here, so rail edits show without a reload. */
  card: PostCardConfig;
}

export interface GridComponentCard extends GridCardBase {
  kind: "component";
  /** The registry key — not unique, so one demo can appear more than once. */
  componentId: string;
  logger: boolean;
  /** The link card's config; an unparseable blob reads as `{}` rather than failing the page. */
  props: LinkCardConfig | null;
}

export type GridCard = GridPostCard | GridComponentCard;

function postToCard(post: Post): GridPostCard {
  const dated = POST_CATEGORIES[post.category].dated;
  return {
    kind: "post",
    key: `post:${post.id}`,
    id: post.id,
    title: post.title ?? "Untitled",
    href: getPostReadUrl(post.category, post.slug),
    date: dated && post.publishedAt ? listingDate(post.publishedAt) : null,
    cover: postCover(post.content),
    card: post.card ?? {},
    gridIndex: post.gridIndex ?? null,
    publishedAt: post.publishedAt ?? null,
    aspect: post.aspect ?? POST_ASPECT,
    span: post.gridSpan ?? 1,
  };
}

/** A try block, not `.catch()`: a missing Prisma delegate throws synchronously, with no promise to reject. */
async function safely<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/** Each source falls back to empty on its own, so the homepage never 500s over its grid. */
export async function getGridCards(): Promise<GridCard[]> {
  const dbPosts = await safely(
    async () =>
      (
        await prisma.post.findMany({
          // Listed categories only: the homepage is itself a PAGE post and would list itself.
          where: {
            publishedAt: { not: null },
            category: { in: LISTED_CATEGORIES },
          },
          orderBy: { publishedAt: "desc" },
        })
      ).map(parsePost),
    [] as Post[],
  );

  const components = await safely(
    () =>
      prisma.component.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
      }),
    [],
  );

  const componentCards: GridComponentCard[] = components.flatMap((row) => {
    // A demo gone from the registry is dropped; its row survives.
    const entry = getDemoComponent(row.componentId);
    if (!entry) return [];
    return [
      {
        kind: "component",
        key: `component:${row.id}`,
        id: row.id,
        componentId: row.componentId,
        // Null defers to the registry, so a later correction there reaches every showing.
        aspect: (row.aspect as DemoFrameAspectRatio | null) ??
          entry.aspectRatio ??
          COMPONENT_FALLBACK_ASPECT,
        logger: row.logger ?? Boolean(entry.logger),
        props: LinkCardConfigSchema.safeParse(row.props ?? {}).data ?? {},
        gridIndex: row.gridIndex,
        publishedAt: row.publishedAt,
        span: row.gridSpan ?? 1,
      },
    ];
  });

  return orderGridItems([...dbPosts.map(postToCard), ...componentCards]);
}
