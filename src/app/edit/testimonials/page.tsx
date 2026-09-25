import { notFound } from "next/navigation";
import { css } from "../../../../styled-system/css";
import { isAdmin } from "@/lib/auth/server";
import { Typography } from "@/components/ui/typography";
import { getTestimonials } from "@/app/actions/testimonial";
import { TestimonialBoard } from "./testimonial-board";

const pageStyle = css({
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

      {testimonials.length > 0 && (
        <TestimonialBoard testimonials={testimonials} />
      )}
    </main>
  );
}
