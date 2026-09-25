import { CRITERIA } from "./harness-data";

export const JOB_TITLE = "Account Executive";

const custom = CRITERIA.find((criterion) => criterion.id === "new-logo");
if (!custom)
  throw new Error("The fixture has lost its custom criterion, `new-logo`.");

/** The criterion the recruiter adds with "Add custom". */
export const CUSTOM_CRITERION = custom;

export const STARTING_CRITERIA = CRITERIA.filter(
  (criterion) => criterion.id !== CUSTOM_CRITERION.id,
);
