"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import {
  ComponentAspectSchema,
  GridIndexSchema,
  GridSpanSchema,
} from "@/domain/component";
import { LinkCardConfigSchema } from "@/domain/link-card";

// ---------------------------------------------------------------------------
// Mutations for the homepage grid — pinning, reordering, and publishing or
// retiring a standalone component.
//
// One module for both kinds of card because both write the SAME field. A post
// and a component are different records with different lifecycles, but a seat
// in the grid is one idea, and splitting these by table would mean two copies
// of the clamp, the guard and the revalidate that differ only in which
// delegate they call.
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.email || session.user.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
}

const TargetSchema = z.object({
  kind: z.enum(["post", "component"]),
  id: z.string().min(1),
});

export type GridTarget = z.infer<typeof TargetSchema>;

/** Read the seat a card currently holds, or null if it flows with chronology. */
async function readGridIndex(target: GridTarget): Promise<number | null> {
  if (target.kind === "post") {
    const row = await prisma.post.findUnique({
      where: { id: target.id },
      select: { gridIndex: true },
    });
    return row?.gridIndex ?? null;
  }
  const row = await prisma.component.findUnique({
    where: { id: target.id },
    select: { gridIndex: true },
  });
  return row?.gridIndex ?? null;
}

async function writeGridIndex(
  target: GridTarget,
  gridIndex: number | null,
): Promise<void> {
  if (target.kind === "post") {
    await prisma.post.update({ where: { id: target.id }, data: { gridIndex } });
  } else {
    await prisma.component.update({
      where: { id: target.id },
      data: { gridIndex },
    });
  }
}

/**
 * Pin a card to the seat it is currently sitting in, or release it back to
 * chronology.
 *
 * The index comes from the CALLER because only the rendered grid knows where a
 * card currently is — the seat is its position in the ordered feed, which is a
 * function of every other card's pin and date, not something a single row can
 * answer about itself. Re-deriving it here would mean rebuilding the whole
 * ordering server-side to answer a question the client already had.
 */
export async function setPinned(
  target: GridTarget,
  index: number | null,
): Promise<void> {
  await requireAdmin();
  const t = TargetSchema.parse(target);
  const seat = index === null ? null : GridIndexSchema.parse(index);
  await writeGridIndex(t, seat);
  revalidatePath("/");
}

/**
 * Shift a pinned card one seat in either direction.
 *
 * Floors at zero rather than erroring: the UI disables the control at the ends,
 * and a request that arrives anyway is a stale render rather than a fault worth
 * failing on. Unpinned cards are rejected — a card with no seat has nothing to
 * shift, and silently pinning it here would make a nudge do two things.
 */
export async function moveGridItem(
  target: GridTarget,
  direction: "back" | "forward",
): Promise<void> {
  await requireAdmin();
  const t = TargetSchema.parse(target);
  const current = await readGridIndex(t);
  if (current === null) throw new Error("Cannot move a card that is not pinned");
  const next = Math.max(0, current + (direction === "back" ? -1 : 1));
  await writeGridIndex(t, next);
  revalidatePath("/");
}

const PublishComponentSchema = z.object({
  componentId: z.string().min(1),
  aspect: ComponentAspectSchema.nullable().optional(),
  logger: z.boolean().nullable().optional(),
  gridIndex: GridIndexSchema.nullable().optional(),
});

/**
 * Put a registered demo on the homepage.
 *
 * Nothing in the registry is on the grid by being registered — a demo exists to
 * be embedded in articles, and appearing as a project of its own is a separate
 * decision taken here. `componentId` is deliberately not unique in the schema,
 * so the same demo can be published more than once in different configurations.
 *
 * `aspect` and `logger` stay null unless overridden, so the registry keeps
 * answering for them and a later correction there reaches every showing.
 */
