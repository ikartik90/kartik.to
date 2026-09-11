import { notFound } from "next/navigation";
import { css } from "../../../../styled-system/css";
import { isAdmin } from "@/lib/auth/server";
import { Typography } from "@/components/ui/typography";
import { getTestimonials } from "@/app/actions/testimonial";

// ---------------------------------------------------------------------------
// What has come in through `/vouch` — the reading end of the only table on this
// site a stranger writes.
//
// Under `/edit` with the rest of the admin surface, and guarded the same way:
// `notFound()` rather than a 401, so the route never admits to existing. A
// STATIC segment, so Next matches it ahead of `/edit/[slug]` — the same trick
// `/edit/home` relies on.
//
// A LIST and nothing else. No editing, no approving, no publishing: these are
// somebody else's words, and the one thing I am entitled to do with them before
// there is a page to put them on is read them. Every control this page does not
// have is a decision deferred to the day that page exists — see the note on
// `publishedAt`'s absence in the schema.
//
// A name and a date, since the LinkedIn column was dropped. Nothing here
// identifies the writer beyond what they typed, and repeat sends now arrive as
// separate rows rather than replacing one another — so two entries under one
// name is a thing this list can legitimately show, and sorting that out is mine
// to do by eye.
// ---------------------------------------------------------------------------

const pageStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
  paddingInline: "xl",
  paddingBlock: "5xl",
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
});

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  listStyle: "none",
  padding: "none",
  margin: "none",
});

const entryStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "lg",
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "border.default",
});

const bylineStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "sm",
});

// Fixed locale and explicit parts, rather than the reader's own. A server
// render and a hydration pass must produce the same string, and `toLocaleDateString`
// with no arguments is free to disagree with itself across that boundary.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
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
            : `${testimonials.length} in, newest first.`}
        </Typography>
      </header>

      {testimonials.length > 0 && (
        <ul className={listStyle}>
          {testimonials.map((testimonial) => (
            <li key={testimonial.id} className={entryStyle}>
              <Typography tag="blockquote" type="quote">
                {testimonial.quote}
              </Typography>
              <div className={bylineStyle}>
                <Typography tag="cite" type="bodySmall">
                  {testimonial.name}
                </Typography>
                <Typography tag="small" type="sidenote">
                  {DATE_FORMAT.format(testimonial.createdAt)}
                </Typography>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
