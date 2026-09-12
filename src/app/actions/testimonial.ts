"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import {
  TESTIMONIAL_EXCERPT_NOT_THEIRS,
  TestimonialDetailsSchema,
  TestimonialSubmissionSchema,
  isExcerptOfQuote,
  type Testimonial,
} from "@/domain/testimonial";

// ---------------------------------------------------------------------------
// Mutations and reads for collected testimonials.
//
// The asymmetry is the whole design, and it is the opposite of every other
// action module here: WRITING IS OPEN and READING IS THE AUTHOR'S. Everywhere
// else that split runs the other way — anyone may read a published post, only I
// may write one — so it is worth saying plainly why this one is inverted.
//
// Writing is open because it has to be. The people filling this in are the ones
// I asked for a testimonial; they have no account here and never will, and a
// gate they could pass would be a gate that is not a gate. What stands in for
// authentication is the LINK: the page is not in the nav, the palette,
// `SITE_PATHS` or any crawler's index, so the only way to the form is for me to
// have sent it. That is obscurity rather than security, and it is sized to the
// stake — the worst a leak buys is junk in a table I read by hand.
//
// Reading USED to be closed outright, because the words were written for a page
// that did not exist. It exists now — the wall at the foot of the homepage — so
// there are two reads here rather than one, and the line between them is the
// `publishedAt` column:
//
//   * `getPublishedTestimonials` is DELIBERATELY PUBLIC, the one action in this
//     module that neither calls `requireAdmin()` nor should. Its caller is the
//     homepage, served to everybody. It is safe to be public because it is not
//     a read of the table: it is a read of the rows I have put on the page, and
//     the gate is in the query rather than in the caller.
//   * `getTestimonials` stays the author's, and is still the only way to see a
//     row that has not been published — which is every row, the moment it
//     arrives.
//
// That column is what lets the form stay open. `/vouch` has no session to check
// anybody against, so without a gate the homepage would publish whatever
// arrived next the instant it was sent; with one, a submission lands in a table
// and waits for me.
//
// NOTHING HERE THROWS AT A STRANGER. `submitTestimonial` returns its refusals
// as values, because the alternative is a Next.js error page in front of
// somebody doing me a favour. `getTestimonials` throws freely — the only caller
// is mine.
// ---------------------------------------------------------------------------

/** Which box a refusal belongs under. `form` is the one that belongs to none of
 *  them — a write that failed after the input had already been accepted. */
export type TestimonialFieldErrors = Partial<
  Record<"name" | "quote" | "form", string>
>;

export type SubmitTestimonialResult =
  | { ok: true }
  | { ok: false; errors: TestimonialFieldErrors };

/** What the form posts: the two real fields plus the honeypot, all unvalidated
 *  and all `unknown` in spirit — this is an HTTP surface, not a function call. */
export interface TestimonialSubmissionInput {
  name: string;
  quote: string;
  /** See `TESTIMONIAL_HONEYPOT_FIELD`. Absent from every honest submission. */
  website?: string;
}

/**
 * Turn a parse failure into one message per box.
 *
 * FIRST issue per field wins. Zod will happily report that a quote is both
 * empty and mis-shaped; a person needs the one thing to do next, not a list.
 */
function fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): TestimonialFieldErrors {
  const errors: TestimonialFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "quote") && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Record somebody's testimonial. Open to anyone holding the link — see the note
 * at the top of this file for why that is deliberate rather than an oversight.
 *
 * A plain CREATE, and it used to be an upsert. The LinkedIn URL was the table's
 * natural key: unique, normalised, so a second send from one profile corrected
 * the first rather than duplicating it. Removing the field removed the key, and
 * nothing here replaces it — keying on `name` would be worse than having no key
 * at all, since it would let anybody overwrite somebody else's words by typing
 * their name. So two sends are two rows. That is the honest behaviour for a
 * table with no identity in it, and the list is short enough to sort out by eye.
 *
 * The data written is `parsed.data`, never the caller's object: the schema
 * strips unknown keys, so a stale client still posting `linkedinUrl` cannot
 * widen the write to a column that no longer exists.
 */
export async function submitTestimonial(
  input: TestimonialSubmissionInput,
): Promise<SubmitTestimonialResult> {
  // Reported as SUCCESS, and that is the point rather than a bug: a bot told it
  // failed is a bot that tries again with the field left blank. Checked before
  // validation so a filled trap costs nothing to discard.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true };
  }

  const parsed = TestimonialSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    await prisma.testimonial.create({ data: parsed.data });
  } catch {
    // The database is allowed to say no after the schema has said yes.
    // Swallowed into a value rather than thrown: the caller is a stranger, and
    // the detail is mine.
    return {
      ok: false,
      errors: { form: "Something went wrong saving that. Try again?" },
    };
  }

  return { ok: true };
}

