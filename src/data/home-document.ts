import type { Document } from "@/domain/post";

// The homepage's default content, until a `PAGE` post with slug `home` overrides it. The intro is `HomeHero`, above it.

export const DEFAULT_HOME_DOCUMENT: Document = {
  type: "doc",
  content: [{ type: "project_grid" }],
};
