import { z } from "zod";
import { MediaNodeSchema } from "@/domain/nodes";
import { sitePathTitle } from "@/data/site-paths";

// Validates a link card's `Component.props`. Every field is optional: a placed,
// unfilled card must still save.

export const LINK_CARD_COMPONENT_ID = "link-card";

/** Shape only, not membership of `SITE_PATHS`: a renamed route must not break stored cards. */
export const InternalPathSchema = z.string().startsWith("/");

export const LinkTargetKindSchema = z.enum([
  "internal",
  "external",
  "document",
]);

export type LinkTargetKind = z.infer<typeof LinkTargetKindSchema>;

export const LinkCardToneSchema = z.enum(["light", "dark"]);

export type LinkCardTone = z.infer<typeof LinkCardToneSchema>;

/** `dark` falls back to `light` when absent. */
export const LinkCardMediaSchema = z.object({
  light: MediaNodeSchema.optional(),
  dark: MediaNodeSchema.optional(),
});

export type LinkCardMedia = z.infer<typeof LinkCardMediaSchema>;

/** `tone` pins the caption to one theme: the picture under it doesn't follow the page's. */
export const LinkCardContentSchema = z.object({
  title: z.string().optional(),
  /** The line above the title. */
  meta: z.string().optional(),
  scrim: z.boolean().optional(),
  tone: LinkCardToneSchema.optional(),
});

const newTab = z.boolean().optional();

/**
 * `kind` is stored, not sniffed from `href` (a document and an external page are
 * both absolute URLs). `href` is optional: the kind is chosen first.
 */
export const LinkCardLinkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("internal"),
    href: InternalPathSchema.optional(),
    newTab,
  }),
  z.object({ kind: z.literal("external"), href: z.url().optional(), newTab }),
  // A public URL, not an R2 key, so it renders without a lookup.
  z.object({ kind: z.literal("document"), href: z.url().optional(), newTab }),
]);

export type LinkCardLink = z.infer<typeof LinkCardLinkSchema>;

export const LinkCardConfigSchema = z.object({
  media: LinkCardMediaSchema.optional(),
  content: LinkCardContentSchema.optional(),
  link: LinkCardLinkSchema.optional(),
});

export type LinkCardConfig = z.infer<typeof LinkCardConfigSchema>;

/** `undefined`, never `""`: an empty href would link to the current page. */
export function linkCardHref(config: LinkCardConfig): string | undefined {
  return config.link?.href;
}

/** Falls back to the destination's name: the picture is decorative, so the link needs one. */
export function linkCardTitle(config: LinkCardConfig): string | undefined {
  const written = config.content?.title?.trim();
  if (written) return written;
  const link = config.link;
  if (!link?.href) return undefined;
  return link.kind === "internal"
    ? sitePathTitle(link.href) ?? link.href
    : link.href;
}
