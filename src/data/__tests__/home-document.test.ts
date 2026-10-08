import { describe, expect, it } from "vitest";
import { DocumentSchema } from "@/domain/post";
import { DEFAULT_HOME_DOCUMENT } from "../home-document";

describe("DEFAULT_HOME_DOCUMENT", () => {
  it("is a document the editor can open", () => {
    expect(DocumentSchema.safeParse(DEFAULT_HOME_DOCUMENT).success).toBe(true);
  });

  // The intro is the hero, drawn above the document.
  it("holds only the project grid", () => {
    expect(DEFAULT_HOME_DOCUMENT.content).toEqual([{ type: "project_grid" }]);
  });
});
