import { CUSTOM_CRITERION, STARTING_CRITERIA } from "./job";

/** One criterion as the edit drawer holds it: what the recruiter can rewrite. */
export interface DraftCriterion {
  id: string;
  title: string;
  prompt: string;
}

/** The criteria as they are running, to be edited. */
export function startingDraft(): DraftCriterion[] {
  return STARTING_CRITERIA.map(({ id, title, prompt }) => ({
    id,
    title,
    prompt,
  }));
}

/**
 * The draft with the custom criterion added at the top, where the source puts
 * a new one — BLANK, because it is typed in. Unchanged if it is already there.
 */
export function withCustomCriterion(draft: DraftCriterion[]): DraftCriterion[] {
  if (draft.some((row) => row.id === CUSTOM_CRITERION.id)) return draft;
  return [{ id: CUSTOM_CRITERION.id, title: "", prompt: "" }, ...draft];
}

/**
 * Whether the draft differs from the criteria last tested — until a retest,
 * the ones running.
 */
export function hasChanged(
  draft: DraftCriterion[],
  tested: DraftCriterion[] = startingDraft(),
): boolean {
  if (draft.length !== tested.length) return true;
  return draft.some((row, i) => {
    const was = tested[i];
    return (
      row.id !== was.id || row.title !== was.title || row.prompt !== was.prompt
    );
  });
}
