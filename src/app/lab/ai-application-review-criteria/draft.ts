import { CUSTOM_CRITERION, STARTING_CRITERIA } from "./job";

export interface DraftCriterion {
  id: string;
  title: string;
  prompt: string;
}

export function startingDraft(): DraftCriterion[] {
  return STARTING_CRITERIA.map(({ id, title, prompt }) => ({
    id,
    title,
    prompt,
  }));
}

export function withCustomCriterion(draft: DraftCriterion[]): DraftCriterion[] {
  if (draft.some((row) => row.id === CUSTOM_CRITERION.id)) return draft;
  return [{ id: CUSTOM_CRITERION.id, title: "", prompt: "" }, ...draft];
}

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
