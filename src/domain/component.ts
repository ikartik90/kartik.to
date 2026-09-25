import { z } from "zod";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";
import { MAX_GRID_SPAN } from "@/utils/listing-columns";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

/** Derived from `ASPECT_RATIOS`, the only place a demo-frame ratio is written. */
export const ComponentAspectSchema = z.enum(
  Object.keys(ASPECT_RATIOS) as [DemoFrameAspectRatio, ...DemoFrameAspectRatio[]],
);

export type ComponentAspect = z.infer<typeof ComponentAspectSchema>;

/**
 * Pinned grid position; null means ordered by `publishedAt`. Deliberately not
 * unique: the grid spans `Post` and `Component` rows, so a per-table index can't hold.
 */
export const GridIndexSchema = z.number().int().min(0);

/** Card width in grid columns; null (where stored) means one. */
export const GridSpanSchema = z.number().int().min(1).max(MAX_GRID_SPAN);

export const ComponentSchema = z.object({
  id: z.string(),

  /** Deliberately not unique: one demo may be published more than once. */
  componentId: z.string().min(1),

  /** Registry override; null tracks the registry entry, so never copy its value in. */
  aspect: ComponentAspectSchema.nullable().optional(),

  /** Registry override, same terms as `aspect`. */
  logger: z.boolean().nullable().optional(),

  gridIndex: GridIndexSchema.nullable().optional(),

  gridSpan: GridSpanSchema.nullable().optional(),

  publishedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Component = z.infer<typeof ComponentSchema>;

export const CreateComponentInputSchema = ComponentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateComponentInput = z.infer<typeof CreateComponentInputSchema>;

export const UpdateComponentInputSchema = ComponentSchema.partial().required({
  id: true,
});

export type UpdateComponentInput = z.infer<typeof UpdateComponentInputSchema>;
