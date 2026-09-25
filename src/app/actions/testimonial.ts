"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import {
  TESTIMONIAL_EXCERPT_NOT_THEIRS,
  TestimonialDetailsSchema,
  TestimonialSubmissionSchema,
  isExcerptOfQuote,
  type Testimonial,
} from "@/domain/testimonial";

// Deliberately public: `submitTestimonial` (reached only via the unlisted /vouch link)
// and `getPublishedTestimonials` (gated by its `where`). Everything else is the author's.

/** `form` is for a write that failed after the input was accepted. */
export type TestimonialFieldErrors = Partial<
  Record<"name" | "quote" | "form", string>
>;

export type SubmitTestimonialResult =
  | { ok: true }
  | { ok: false; errors: TestimonialFieldErrors };

export interface TestimonialSubmissionInput {
  name: string;
  quote: string;
  /** Honeypot; see `TESTIMONIAL_HONEYPOT_FIELD`. */
  website?: string;
}

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

/** Returns refusals as values rather than throwing at a stranger. */
export async function submitTestimonial(
  input: TestimonialSubmissionInput,
): Promise<SubmitTestimonialResult> {
  // Honeypot: report success so a bot doesn't retry with the field blank.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true };
  }

  const parsed = TestimonialSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    await prisma.testimonial.create({ data: parsed.data });
  } catch {
    return {
      ok: false,
      errors: { form: "Something went wrong saving that. Try again?" },
    };
  }

  return { ok: true };
}

export async function getTestimonials(): Promise<Testimonial[]> {
  await requireAdmin();

  return prisma.testimonial.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/** Unpublished rows are filtered by the query, so they never reach the page payload. */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  return prisma.testimonial.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateTestimonialDetails(
  input: unknown,
): Promise<Testimonial> {
  await requireAdmin();

  const { id, name, avatarUrl, linkedinUrl, excerpt, tagline, published } =
    TestimonialDetailsSchema.parse(input);

  // `undefined` leaves the stored value alone; `null` clears it.
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

  if (tagline !== undefined) {
    data.tagline = tagline;
  }

  if (name !== undefined) {
    data.name = name;
  }

  // Only when sent: the board saves the whole row on every edit and must not re-stamp the date.
  if (published !== undefined) {
    data.publishedAt = published ? new Date() : null;
  }

  if (excerpt) {
    // Checked against the STORED quote, never one sent alongside.
    const stored = await prisma.testimonial.findUnique({
      where: { id },
      select: { quote: true },
    });
    if (!stored) throw new Error("Testimonial not found");
    if (!isExcerptOfQuote(stored.quote, excerpt)) {
      throw new Error(TESTIMONIAL_EXCERPT_NOT_THEIRS);
    }
  }

  const saved = await prisma.testimonial.update({ where: { id }, data });

  // Both pages are cached renders of this table; revalidate after every successful write.
  revalidatePath("/");
  revalidatePath("/edit/testimonials");

  return saved;
}
