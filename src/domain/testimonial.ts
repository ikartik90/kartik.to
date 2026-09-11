import { z } from "zod";

// ---------------------------------------------------------------------------
// Testimonial — a few words somebody who has worked with me agreed to put their
// name to, collected through a form at `/vouch` rather than over email.
//
// The one thing worth saying up front is WHO WRITES THIS. Every other table in
// this schema is written by the author, from an admin surface, behind a session
// the proxy has already checked. This one is written by strangers, through a
// link handed out by hand, with no account and no session to check them
// against — so this file is not a formality on the way to the column, it is the
// only thing standing between the form and the database.
//
// TWO FIELDS, and it briefly had three. A LinkedIn URL was collected as proof
// of who was speaking, and it was also the table's natural key: unique, so a
// second send from one profile corrected the first instead of duplicating it.
// Dropping the field dropped the key with it, and nothing here replaces it —
// `name` would be far worse than nothing, because a unique name lets anybody
// overwrite somebody else's words by typing their name. So a submission is
// simply a row, two sends make two rows, and the honeypot is what stands
// between an open link and a full table. Sized to the stake: the list is short
// and read by hand.
//
// SHORT ON PURPOSE. A testimonial is capped at 280 characters, which is not a
// storage limit — Postgres would take a novel — but an editorial one: the cap
// is the brief. A quote that has to earn its length reads better on a page than
// three paragraphs nobody finishes, and a small box tells the writer that
// without a word of instruction.
// ---------------------------------------------------------------------------

/** The brief, in characters. The form's counter reads this, so the box and the
 *  column can never disagree about what fits. */
export const TESTIMONIAL_QUOTE_MAX_LENGTH = 280;

/** Long enough for a full name with titles; short enough to refuse a paragraph
 *  pasted into the wrong box. */
export const TESTIMONIAL_NAME_MAX_LENGTH = 80;

/**
 * What the form at `/vouch` posts, and the only shape allowed to become a row.
 *
 * Trimmed BEFORE it is measured, so trailing whitespace can neither smuggle a
 * blank field past `min(1)` nor push a legal quote over the cap on a technicality.
 *
 * Unknown keys are stripped, which is Zod's default and is load-bearing here
 * rather than incidental: this schema decides what a row IS, so a caller that
 * posts a retired field (the LinkedIn URL) or an invented one cannot widen the
 * write.
 */
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

/** A stored testimonial, as the admin list reads it back. */
export interface Testimonial extends TestimonialSubmission {
  id: string;
  createdAt: Date;
}

/**
 * The name of the field no human ever sees.
 *
 * A honeypot, and the crudest spam defence there is — which is now the ONLY
 * one, since the unique profile URL that used to collapse repeat sends into a
 * single row went with the LinkedIn field. It is still the right size for the
 * threat: the form is reachable by anyone holding the link, so the realistic
 * nuisance is not a person with a grudge but a bot walking the page and filling
 * every input it finds. One input that is hidden from sight and from assistive
 * technology, left blank by every real submission and completed by an
 * indiscriminate filler, separates the two at no cost to the person actually
 * writing.
 *
 * Named like an ordinary field on purpose: a bot decides what to fill from the
 * name, and nothing takes the bait like `website`.
 */
export const TESTIMONIAL_HONEYPOT_FIELD = "website";
