// The review copy of the homepage and its projects, served under `/dive` for Dive Club's reviewers.

export const REVIEW_BASE = "/dive";

/** `REVIEW_BASE` on the review copy's pages, else "". */
export const reviewBase = (pathname: string) =>
  pathname === REVIEW_BASE || pathname.startsWith(`${REVIEW_BASE}/`) ? REVIEW_BASE : "";
