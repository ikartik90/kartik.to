import { describe, expect, it } from "vitest";

import {
  LINK_CARD_COMPONENT_ID,
  LinkCardConfigSchema,
  LinkCardLinkSchema,
  linkCardHref,
  linkCardTitle,
} from "../link-card";
import { SITE_PATHS } from "@/data/site-paths";

const image = {
  type: "media" as const,
  kind: "image" as const,
  src: "https://cdn.example.com/a.png",
};

describe("LinkCardLinkSchema", () => {
  // The three destinations are told apart by the DOCUMENT rather than by
  // guessing at the href, because two of them are indistinguishable as strings:
  // a PDF in the bucket and a third-party page are both absolute URLs, and only
  // the author knows which one they meant.
  it("takes a site path for an internal link", () => {
    expect(
      LinkCardLinkSchema.parse({ kind: "internal", href: SITE_PATHS[0].path }),
    ).toEqual({ kind: "internal", href: SITE_PATHS[0].path });
  });

  // You choose what SORT of link you want, then go and find it. The section has
  // to be able to hold the first of those before the second has happened.
  it("takes a kind with no destination chosen yet", () => {
    expect(LinkCardLinkSchema.safeParse({ kind: "external" }).success).toBe(
      true,
    );
  });

  // Membership in `SITE_PATHS` is the picker's business, not the schema's: the
  // site's routes move, and a stored path checked against today's list would
  // stop parsing — taking the card's picture down with its link, since the
  // whole configuration is one blob.
  it("keeps a path the picker no longer offers", () => {
    expect(
      LinkCardLinkSchema.safeParse({ kind: "internal", href: "/retired" })
        .success,
    ).toBe(true);
  });

  // The SHAPE is still worth refusing. "example.com" stored as an internal path
  // renders as a relative link into this site — a different page from the one
  // whoever typed it meant.
  it("refuses an internal link that is not a path", () => {
    expect(
      LinkCardLinkSchema.safeParse({ kind: "internal", href: "example.com" })
        .success,
    ).toBe(false);
  });

  it("takes an absolute URL for an external link", () => {
    expect(
      LinkCardLinkSchema.safeParse({
        kind: "external",
        href: "https://example.com/thing",
      }).success,
    ).toBe(true);
  });

  // A bare word is the shape a half-typed URL has, and it would render as a
  // relative path — an "external" link that navigates inside the site.
  it("refuses an external link that is not a URL", () => {
    expect(
      LinkCardLinkSchema.safeParse({ kind: "external", href: "example.com" })
        .success,
    ).toBe(false);
  });

  it("takes the uploaded file's URL for a document link", () => {
    expect(
      LinkCardLinkSchema.safeParse({
        kind: "document",
        href: "https://cdn.example.com/media/uuid-cv.pdf",
      }).success,
    ).toBe(true);
  });

  // Articles and projects are already cards on this grid. A link card pointing
  // at one would be the same destination twice over, which is the reason the
  // picker's list excludes them in the first place.
  it("offers no article or project path", () => {
    expect(
      SITE_PATHS.filter(
        ({ path }) => path.startsWith("/writing") || path.startsWith("/work"),
      ),
    ).toEqual([]);
  });
});

describe("LinkCardConfigSchema", () => {
  // Every section is a property the card MAY carry, so a publication that has
  // been placed but not yet filled in is a legitimate record rather than an
  // invalid one — the same absent-means-default rule the rest of the row uses.
  it("accepts a card with nothing configured", () => {
    expect(LinkCardConfigSchema.parse({})).toEqual({});
  });

  it("carries a picture per theme", () => {
    const parsed = LinkCardConfigSchema.parse({
      media: { light: image, dark: { ...image, src: "b.png" } },
    });
    expect(parsed.media?.light?.src).toBe(image.src);
    expect(parsed.media?.dark?.src).toBe("b.png");
  });

  // One of the two is enough: a card given only a light picture shows it in
  // both themes rather than going blank in one of them.
  it("takes one theme's picture on its own", () => {
    expect(LinkCardConfigSchema.parse({ media: { light: image } })).toEqual({
      media: { light: image },
    });
  });

  it("carries the words and the ground they stand on", () => {
    const parsed = LinkCardConfigSchema.parse({
      content: { title: "Shader Playground", meta: "Playground", scrim: true, tone: "dark" },
    });
    expect(parsed.content).toEqual({
      title: "Shader Playground",
      meta: "Playground",
      scrim: true,
      tone: "dark",
    });
  });

  it("refuses a tone that is neither light nor dark", () => {
    expect(
      LinkCardConfigSchema.safeParse({ content: { tone: "system" } }).success,
    ).toBe(false);
  });

  it("carries the destination and whether it opens away from here", () => {
    const parsed = LinkCardConfigSchema.parse({
      link: { kind: "external", href: "https://example.com", newTab: true },
    });
    expect(parsed.link?.newTab).toBe(true);
  });
});

describe("linkCardHref", () => {
  it("reads the destination off whichever kind was chosen", () => {
    expect(
      linkCardHref({ link: { kind: "external", href: "https://example.com" } }),
    ).toBe("https://example.com");
  });

  // A card with no link yet still renders — it is being built. It must not
  // render as a link to the page it is already on, which is what an empty
  // `href` on an anchor means.
  it("has no href until a destination is chosen", () => {
    expect(linkCardHref({})).toBeUndefined();
  });
});

describe("linkCardTitle", () => {
  it("is the title the author wrote", () => {
    expect(linkCardTitle({ content: { title: "Shader" } })).toBe("Shader");
  });

  // The card can be a picture with no words on it, and then the LINK still has
  // to be named for anyone not looking at it — an anchor whose only content is
  // a decorative image has no accessible name at all.
  it("falls back to the destination for a card with no words", () => {
    expect(
      linkCardTitle({ link: { kind: "internal", href: SITE_PATHS[0].path } }),
    ).toBe(SITE_PATHS[0].label);
  });
});

describe("LINK_CARD_COMPONENT_ID", () => {
  // The registry key this configuration belongs to. Written down once, because
  // the grid, the panel and the insert dialog all have to agree on which
  // published component reads a `props` blob.
  it("names the entry the configuration belongs to", () => {
    expect(LINK_CARD_COMPONENT_ID).toBe("link-card");
  });
});
