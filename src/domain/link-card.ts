import { z } from "zod";
import { MediaNodeSchema } from "@/domain/nodes";
import { sitePathLabel } from "@/data/site-paths";

// ---------------------------------------------------------------------------
// The link card's CONFIGURATION — everything one publication of it carries.
//
// Every other entry in the demo registry is a specimen: the code is the whole
// artefact, and a publication of it only ever OVERRIDES a default the registry
// already stated (its shape, whether its log panel shows). This one is the
// opposite. `LinkCard` is a shell — a picture, some words and a destination —
// and two publications of it have nothing in common but the component that
// draws them. So the row carries the card, in `Component.props`, and this is
// the schema that validates the blob.
//
// Grouped by SECTION rather than flattened, because the sections are the
// properties: the rail adds and removes them, and an absent key is a section
// that was never added. That is the same shape `MediaPropertiesPanel` edits —
// see its header — and it means "has this card any words on it?" is one
// question about one key rather than three about three.
//
// Nothing here is required. A card that has been placed but not yet filled in
// is a real record — you place it, then you fill it — and a schema that
// insisted otherwise would make the first half of that impossible to save.
// ---------------------------------------------------------------------------

/** The registry key a configured link card publishes. */
export const LINK_CARD_COMPONENT_ID = "link-card";

/**
 * A path on this site — the SHAPE of one, not membership of a list.
 *
 * The PICKER is what holds an internal link to somewhere worth linking:
 * `SITE_PATHS`, which excludes the articles and projects that already have
 * cards of their own. This schema deliberately does not, and the split is a
 * decision rather than laxity. Which routes exist is a fact about the code and
 * it moves; a stored path validated against today's list would stop parsing the
 * day a playground is renamed — and because the whole configuration is one blob,
 * it would take the card's PICTURE down with its link. A card whose destination
 * has gone should lose its destination and nothing else.
 *
 * What is still worth refusing is a value of the wrong shape. `example.com`
 * stored as an internal path renders as a relative link INTO this site, which
 * is a different page from the one whoever typed it meant.
 */
export const InternalPathSchema = z.string().startsWith("/");

/** Which sort of place the card goes — see {@link LinkCardLinkSchema}. */
export const LinkTargetKindSchema = z.enum([
  "internal",
  "external",
  "document",
]);

export type LinkTargetKind = z.infer<typeof LinkTargetKindSchema>;

/** The tone the caption is drawn in, and the ground it stands on. */
export const LinkCardToneSchema = z.enum(["light", "dark"]);

export type LinkCardTone = z.infer<typeof LinkCardToneSchema>;

/**
 * The picture, per theme.
 *
 * TWO fields rather than one, because a screenshot of a dark UI on a light page
 * is the whole problem this solves — the card is a window onto something that
 * itself has two appearances, and one file cannot be both.
 *
 * `dark` is optional on its own terms: a photograph or an illustration that
 * reads in either theme wants one file, and duplicating it would be two
 * requests for one picture. Absent means "use the light one", which is what
 * every card that existed before this did.
 *
 * Whole media NODES, not srcs, so the card's picture carries the same fit,
 * inset, corner and ground every other picture in this codebase does — see
 * `LinkCardProps.cover`, which has always taken the object rather than the file.
 */
export const LinkCardMediaSchema = z.object({
  light: MediaNodeSchema.optional(),
  dark: MediaNodeSchema.optional(),
});

/**
 * The words on the card, and the ground they stand on.
 *
 * `scrim` is a value rather than the presence of a key, because a card can
 * legitimately want words with NO scrim — over a picture that is already flat
 * and dark where the caption sits — and "no scrim" and "no content at all" are
 * different cards.
 *
 * `tone` is the section's other half and applies whether or not the scrim is
 * drawn: it pins the caption's ink and the wash's colour to one theme instead
 * of letting them follow the reader's. It has to be pinned, because what the
 * words stand on is the PICTURE, and the picture does not change when the page
 * does — a caption tracking the page theme goes white on a light screenshot
 * the moment the reader flips to dark.
 */
export const LinkCardContentSchema = z.object({
  title: z.string().optional(),
  /** The line above the title — where a dated listing puts its date. */
  meta: z.string().optional(),
  scrim: z.boolean().optional(),
  tone: LinkCardToneSchema.optional(),
});

/**
 * Whether following the card leaves this site's tab.
 *
 * Stored per card rather than derived from the kind, which is the point of the
 * switch: a document is usually opened beside the page you found it on and an
 * internal page usually is not, but neither of those is a rule, and the author
 * is the one who knows.
 */
const newTab = z.boolean().optional();

/**
 * Where the card goes, and WHICH SORT of place that is.
 *
 * The kind is stored rather than read off the href, because two of the three
 * are the same string and only the author knows which they meant: a PDF sitting
 * in the bucket and a third-party page are both absolute URLs. Sniffing `.pdf`
 * off the end would be a guess, and R2 keys are not obliged to carry an
 * extension at all (the argument `MediaNodeSchema` makes for storing `kind`).
 *
 * It is also what the RAIL branches on — the site's own picker, a URL field, or
 * the document library — which is only expressible if the choice is recorded.
 *
 * The href is OPTIONAL, and that is the authoring ORDER rather than an
 * oversight: you say what sort of link you want, then you go and find it. A
 * section that could not exist until it was complete would have nowhere to keep
 * the choice you make first. A card with a kind and no href has nowhere to go
 * yet — `LinkCard` draws one as a plain box rather than as an anchor with an
 * empty href, which is a link to the page you are already on.
 */
export const LinkCardLinkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("internal"),
    href: InternalPathSchema.optional(),
    newTab,
  }),
  z.object({ kind: z.literal("external"), href: z.url().optional(), newTab }),
  // The public URL of an uploaded file. A URL and not an R2 key, so the card
  // renders without a lookup — the same thing a media node stores, for the same
  // reason.
  z.object({ kind: z.literal("document"), href: z.url().optional(), newTab }),
]);

export type LinkCardLink = z.infer<typeof LinkCardLinkSchema>;

export const LinkCardConfigSchema = z.object({
  media: LinkCardMediaSchema.optional(),
  content: LinkCardContentSchema.optional(),
  link: LinkCardLinkSchema.optional(),
});

export type LinkCardConfig = z.infer<typeof LinkCardConfigSchema>;

/**
 * Where this card goes — or nothing, for one that has not been pointed
 * anywhere yet.
 *
 * `undefined` and not `""`, and the difference is what the card renders as: an
 * anchor with an empty `href` is a link to the page it is already on, and it is
 * focusable and followable. A card still being built should be neither.
 */
export function linkCardHref(config: LinkCardConfig): string | undefined {
  return config.link?.href;
}

/**
 * What the card is CALLED — the words on it, and failing that the name of
 * where it goes.
 *
 * The fallback is not cosmetic. A card may be a picture with no caption at all,
 * and the picture is decorative (`alt=""`, aria-hidden — see `LinkCard`), so
 * without this the link has no accessible name whatsoever and is announced as
 * its own URL. An internal destination has a name written down already; an
 * external one has only the URL, which is a poor name but a real one.
 */
export function linkCardTitle(config: LinkCardConfig): string | undefined {
  const written = config.content?.title?.trim();
  if (written) return written;
  const link = config.link;
  if (!link?.href) return undefined;
  return link.kind === "internal"
    ? sitePathLabel(link.href) ?? link.href
    : link.href;
}