/**
 * Everything that has come in, newest first — the author's alone.
 *
 * By `createdAt` rather than by name, because the list's job is "what arrived
 * while I was not looking".
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  await requireAdmin();

  return prisma.testimonial.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The testimonials on the homepage — everything I have published, newest first.
 *
 * PUBLIC ON PURPOSE, and the only action in this file without a guard. Said out
 * loud here because the house rule is that every Server Action opens with
 * `requireAdmin()` unless it is deliberately public, and this is the exception
 * rather than an omission: the caller is the homepage, and a guard on it would
 * mean nobody could read the wall.
 *
 * THE GATE IS THE `where`, not the caller. `publishedAt: { not: null }` is
 * applied by the database, so an unpublished row is never loaded, never
 * serialised into the page's payload, and never reaches a browser — which is a
 * stronger guarantee than filtering rows after fetching them, where every
 * unpublished quote still travels to the client inside the RSC stream and is
 * merely not drawn.
 *
 * `createdAt` and not `publishedAt` for the order, so the wall reads in the
 * same sequence as the board I curate it from. Publishing eight rows at once —
 * as the backfill migration did — would otherwise leave them with one instant
 * between them and no order at all.
 */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  return prisma.testimonial.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Put a face and a profile on a row that has already arrived — the author's
 * half, and the one action in this file that edits rather than appends.
 *
 * `update` and never `upsert`: there is nothing to create here. The row is the
 * submitter's, made by them through the form; this only adds to it. A missing
 * `id` is a bug on my side and is allowed to throw as one — the caller is the
 * board, not a stranger, which is why this reads nothing like
 * `submitTestimonial` and throws where that one returns.
 *
 * `parsed` is what reaches Prisma, never `input`. The schema strips unknown
 * keys, so the `name` and `quote` a careless caller sends alongside are gone
 * before the `data` object is built — which is what keeps a door opened for a
 * picture from becoming a door onto somebody else's words. The test says so out
 * loud.
 *
 * Returns the WHOLE updated row rather than an acknowledgement, so the board
 * can replace its copy with the stored one and see the profile in the spelling
 * it was actually normalised into.
 *
 * The excerpt is the one field here whose validity depends on ANOTHER field, so
 * it is the one that costs a read before the write. See below.
 *
 * `name` is the one SUBMITTED field this will write, and `quote` is deliberately
 * still not — see `TestimonialDetailsSchema` for where that line is and why.
 */
export async function updateTestimonialDetails(
  input: unknown,
): Promise<Testimonial> {
  await requireAdmin();

  const { id, name, avatarUrl, linkedinUrl, excerpt, tagline, published } =
    TestimonialDetailsSchema.parse(input);

  // THREE states, and the difference is why this is not a plain spread.
  // `undefined` means the caller said nothing about the excerpt, so the stored
  // one must survive untouched — a board editing only the picture must not
  // silently throw away a chosen excerpt. `null` clears it. A string has to be
  // earned, below.
  const data: {
    avatarUrl: string | null;
    linkedinUrl: string | null;
    excerpt?: string | null;
    tagline?: string | null;
    name?: string;
    publishedAt?: Date | null;
  } = { avatarUrl, linkedinUrl };

  if (excerpt !== undefined) {
    data.excerpt = excerpt;
  }

  // Same three states as the excerpt above, and nothing more to check: a
  // tagline is mine to write, so there is no "are these their words" question
  // to ask of it.
  if (tagline !== undefined) {
    data.tagline = tagline;
  }

  // Same absent-means-leave-alone rule, but with only two states rather than
  // three: a name cannot be cleared, so the schema has already refused a blank
  // one by the time we are here.
  if (name !== undefined) {
    data.name = name;
  }

  // A BOOLEAN in, a TIMESTAMP out. The switch knows its position and this knows
  // what o'clock it is, which is the right division: a caller cannot post a
  // publication date of its own — `publishedAt` is not a key
  // `TestimonialDetailsSchema` names, so it is stripped before we get here —
  // and the column cannot end up holding an instant that never happened.
  //
  // The absent case is load-bearing rather than tidy. The board sends the whole
  // row on every edit, so without it, adding a picture would re-stamp the
  // publication date of an already-published testimonial on each keystroke's
  // worth of save.
  if (published !== undefined) {
    data.publishedAt = published ? new Date() : null;
  }

  if (excerpt) {
    // Read back rather than trusted. The quote this is checked against is the
    // STORED one, never one sent alongside — otherwise "are these their words"
    // would be answered by the same request trying to change them, which is no
    // check at all. The test says so out loud.
    const stored = await prisma.testimonial.findUnique({
      where: { id },
      select: { quote: true },
    });
    if (!stored) throw new Error("Testimonial not found");
    if (!isExcerptOfQuote(stored.quote, excerpt)) {
      throw new Error(TESTIMONIAL_EXCERPT_NOT_THEIRS);
    }
  }

  return prisma.testimonial.update({ where: { id }, data });
}
