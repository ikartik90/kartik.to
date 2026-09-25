import { postCardMedia, type Post } from "@/domain/post";
import { POST_CATEGORIES } from "@/data/post-categories";
import { listingDate } from "@/utils/listing-date";
import { postCover } from "@/utils/post-cover";
import type { LinkCardTone } from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";

// The OG image has no theme (light unless pinned dark) and plays nothing (a clip shows its still).

const UNTITLED = "Untitled";

export interface OgCard {
  title: string;
  meta: string | null;
  tone: LinkCardTone;
  scrim: boolean;
  cover: MediaNode | null;
}

export function ogCard(post: Post): OgCard {
  const card = post.card ?? {};
  const { light, dark } = postCardMedia(card, postCover(post.content));
  const tone: LinkCardTone = card.tone ?? "light";

  const cover = (tone === "dark" ? (dark ?? light) : (light ?? dark)) ?? null;

  return {
    title: post.title ?? UNTITLED,
    // The post's own dated line wins over the authored one, as in `PostCard`.
    meta:
      (POST_CATEGORIES[post.category].dated && post.publishedAt
        ? listingDate(post.publishedAt)
        : card.meta) ?? null,
    tone,
    // `LinkCard`'s own default.
    scrim: card.scrim ?? Boolean(cover),
    cover,
  };
}

/** A clip's still, or null; a card with no picture may still draw its ground. */
export function ogCoverSrc(media: MediaNode | null): string | null {
  if (!media) return null;
  if (media.kind === "video") return media.poster ?? null;
  return media.src;
}
