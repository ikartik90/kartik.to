import { prisma } from "@/lib/prisma";
import { getDemoComponent } from "@/components/demo/registry";
import { orderGridItems } from "@/utils/grid-order";
import { parsePost } from "@/lib/posts";
import { postCover } from "@/utils/post-cover";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import { LinkCardConfigSchema, type LinkCardConfig } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";
import type { Post } from "@/domain/post";

// ---------------------------------------------------------------------------
// The homepage feed: every published thing, in the order the grid renders it.
//
// Everything on it comes from a table. `src/data/articles.ts` and
// `src/data/projects.ts` used to be merged in beside the database rows, giving
// the page something to show before anything had been written; they are
// fixtures for the playgrounds now, and no longer a listing. What made that
// untenable is that a card is a control surface: a static one wore the same
// toolbar as every other card while having no row to write to, so pinning,
// widening, reshaping and retiring it were no-ops that looked like controls,
// and `saveGridLayout` had to keep a set of their ids just to route around
// them. Nothing seeds the grid now — an empty grid is the honest picture of an
// empty database.
//
// Projects, articles and standalone components are ONE list here rather than
// three sections, because the grid does not distinguish them — a card is a card,
// and a pin at seat 3 has to mean seat 3 among all of them or it means nothing.
// Keeping writing in a separate list below would have made "index 3" ambiguous
// the moment an article wanted to sit between two projects.
//
// The kind survives as a discriminant because the three still RENDER
// differently and offer different controls: only a component can be
// unpublished from the grid, and only a post has somewhere to navigate to.
// ---------------------------------------------------------------------------

/**
 * How a project's tile is shaped when the post has no opinion of its own.
 *
 * A default, not a rule: the grid's aspect picker writes `Post.aspect`, and a
 * post that has been reshaped keeps its shape.
 */
const POST_ASPECT: DemoFrameAspectRatio = "16/9";
/** A registered demo with no shape of its own — the showcase ratio. */
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
  /** Articles are filed by date; projects are not. */
  date: string | null;
  /**
   * The picture the tile shows, read off the post's own document, and null for
   * one that holds no media at all.
   *
   * DERIVED rather than stored, which is the whole argument — see `postCover`.
   * It is done HERE, on the server, where the document is already in hand: the
   * card is the only part of a post the homepage sends to the browser, and
   * shipping every article's full AST to a client component so it could find
   * its own opening image would be the document many times over for one src.
   */
  cover: MediaNode | null;
}

export interface GridComponentCard extends GridCardBase {
  kind: "component";
  /** The registry key — not unique, so one demo can appear more than once. */
  componentId: string;
  logger: boolean;
  /**
   * What this publication IS, for the one registry entry that is a shell rather
   * than a specimen — the link card. `null` for every other card, where the
   * demo's own code is the whole content and there is nothing to configure.
   *
   * Read LENIENTLY off the row: a blob that no longer parses (a card pointing
   * at a route the site has since dropped, say) becomes an empty configuration
   * rather than an exception. The card renders blank and can be fixed in the
   * rail, which is a better failure than the homepage 500ing over one tile.
   */
  props: LinkCardConfig | null;
}

export type GridCard = GridPostCard | GridComponentCard;

/** The listing's date format, matching what the writing list used to print. */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function postToCard(post: Post): GridPostCard {
  const isArticle = post.category === "ARTICLE";
  return {
    kind: "post",
    key: `post:${post.id}`,
    id: post.id,
    // Nullable because a draft exists before it is called anything; what an
    // unnamed record is CALLED is a fact about posts, not about tiles.
    title: post.title ?? "Untitled",
    href: `${isArticle ? "/writing" : "/work"}/${post.slug}`,
    date: isArticle && post.publishedAt ? formatDate(post.publishedAt) : null,
    // Every post card, project and article alike. `LinkCard` is one card and
    // the grid is one grid: articles wearing pictures while projects kept a
    // flat plate would read as two card designs sharing a listing.
    cover: postCover(post.content),
    gridIndex: post.gridIndex ?? null,
    publishedAt: post.publishedAt ?? null,
    // The post's own override, or the listing default. Same absent-means-
    // default rule a component's `aspect` follows.
    aspect: post.aspect ?? POST_ASPECT,
    // Null is one column — see `GridSpanSchema`. A card that has never been
    // widened has no width of its own, and the grid's default is the answer.
    span: post.gridSpan ?? 1,
  };
}

/**
 * Run a query, and take the fallback if anything at all goes wrong.
 *
 * A `try` block rather than `.catch()` on the promise, which is the difference
 * between working and not: a delegate for a table the generated client has not
 * caught up with is `undefined`, so `prisma.component.findMany` throws a
 * TypeError SYNCHRONOUSLY and there is no promise to reject. `.catch()` never
 * runs and the whole page 500s over a table that simply is not there yet.
 */
async function safely<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/**
 * Every card on the homepage, seated.
 *
 * Fails narrow: a database that is unreachable, or one that has not had the
 * grid columns pushed to it yet, costs the grid and nothing else. The homepage
 * is a document with the grid set into it, and the writing around it is worth
 * serving on its own — a page missing its listing beats a page that 500s.
 * Each source is caught separately so one failing does not silence the other.
 */
export async function getGridCards(): Promise<GridCard[]> {
  const dbPosts = await safely(
    async () =>
      (
        await prisma.post.findMany({
          // WORK and ARTICLE only. A PAGE is not a card: the homepage is itself
          // a published `PAGE` post now, and without this it lists itself — an
          // "Untitled" tile linking to the page you are already on.
          where: {
            publishedAt: { not: null },
            category: { in: ["WORK", "ARTICLE"] },
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
    // A publication whose demo has since left the registry renders nothing at
    // all, so it is dropped rather than shown as a hole. The row survives, and
    // reappears if the demo comes back.
    const entry = getDemoComponent(row.componentId);
    if (!entry) return [];
    return [
      {
        kind: "component",
        key: `component:${row.id}`,
        id: row.id,
        componentId: row.componentId,
        // The row overrides the registry only where it actually said something;
        // null means "whatever the registry says now", so a later correction
        // there reaches every showing of the demo.
        aspect: (row.aspect as DemoFrameAspectRatio | null) ??
          entry.aspectRatio ??
          COMPONENT_FALLBACK_ASPECT,
        logger: row.logger ?? Boolean(entry.logger),
        // See `GridComponentCard.props` for why an unparseable blob is an empty
        // configuration rather than a throw.
        props: LinkCardConfigSchema.safeParse(row.props ?? {}).data ?? {},
        gridIndex: row.gridIndex,
        publishedAt: row.publishedAt,
        span: row.gridSpan ?? 1,
      },
    ];
  });

  return orderGridItems([...dbPosts.map(postToCard), ...componentCards]);
}
