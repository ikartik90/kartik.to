import { describe, expect, it } from "vitest";
import type { BlockNode, MediaNode } from "@/domain/nodes";
import type { Post } from "@/domain/post";
import { ogCard, ogCoverSrc } from "../og-card";

const picture: MediaNode = { type: "media", kind: "image", src: "/a.png" };
const darkPicture: MediaNode = { type: "media", kind: "image", src: "/a-dark.png" };
const clip: MediaNode = {
  type: "media",
  kind: "video",
  src: "/a.mp4",
  poster: "https://cdn/posters/a.jpg",
};

const post = (patch: Partial<Post> = {}): Post =>
  ({
    id: "1",
    title: "Redesigning Shift Scheduling",
    slug: "scheduling-extensions",
    category: "WORK",
    content: { type: "doc", content: [] as BlockNode[] },
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...patch,
  }) as Post;

describe("ogCard", () => {
  it("is the post's own title", () => {
    expect(ogCard(post()).title).toBe("Redesigning Shift Scheduling");
  });

  it("names a post that has never been called anything", () => {
    expect(ogCard(post({ title: null })).title).toBe("Untitled");
  });

  it("files an article by its date and a project by what its card says", () => {
    expect(
      ogCard(
        post({
          category: "ARTICLE",
          publishedAt: new Date("2026-09-10T12:00:00Z"),
          card: { meta: "Ignored" },
        }),
      ).meta,
    ).toBe("Sep 10, 2026");

    expect(ogCard(post({ card: { meta: "2025 • Case Study" } })).meta).toBe(
      "2025 • Case Study",
    );
    expect(ogCard(post()).meta).toBeNull();
  });

  it("takes the picture the card takes — the document's, or the authored one", () => {
    const fromDocument = ogCard(
      post({ content: { type: "doc", content: [picture] } }),
    );
    expect(fromDocument.cover?.src).toBe("/a.png");

    const authored = ogCard(
      post({
        content: { type: "doc", content: [picture] },
        card: { media: { light: darkPicture } },
      }),
    );
    expect(authored.cover?.src).toBe("/a-dark.png");
  });

  it("shows the picture that matches the band it is drawn in", () => {
    const content = { type: "doc" as const, content: [] as BlockNode[] };
    const pinnedDark = ogCard(
      post({ content, card: { tone: "dark", media: { light: picture, dark: darkPicture } } }),
    );
    expect(pinnedDark.cover?.src).toBe("/a-dark.png");

    // And falls back to whichever one exists — one picture serves both bands.
    const onlyDark = ogCard(
      post({ content, card: { tone: "light", media: { dark: darkPicture } } }),
    );
    expect(onlyDark.cover?.src).toBe("/a-dark.png");
  });

  it("is drawn light unless the card was pinned dark", () => {
    // A shared link has no reader's theme to follow, so the card has to choose.
    expect(ogCard(post()).tone).toBe("light");
    expect(ogCard(post({ card: { tone: "dark" } })).tone).toBe("dark");
  });

  it("grounds the words wherever there is a picture, as the card does", () => {
    expect(ogCard(post()).scrim).toBe(false);
    expect(
      ogCard(post({ content: { type: "doc", content: [picture] } })).scrim,
    ).toBe(true);
    expect(
      ogCard(
        post({ content: { type: "doc", content: [picture] }, card: { scrim: false } }),
      ).scrim,
    ).toBe(false);
  });
});

describe("ogCoverSrc", () => {
  it("is the picture itself", () => {
    expect(ogCoverSrc(picture)).toBe("/a.png");
  });

  it("is a clip's still, because nothing here can play a clip", () => {
    expect(ogCoverSrc(clip)).toBe("https://cdn/posters/a.jpg");
  });

  it("is nothing for a clip with no still — the ground is drawn without it", () => {
    expect(ogCoverSrc({ type: "media", kind: "video", src: "/a.mp4" })).toBeNull();
    expect(ogCoverSrc(null)).toBeNull();
  });
});
