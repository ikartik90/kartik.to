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
  it("takes a site path for an internal link", () => {
    expect(
      LinkCardLinkSchema.parse({ kind: "internal", href: SITE_PATHS[0].path }),
    ).toEqual({ kind: "internal", href: SITE_PATHS[0].path });
  });

  it("takes a kind with no destination chosen yet", () => {
    expect(LinkCardLinkSchema.safeParse({ kind: "external" }).success).toBe(
      true,
    );
  });

  it("keeps a path the picker no longer offers", () => {
    expect(
      LinkCardLinkSchema.safeParse({ kind: "internal", href: "/retired" })
        .success,
    ).toBe(true);
  });

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

  it("offers no article or project path", () => {
    expect(
      SITE_PATHS.filter(
        ({ path }) => path.startsWith("/writing") || path.startsWith("/work"),
      ),
    ).toEqual([]);
  });
});

describe("LinkCardConfigSchema", () => {
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

  it("has no href until a destination is chosen", () => {
    expect(linkCardHref({})).toBeUndefined();
  });
});

describe("linkCardTitle", () => {
  it("is the title the author wrote", () => {
    expect(linkCardTitle({ content: { title: "Shader" } })).toBe("Shader");
  });

  it("falls back to the destination for a card with no words", () => {
    expect(
      linkCardTitle({ link: { kind: "internal", href: "/playground/shader" } }),
    ).toBe("Waveform Studio");
  });
});

describe("LINK_CARD_COMPONENT_ID", () => {
  it("names the entry the configuration belongs to", () => {
    expect(LINK_CARD_COMPONENT_ID).toBe("link-card");
  });
});
