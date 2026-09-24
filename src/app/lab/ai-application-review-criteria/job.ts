import { CRITERIA } from "./harness-data";

/** The job the whole prototype is set in. */
export const JOB_TITLE = "Account Executive";

const custom = CRITERIA.find((criterion) => criterion.id === "new-logo");
if (!custom)
  throw new Error("The fixture has lost its custom criterion, `new-logo`.");

/**
 * The criterion the recruiter adds with "Add custom" (Figma 55:620), and the
 * one the rest of the prototype puts to the test: it asks for experience
 * without naming any evidence of it.
 */
export const CUSTOM_CRITERION = custom;

/**
 * The criteria already running when the recruiter arrives (Figma 94:4840 and
 * the edit drawer, 94:5023) — every one but the custom one.
 */
export const STARTING_CRITERIA = CRITERIA.filter(
  (criterion) => criterion.id !== CUSTOM_CRITERION.id,
);
