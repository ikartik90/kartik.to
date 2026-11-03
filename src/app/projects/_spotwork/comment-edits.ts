import { z } from "zod";
import { TOUR } from "./copy";
import type { StepId } from "./tour";

// Kartik's edits to the walk-through's comments, made on the page and copied back as values: what changed, what each
// comment said before, and where a moved or added pin points.

/** Where a pin points: a spot on an element as fractions of its box, so it follows the layout at any window size. */
export interface Spot {
  /** A selector from the app's root. */
  path: string;
  /** What's there, in words. */
  what: string;
  /** 0 to 1 across the element, and down it. */
  x: number;
  y: number;
  /** The window it was placed in. */
  viewport: { width: number; height: number };
}

export interface StepEdit {
  text?: string;
  deleted?: boolean;
  spot?: Spot;
}

/** A new comment, shown while the walk-through is at `step`. */
export interface AddedComment {
  id: string;
  step: StepId;
  text: string;
  spot: Spot;
}

export interface Edits {
  steps: Partial<Record<StepId, StepEdit>>;
  added: AddedComment[];
}

export const NO_EDITS: Edits = { steps: {}, added: [] };

const STEP_IDS = TOUR.steps.map((step) => step.id) as [StepId, ...StepId[]];

const spotSchema = z.object({
  path: z.string(),
  what: z.string(),
  x: z.number(),
  y: z.number(),
  viewport: z.object({ width: z.number(), height: z.number() }),
});

const valuesSchema = z.object({
  comments: z.array(
    z.object({
      step: z.enum(STEP_IDS),
      now: z.string().optional(),
      deleted: z.boolean().optional(),
      pointsAt: spotSchema.optional(),
    }),
  ),
  added: z.array(z.object({ id: z.string(), withStep: z.enum(STEP_IDS), text: z.string(), pointsAt: spotSchema })),
});

/** Only what changed: each changed step's comment with its number, title and old text, then the added comments. */
export function toValues(edits: Edits) {
  return {
    comments: TOUR.steps.flatMap((step, index) => {
      const edit = edits.steps[step.id];
      if (!edit || (edit.text === undefined && !edit.deleted && !edit.spot)) return [];
      return [
        {
          step: step.id,
          number: index + 1,
          title: step.title,
          ...(edit.deleted && { deleted: true }),
          ...(edit.text !== undefined && { was: step.body, now: edit.text }),
          ...(edit.spot && { pointsAt: edit.spot }),
        },
      ];
    }),
    added: edits.added.map(({ id, step, text, spot }) => ({ id, withStep: step, text, pointsAt: spot })),
  };
}

/** Pasted values back into edits, or null when they aren't copied comments. */
export function fromValues(values: unknown): Edits | null {
  const parsed = valuesSchema.safeParse(values);
  if (!parsed.success) return null;
  const steps: Edits["steps"] = {};
  for (const { step, now, deleted, pointsAt } of parsed.data.comments) {
    steps[step] = {
      ...(now !== undefined && { text: now }),
      ...(deleted && { deleted: true }),
      ...(pointsAt && { spot: pointsAt }),
    };
  }
  const added = parsed.data.added.map(({ id, withStep, text, pointsAt }) => ({ id, step: withStep, text, spot: pointsAt }));
  return { steps, added };
}

/** The step whose comment shows at `at`: the first from it that isn't deleted. */
export function shownStep(at: number, count: number, deleted: (index: number) => boolean) {
  for (let index = at; index < count; index++) if (!deleted(index)) return index;
  return null;
}

/** Where the tour goes once step `index` is done: on, when it's the current step or every step before it is deleted. */
export function advance(at: number, index: number, count: number, deleted: (index: number) => boolean) {
  if (index < at) return at;
  for (let skipped = at; skipped < index; skipped++) if (!deleted(skipped)) return at;
  return Math.min(index + 1, count - 1);
}
