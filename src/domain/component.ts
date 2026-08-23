import { z } from "zod";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { MAX_GRID_SPAN } from "@/utils/listing-columns";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// Component — a demo's PUBLICATION, which is a different fact from its
// existence.
//
// `src/components/demo/registry.ts` says which demos this codebase HAS. It says
// nothing about which ones the homepage shows, and it must not: the three
// shift-scheduling demos exist so an article can embed them, and every one of
// them would leak onto the grid the moment the registry doubled as the
// published set. So publication is a ROW. A demo appears on the homepage once,
// and only once, somebody writes one — the registry is the catalogue, this
// table is the shelf.
// ---------------------------------------------------------------------------

/**
 * Which shape a published demo is drawn at.
 *
 * Derived from `ASPECT_RATIOS` rather than restated, because that map is the
 * only place a demo-frame ratio is written down and has already paid for the
 * lesson: it was three hand-kept copies, a correction landed in two of them,
 * and the third kept the old portrait height with every test still green. A
 * twelfth ratio must be one line THERE and reach this validator for free.
 *
 * `Object.keys` needs the cast because TypeScript types it `string[]` — the
 * object's key type is not carried through — and `z.enum` wants a non-empty
 * tuple to infer a literal union from. The cast asserts nothing the map does
 * not already prove: the element type is `DemoFrameAspectRatio`, which is
 * itself `keyof typeof ASPECT_RATIOS`.
 */
export const ComponentAspectSchema = z.enum(
  Object.keys(ASPECT_RATIOS) as [DemoFrameAspectRatio, ...DemoFrameAspectRatio[]],
);

export type ComponentAspect = z.infer<typeof ComponentAspectSchema>;

/**
 * A card's fixed position on the homepage grid, shared by every kind of card
 * that can sit on it — a published component, a project, an article.
 *
 * Null is not "position zero", it is "no position": the card takes its place
 * from `publishedAt` like everything else. Set, it is pinned there and the
 * chronological run flows around it. Those are two different behaviours, which
 * is why the column is nullable rather than defaulted — a `0` default would
 * pin every row that had never been touched to the front of the grid, all of
 * them at once.
 *
 * There is NO unique constraint on it, in this schema or in the database, and
 * that is a decision rather than an omission.
 *
 * A per-table `@unique` is expressible — Postgres treats NULLs as distinct, so
 * the unpinned rows would not collide with each other — and it is still the
 * wrong constraint, because it would only hold WITHIN a table while the grid
 * draws from three sources: two `Post` categories and this model. Post 4 and
 * Component 4 would pass both tables' constraints and collide on the grid
 * anyway, so the index would buy an ordering guarantee it does not actually
 * make, which is worse than none. The real constraint spans the sources, and
 * expressing it means a join table holding the grid's positions plus a partial
 * unique index that Prisma cannot declare and `prisma db push` therefore does
 * not own — hand-written SQL, after which the schema stops describing the
 * database.
 *
 * What it would prevent is worth pricing too: two cards claiming index 3
 * render in an ambiguous order, and the next drag fixes it. That is cosmetic
 * and self-healing, the editing UI already prevents it, and a database-level
 * guard would convert it into a reorder that can fail mid-drag. The cheap
 * failure mode wins.
 *
 * Floored at zero because a pin is a POSITION and positions start at 0. A
 * negative index has no rendering meaning — the grid would have to clamp it,
 * which is the same as rejecting it, only later and somewhere less visible.
 */
export const GridIndexSchema = z.number().int().min(0);

