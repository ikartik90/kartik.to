import type { Metadata } from "next";
import { css } from "../../../styled-system/css";
import { Typography } from "@/components/ui/typography";
import { TestimonialForm } from "./testimonial-form";

// Unlisted, not private: keep it out of nav, SITE_PATHS, the palette and search.

export const metadata: Metadata = {
  title: "Say a few words",
  description: "Leave a short testimonial.",
  robots: { index: false, follow: false },
};

const mainStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
  paddingInline: "xl",
  paddingBlock: "5xl",
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
});

const introStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
});

export default function VouchPage() {
  return (
    <main className={mainStyle}>
      <header className={introStyle}>
        <Typography tag="h1" type="title">
          Say a few words
        </Typography>
        <Typography tag="p" type="bodyLarge">
          If we&rsquo;ve worked together and you&rsquo;d be happy to say so,
          I&rsquo;d be glad of a line or two. Keep it short — a couple of
          sentences beats a paragraph.
        </Typography>
      </header>

      <TestimonialForm />
    </main>
  );
}
