import { describe, expect, it } from "vitest";
import { DocumentSchema } from "@/domain/post";
import { DEFAULT_HOME_DOCUMENT } from "../home-document";

describe("DEFAULT_HOME_DOCUMENT", () => {
  it("is a document the editor can open", () => {
    expect(DocumentSchema.safeParse(DEFAULT_HOME_DOCUMENT).success).toBe(true);
  });

  // The intro, its way on to the About page, the icon row, then the grid —
  // the order the homepage has always been read in.
  it("offers the About page from the intro, above the icon row", () => {
    expect(DEFAULT_HOME_DOCUMENT.content.map((block) => block.type)).toEqual([
      "paragraph",
      "button_link",
      "social_links",
      "project_grid",
    ]);
    expect(DEFAULT_HOME_DOCUMENT.content[1]).toEqual({
      type: "button_link",
      text: "About me",
      href: "/about",
    });
  });
});