/**
 * How many of the grid's columns a card occupies — its WIDTH, where
 * `gridIndex` is its position.
 *
 * Bounded above by `MAX_GRID_SPAN` rather than left open, because the CSS
 * already clamps a span to the number of columns on screen: a stored 4 renders
 * as 3 and then reads back as a width the grid never drew, which is the kind of
 * value that survives a discard and confuses the next edit. Rejecting it at the
 * door keeps what is in the column and what is on the page the same number.
 *
 * Floored at one for the same reason `gridIndex` is floored at zero: a card
 * occupies the cell it is in. Zero is not a narrower card, it is no card.
 *
 * Nullable wherever it is stored, and null means one. That is the same
 * absent-means-default convention `aspect` and `logger` use, and it matters for
 * the same reason: every row that existed before cards could be widened has no
 * opinion about its width, and defaulting the column to 1 in the database would
 * record an opinion on all of their behalf.
 */
export const GridSpanSchema = z.number().int().min(1).max(MAX_GRID_SPAN);

export const ComponentSchema = z.object({
  id: z.string(),

  /**
   * The registry key this row publishes — and NOT unique, deliberately.
   *
   * A uniqueness constraint here would read as the obvious safety rail and is
   * exactly the wrong one, because "which demo" is not the identity of a
   * publication. The same demo is legitimately published more than once: a
   * decorative component that belongs in two places on the grid, or one demo
   * shown twice at different aspects because the wide slot and the tall slot
   * want different shapes of it. Under a unique constraint the second of those
   * is not a slower path, it is impossible — the author's only recourse is a
   * duplicate registry entry, which puts the copy in the article insert overlay
   * too, where nobody asked for it.
   *
   * The row's identity is its `id`. `componentId` is a FOREIGN key in spirit
   * (there is no table to point at — the registry is code), so it is as
   * repeatable as any other foreign key.
   */
  componentId: z.string().min(1),

  /**
   * Overrides, not duplicates — which is why both are nullable.
   *
   * Absent means "whatever the registry entry says", the same absent-means-
   * default convention `padding` and `borderRadius` use on a media node in
   * `src/domain/nodes.ts`. It is not the same as storing the registry's value:
   * a row that copied
   * `aspectRatio: "3/2"` out of the registry at publish time would go stale and
   * silently WIN the next time that entry's shape was corrected, so the fix
   * would land in the code and never reach the grid. Null is the honest record
   * of "this publication has no opinion", and a publication with no opinion
   * must keep tracking the entry it publishes.
   *
   * `.nullable().optional()` rather than `.optional()` because Prisma returns
   * `null` for an unset nullable column and a bare `.optional()` rejects it.
   */
  aspect: ComponentAspectSchema.nullable().optional(),

  /**
   * The other override, on the same terms as `aspect` above.
   *
   * A flag and not the registry's richer `DemoLoggerConfig`, because the column
   * is `Boolean?` and the thing a publication decides is whether the log panel
   * is THERE. Its contents — the empty hint, the seeded lines — describe the
   * demo rather than this showing of it, so they stay with the registry entry
   * where one edit fixes them everywhere the demo appears.
   */
  logger: z.boolean().nullable().optional(),

  gridIndex: GridIndexSchema.nullable().optional(),

  /** The card's width in columns — see `GridSpanSchema`. Null means one. */
  gridSpan: GridSpanSchema.nullable().optional(),

  publishedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Component = z.infer<typeof ComponentSchema>;

// Derived from `ComponentSchema` rather than written out, exactly as the Post
// pair is (`post.ts`) — a field added above must reach both inputs in the same
// edit, and a hand-written create shape is precisely the copy that forgets to.
//
// Note what the create input therefore requires: `componentId`, and nothing
// else. Publishing IS the act of writing the row, so every other column is a
// refinement of a publication that already makes sense without it — an
// unpinned, un-overridden, undated row is a legitimate draft of a card.

/** Input for creating a publication — omits the server-generated fields. */
export const CreateComponentInputSchema = ComponentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateComponentInput = z.infer<typeof CreateComponentInputSchema>;

/** Input for editing a publication — everything optional except the id. */
export const UpdateComponentInputSchema = ComponentSchema.partial().required({
  id: true,
});

export type UpdateComponentInput = z.infer<typeof UpdateComponentInputSchema>;
