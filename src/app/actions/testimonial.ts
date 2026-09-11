"use server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import {
  TestimonialSubmissionSchema,
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
// Reading is closed because the words are not mine to show. Somebody wrote them
// for a page that does not exist yet, and until it does they are private
// correspondence that happens to live in Postgres.
//
// NOTHING HERE THROWS AT A STRANGER. `submitTestimonial` returns its refusals
// as values, because the alternative is a Next.js error page in front of
// somebody doing me a favour. `getTestimonials` throws freely — the only caller
// is mine.
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (session?.user?.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
}

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
