"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import {
  ComponentAspectSchema,
  GridIndexSchema,
  GridSpanSchema,
} from "@/domain/component";
import { LinkCardConfigSchema } from "@/domain/link-card";
import { PostCardConfigSchema, type PostCardConfig } from "@/domain/post";

const TargetSchema = z.object({
  kind: z.enum(["post", "component"]),
  id: z.string().min(1),
});

export type GridTarget = z.infer<typeof TargetSchema>;

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

/** Pins a card at `index`, or returns it to chronological order when null. */
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

/** Deletes the row: it is the publication, while the demo lives in the registry. */
export async function unpublishComponent(id: string): Promise<void> {
  await requireAdmin();
  await prisma.component.delete({ where: { id: z.string().min(1).parse(id) } });
  revalidatePath("/");
}

const InsertSchema = z.object({
  key: z.string().min(1),
  componentId: z.string().min(1),
  index: GridIndexSchema.nullable(),
  aspect: ComponentAspectSchema.nullable().optional(),
  logger: z.boolean().nullable().optional(),
});

const GridDraftSchema = z.object({
  pins: z.record(z.string(), GridIndexSchema.nullable()),
  spans: z.record(z.string(), GridSpanSchema),
  aspects: z.record(z.string(), ComponentAspectSchema),
  loggers: z.record(z.string(), z.boolean()),
  props: z.record(z.string(), LinkCardConfigSchema),
  cards: z.record(z.string(), PostCardConfigSchema),
  inserts: z.array(InsertSchema),
  removals: z.array(z.string().min(1)),
});

export type GridDraftInput = z.infer<typeof GridDraftSchema>;

type LinkCardConfig = z.infer<typeof LinkCardConfigSchema>;

/** `post:id` / `component:id` → its row; null for `pending:` keys, which have no row to update. */
function parseCardKey(key: string): GridTarget | null {
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "post") return { kind: "post", id };
  if (kind === "component") return { kind: "component", id };
  return null;
}

interface RowPatch {
  gridIndex?: number | null;
  gridSpan?: number;
  aspect?: string;
  /** Components only. */
  logger?: boolean;
  /** Components only. */
  props?: LinkCardConfig;
  /** Posts only. */
  card?: PostCardConfig;
}

export async function saveGridLayout(draft: GridDraftInput): Promise<void> {
  await requireAdmin();
  const { pins, spans, aspects, loggers, props, cards, inserts, removals } =
    GridDraftSchema.parse(draft);

  await prisma.$transaction(async (tx) => {
    for (const key of removals) {
      const target = parseCardKey(key);
      if (target?.kind === "component") {
        await tx.component.delete({ where: { id: target.id } });
      }
    }

    // One update per row, keyed by card key so a post and a component sharing an id don't collide.
    const patches = new Map<string, { target: GridTarget; data: RowPatch }>();
    const patchFor = (key: string): RowPatch | null => {
      const existing = patches.get(key);
      if (existing) return existing.data;
      const target = parseCardKey(key);
      if (!target) return null;
      const entry = { target, data: {} as RowPatch };
      patches.set(key, entry);
      return entry.data;
    };

    for (const [key, index] of Object.entries(pins)) {
      const data = patchFor(key);
      // Assigned, not merged with `??`: null releases the pin.
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
      // Checked before `patchFor`: an update with a column the table lacks throws and rolls back everything.
      if (parseCardKey(key)?.kind !== "component") continue;
      const data = patchFor(key);
      if (data) data.logger = logger;
    }

    for (const [key, config] of Object.entries(props)) {
      if (parseCardKey(key)?.kind !== "component") continue;
      const data = patchFor(key);
      if (data) data.props = config;
    }

    for (const [key, card] of Object.entries(cards)) {
      if (parseCardKey(key)?.kind !== "post") continue;
      const data = patchFor(key);
      if (data) data.card = card;
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
          // Draft edits win over the insert's defaults; null tracks the registry.
          aspect: aspects[insert.key] ?? insert.aspect ?? null,
          logger: loggers[insert.key] ?? insert.logger ?? null,
          props: props[insert.key] ?? null,
          gridIndex: pins[insert.key] ?? insert.index,
          gridSpan: spans[insert.key] ?? 1,
          publishedAt: new Date(),
        },
      });
    }
  });

  revalidatePath("/");
}
