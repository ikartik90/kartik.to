import { z } from "zod";

// Submitted by strangers through `/vouch` with no session: these schemas are the only guard
// between the form and the database. Never make `name` unique: anyone could overwrite a row.

export const TESTIMONIAL_QUOTE_MAX_LENGTH = 280;

export const TESTIMONIAL_NAME_MAX_LENGTH = 80;

export const TESTIMONIAL_TAGLINE_MAX_LENGTH = 80;

/** Unknown keys are stripped, so a caller can't widen the write. */
export const TestimonialSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Add your name.")
    .max(TESTIMONIAL_NAME_MAX_LENGTH, "That name is too long."),
  quote: z
    .string()
    .trim()
    .min(1, "Write a line or two.")
    .max(
      TESTIMONIAL_QUOTE_MAX_LENGTH,
      `Keep it to ${TESTIMONIAL_QUOTE_MAX_LENGTH} characters.`,
    ),
});

export type TestimonialSubmission = z.infer<typeof TestimonialSubmissionSchema>;

export interface Testimonial extends TestimonialSubmission {
  id: string;
  createdAt: Date;
  avatarUrl: string | null;
  tagline: string | null;
  /** Typed by the author, never collected from the submitter. */
  linkedinUrl: string | null;
  /** The portion of `quote` a card shows, or null for all of it. */
  excerpt: string | null;
  /** Null keeps a stranger's submission off the homepage until approved. */
  publishedAt: Date | null;
}

/** Honeypot: hidden from people, filled by bots. Named like a real field on purpose. */
export const TESTIMONIAL_HONEYPOT_FIELD = "website";

const LINKEDIN_HOST = "www.linkedin.com";

const NOT_LINKEDIN = "That does not look like a LinkedIn URL.";

/** Blank input (`""`, spaces) is stored as null. */
const blank = z
  .string()
  .trim()
  .refine((value) => value === "")
  .transform(() => null);

/** Normalised to one canonical spelling; the host is checked, not just parsed. */
export const LinkedInProfileUrlSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      ctx.addIssue({ code: "custom", message: NOT_LINKEDIN });
      return z.NEVER;
    }

    // Checked on the parsed hostname so `linkedin.com.example.net` fails.
    const host = url.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      ctx.addIssue({ code: "custom", message: NOT_LINKEDIN });
      return z.NEVER;
    }

    return `https://${LINKEDIN_HOST}${url.pathname.replace(/\/+$/, "")}`;
  });

/**
 * The author's edits from the admin board. Unknown keys are stripped, so `quote` can
 * never be edited through this.
 */
export const TestimonialDetailsSchema = z.object({
  id: z.string().trim().min(1),
  /** Overwrites the submitted name in place; can't be cleared. */
  name: z
    .string()
    .trim()
    .min(1, "A testimonial needs a name on it.")
    .max(TESTIMONIAL_NAME_MAX_LENGTH, "That name is too long.")
    .optional(),
  avatarUrl: z.union([blank, z.url()]).nullable(),
  /** Absent leaves it alone, null or blank clears it, a string replaces it. */
  tagline: z
    .union([
      blank,
      z.string().trim().min(1).max(TESTIMONIAL_TAGLINE_MAX_LENGTH),
    ])
    .nullish(),
  // Never unique: a hand-typed typo would collide with another row.
  linkedinUrl: z.union([blank, LinkedInProfileUrlSchema]).nullable(),
  /** Shape only: the action checks {@link isExcerptOfQuote}. No `.default()`: absent must leave it alone. */
  excerpt: z.union([blank, z.string().trim().min(1)]).nullish(),
  /** Strictly boolean (coercion reads "false" as true); absent leaves publication unchanged. */
  published: z.boolean().optional(),
});

export type TestimonialDetails = z.infer<typeof TestimonialDetailsSchema>;

export const TESTIMONIAL_EXCERPT_NOT_THEIRS =
  "An excerpt has to be their words. Trim the quote down rather than rewriting it.";

/** Verbatim and contiguous only: an excerpt may trim their words, never put words in their mouth. */
export function isExcerptOfQuote(quote: string, excerpt: string): boolean {
  const trimmed = excerpt.trim();
  return trimmed.length > 0 && quote.includes(trimmed);
}

export function testimonialShown(
  testimonial: Pick<Testimonial, "quote" | "excerpt">,
): string {
  return testimonial.excerpt ?? testimonial.quote;
}

/** First code point, not `charAt`, so a surrogate pair isn't split. */
export function testimonialInitial(name: string): string {
  return [...name.trim()][0] ?? "";
}

/** `ada` from `https://www.linkedin.com/in/ada`; falls back to the whole URL. */
export function linkedInHandle(url: string): string {
  const path = url
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^in\//i, "")
    .replace(/\/+$/, "");
  return path === "" ? url : path;
}
