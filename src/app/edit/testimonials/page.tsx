import { notFound } from "next/navigation";
import { css } from "../../../../styled-system/css";
import { isAdmin } from "@/lib/auth/server";
import { Typography } from "@/components/ui/typography";
import { getTestimonials } from "@/app/actions/testimonial";
import { TestimonialBoard } from "./testimonial-board";

// ---------------------------------------------------------------------------
// What has come in through `/vouch` — the reading end of the only table on this
// site a stranger writes, and the one place I annotate it.
//
// Under `/edit` with the rest of the admin surface, and guarded the same way:
// `notFound()` rather than a 401, so the route never admits to existing. A
// STATIC segment, so Next matches it ahead of `/edit/[slug]` — the same trick
// `/edit/home` relies on.
//
// A SERVER COMPONENT that reads the table and stops. Everything interactive —
// the selection, the rail, the writes — is `TestimonialBoard` below it, which
// is the client boundary kept at the leaf the way the rest of this codebase
// keeps it. The page's own job is the guard, the read, and the one line that
// says what is on screen.
//
// STILL NOT PUBLISHED. There is no reader-facing page for these words and this
// does not add one: every row here is private correspondence until I decide
// otherwise, which is why the board has no publish control and the schema no
// `publishedAt` for it to write. What the board DOES add is the half of a row
// that is mine — a face and a profile — so that whenever that page does exist,
// there is something to draw it with.
// ---------------------------------------------------------------------------

const pageStyle = css({
  // Wider than `articleContent`, which the plain list this replaced was held
  // to: a column of prose wants a measure, and a grid of cards wants room to be
  // a grid — at 640px this board is one column of cards on any screen. The same
  // three-up width the site's other listings use, so the cards here land on the
  // same column rhythm as the cards everywhere else.
  maxWidth: "listingGrid3Up",
  marginInline: "auto",
  width: "token(spacing.full)",
  paddingInline: "xl",
  paddingBlock: "5xl",
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
});

export default async function TestimonialsPage() {
  if (!(await isAdmin())) notFound();

  const testimonials = await getTestimonials();

  return (
    <main className={pageStyle}>
      <header>
        <Typography tag="h1" type="title">
          Testimonials
        </Typography>
        <Typography tag="p" type="bodySmall">
          {testimonials.length === 0
            ? "Nothing yet. The form is at /vouch — send someone the link."
            : `${testimonials.length} in, newest first. Select one to add a picture and a profile.`}
        </Typography>
      </header>

      {/* Absent rather than empty for a table with nothing in it: a grid drawn
          around no cards is a blank rectangle under a heading, which reads as a
          board that failed to load rather than one with nothing to show. */}
      {testimonials.length > 0 && (
        <TestimonialBoard testimonials={testimonials} />
      )}
    </main>
  );
}