export async function publishComponent(
  input: z.input<typeof PublishComponentSchema>,
): Promise<string> {
  await requireAdmin();
  const data = PublishComponentSchema.parse(input);
  const created = await prisma.component.create({
    data: {
      componentId: data.componentId,
      aspect: data.aspect ?? null,
      logger: data.logger ?? null,
      gridIndex: data.gridIndex ?? null,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  revalidatePath("/");
  return created.id;
}

/**
 * Take a component off the grid.
 *
 * A real delete, not a `publishedAt: null`: this row IS the publication. The
 * demo itself lives in the registry and is untouched, so nothing is lost that
 * publishing it again would not restore — which is what makes the confirm
 * dialog a courtesy rather than a last line of defence.
 */
export async function unpublishComponent(id: string): Promise<void> {
  await requireAdmin();
  await prisma.component.delete({ where: { id: z.string().min(1).parse(id) } });
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Committing a layout
// ---------------------------------------------------------------------------

const InsertSchema = z.object({
  key: z.string().min(1),
  componentId: z.string().min(1),
  index: GridIndexSchema,
  aspect: ComponentAspectSchema.nullable().optional(),
  logger: z.boolean().nullable().optional(),
});

const GridDraftSchema = z.object({
  pins: z.record(z.string(), GridIndexSchema.nullable()),
  spans: z.record(z.string(), GridSpanSchema),
  aspects: z.record(z.string(), ComponentAspectSchema),
  loggers: z.record(z.string(), z.boolean()),
  // Validated HERE, at the door, and not merely on the way out of the database.
  // It is the one field on this table whose contents are typed by the author
  // rather than chosen from a control — a URL, a path, some words — so it is
  // the one that can arrive malformed from a client that has been tampered
  // with. `LinkCardConfigSchema` is the same schema the card is read back
  // through, so what is stored is exactly what renders.
  props: z.record(z.string(), LinkCardConfigSchema),
  inserts: z.array(InsertSchema),
  removals: z.array(z.string().min(1)),
});

export type GridDraftInput = z.infer<typeof GridDraftSchema>;

type LinkCardConfig = z.infer<typeof LinkCardConfigSchema>;

/**
 * `post:abc` / `component:abc` → the row it names.
 *
 * Null for a `pending:` key, whose card is created by the `inserts` list rather
 * than updated. It is filtered here, before any write is built, so nothing is
 * attempted against it at all — a write aimed at a missing row is not merely
 * wasted, it throws P2025 and takes the whole transaction with it, which would
 * roll back a component the same session had just published.
 *
 * Static posts used to be the other such case, and needed a set of their ids
 * read out of `src/data` to be recognised. They no longer reach the grid at
 * all (see `getGridCards`), so every `post:` key now names a real row.
 */
function parseCardKey(key: string): GridTarget | null {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "post") return { kind: "post", id };
  if (kind === "component") return { kind: "component", id };
  return null;
}

/**
 * The columns one card's edits can touch.
 *
 * Two of them place the card on the grid and the third describes the card
 * itself — `aspect` overrides whatever default it would otherwise draw at (the
 * registry's shape for a component, `POST_ASPECT` for a post), and it does so
 * for THIS publication only, which is the whole reason `componentId` is not
 * unique. They travel together because they arrive together, from one rail in
 * one session, and land on one row.
 */
interface RowPatch {
  gridIndex?: number | null;
  gridSpan?: number;
  aspect?: string;
  /**
   * COMPONENTS only — a post has no log output and no column to keep this in.
   * The field is on the one patch type rather than in a second one because
   * every other column here is shared, and the constraint is not a shape: it is
   * a fact about which cards may be given the value, which is checked where the
   * value is set below.
   */
  logger?: boolean;
  /**
   * The configuration a link card carries — components only, for the reason
   * `logger` is, and checked at the same place.
   *
   * Typed as the domain object rather than as Prisma's `JsonValue`: it has been
   * through `LinkCardConfigSchema` by the time it lands here, and the cast to
   * the column's type happens once at the write.
   */
  props?: LinkCardConfig;
}

/**
 * Apply a whole edited layout at once.
 *
 * One transaction, because a layout is one thing: a run that created two
 * components, moved three cards and then failed on the fourth would leave the
 * grid in an arrangement nobody chose and no discard could undo.
 *
 * Pending keys are skipped by `parseCardKey` returning null — see there for why
 * they have no row to write to. A pending card is not lost by that: the
 * `inserts` list is where it is dealt with.
 */
export async function saveGridLayout(draft: GridDraftInput): Promise<void> {
  await requireAdmin();
  const { pins, spans, aspects, loggers, props, inserts, removals } =
    GridDraftSchema.parse(draft);

  await prisma.$transaction(async (tx) => {
    for (const key of removals) {
      const target = parseCardKey(key);
      // Only a component is retired from the grid; a post's card is removed by
      // unpublishing the post, which is its own action on its own page.
      if (target?.kind === "component") {
        await tx.component.delete({ where: { id: target.id } });
      }
    }

    // Seat and width are gathered per ROW before anything is written, because
    // they are two columns of the same record: a card that was moved and
    // widened in one session must go out as one update. Two would be two round
    // trips, and — since they are issued in sequence over the same row — two
    // chances for the later one to overwrite what the earlier one set.
    //
    // Keyed by the card key rather than the row id, so a post and a component
    // that happen to share an id cannot collide in the map.
    const patches = new Map<string, { target: GridTarget; data: RowPatch }>();
    const patchFor = (key: string): RowPatch | null => {
      const existing = patches.get(key);
      if (existing) return existing.data;
      // Null for a `pending:` key — a card with no row yet. Its edits are not
      // lost: they are folded into the `create` below.
      const target = parseCardKey(key);
      if (!target) return null;
      const entry = { target, data: {} as RowPatch };
      patches.set(key, entry);
      return entry.data;
    };

    for (const [key, index] of Object.entries(pins)) {
      const data = patchFor(key);
      // Assigned rather than merged with `??`: releasing a pin writes null, and
      // a nullish merge is exactly what would drop it on the floor.
      if (data) data.gridIndex = index;
    }
    for (const [key, span] of Object.entries(spans)) {
      const data = patchFor(key);
      if (data) data.gridSpan = span;
    }
    for (const [key, aspect] of Object.entries(aspects)) {
      const data = patchFor(key);
      if (data) data.aspect = aspect;
    }
    for (const [key, logger] of Object.entries(loggers)) {
      // A post is turned away HERE rather than by the schema, and before
      // `patchFor` is asked for anything: a patch opened for a post would be
      // sent as an update either way, and one carrying `logger` is a column
      // that table does not have — P2025's louder cousin, and it would roll
      // back everything else in the transaction with it.
      if (parseCardKey(key)?.kind !== "component") continue;
      const data = patchFor(key);
      // Assigned rather than merged, for the same reason a released pin is:
      // `false` is a real value — a log panel deliberately hidden on a demo
      // the registry logs by default.
      if (data) data.logger = logger;
    }

    for (const [key, config] of Object.entries(props)) {
      // A post is turned away here for the reason it is turned away from
      // `loggers`, and with more at stake: `props` is a column `Post` does not
      // have, so an update carrying one throws and rolls the whole layout back.
      if (parseCardKey(key)?.kind !== "component") continue;
      const data = patchFor(key);
      // Assigned rather than merged. The rail hands back the whole
      // configuration, so an emptied section arrives as an absent key and must
      // land as one — see `GridDraft.props`.
      if (data) data.props = config;
    }

    for (const { target, data } of patches.values()) {
      if (target.kind === "post") {
        await tx.post.update({ where: { id: target.id }, data });
      } else {
        await tx.component.update({ where: { id: target.id }, data });
      }
    }

    for (const insert of inserts) {
      await tx.component.create({
        data: {
          componentId: insert.componentId,
          // The picker wins over the shape the `[+]` opened with, which is the
          // registry's default for the demo. Null only if neither said
          // anything, so the publication keeps tracking the registry.
          aspect: aspects[insert.key] ?? insert.aspect ?? null,
          // The panel wins over the flag the `[+]` published with, which is
          // the registry's default for the demo — the same rule the shape
          // above follows. Null only if neither said anything, so the
          // publication keeps tracking the registry.
          logger: loggers[insert.key] ?? insert.logger ?? null,
          // A link card is placed and then filled in, so a card configured
          // before it was ever saved has to carry that configuration into the
          // row the save creates. Null where nothing was configured — a plain
          // demo has nothing to put here at all.
          props: props[insert.key] ?? null,
          // A pin made against the card before it was saved still counts —
          // it was placed by hand and the seat it was dragged to is the one
          // it should get, not the one the `[+]` originally opened.
          gridIndex: pins[insert.key] ?? insert.index,
          // Same for a width set before the row existed. One column unless the
          // card was actually widened, which is what the column's null means
          // everywhere else.
          gridSpan: spans[insert.key] ?? 1,
          publishedAt: new Date(),
        },
      });
    }
  });

  revalidatePath("/");
}
