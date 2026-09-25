import { describe, expect, it } from "vitest";
import {
  DEFAULT_BACKGROUND_EFFECT,
  type BlockNode,
  type MediaNode,
} from "@/domain/nodes";
import type { Document } from "@/domain/post";
import { postCover } from "../post-cover";

const picture = (src: string): MediaNode => ({
  type: "media",
  kind: "image",
  src,
});

const clip = (src: string): MediaNode => ({
  type: "media",
  kind: "video",
  src,
});

const collection = (...items: MediaNode[]): BlockNode => ({
  type: "collection",
  items,
});

const words = (text: string): BlockNode => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const doc = (...content: BlockNode[]): Document => ({ type: "doc", content });

describe("postCover", () => {
  it("has nothing to show for a document with no media in it", () => {
    expect(postCover(doc(words("Just prose.")))).toBeNull();
    expect(postCover(doc())).toBeNull();
  });

  it("takes a standalone media block", () => {
    expect(postCover(doc(words("Lead in"), picture("/one.png")))).toEqual(
      picture("/one.png"),
    );
  });

  it("takes a collection's FEATURED item — the one in slot 0", () => {
    const cover = postCover(
      doc(collection(picture("/featured.png"), picture("/second.png"))),
    );
    expect(cover).toEqual(picture("/featured.png"));
  });

  it("takes whichever comes FIRST in the document, block or collection", () => {
    const blockFirst = doc(
      picture("/standalone.png"),
      collection(picture("/featured.png")),
    );
    expect(postCover(blockFirst)).toEqual(picture("/standalone.png"));

    const collectionFirst = doc(
      collection(picture("/featured.png")),
      picture("/standalone.png"),
    );
    expect(postCover(collectionFirst)).toEqual(picture("/featured.png"));
  });

  it("walks PAST a collection holding nothing", () => {
    const cover = postCover(doc(collection(), picture("/later.png")));
    expect(cover).toEqual(picture("/later.png"));
  });

  it("carries the kind, so a clip is not shown as a broken picture", () => {
    expect(postCover(doc(clip("/demo.mp4")))?.kind).toBe("video");
    expect(postCover(doc(collection(clip("/reel.mp4"))))?.kind).toBe("video");
  });

  it("carries the GROUND and the way the picture sits in it", () => {
    const composed = {
      type: "media",
      kind: "image",
      src: "/inset.png",
      alt: "An inset picture",
      caption: "Fig. 1",
      objectFit: "contain",
      padding: 24,
      borderRadius: 8,
      backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
    } as const;

    expect(postCover(doc(composed))).toEqual(composed);
  });
});
