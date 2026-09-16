import type { Metadata } from "next";
import { css } from "../../../styled-system/css";
import { Typography } from "@/components/ui/typography";
import { TestimonialForm } from "./testimonial-form";

// ---------------------------------------------------------------------------
// `/vouch` — the page I send to somebody when I ask them for a testimonial.
//
// UNLISTED, NOT PRIVATE, and the difference is worth being precise about
// because the two are easy to confuse and only one of them is true here.
//
// The site's actual privacy gate is `proxy.ts`: it answers 404 to anyone whose
// session is not mine, which is what hides `/edit`. That mechanism cannot
// protect this page, because the people who need to reach it are by definition
// not me and have no session at all. So this route is openly served to whoever
// asks for it, and what keeps it out of sight is that nothing points at it:
//
//   - no nav entry and no footer link;
//   - not in `SITE_PATHS`, so it cannot be chosen as a link card's destination;
//   - not in the command palette, public rows or admin ones;
//   - `robots: { index: false, follow: false }`, so it stays out of search
//     results.
//
// That is obscurity, and obscurity is a weak gate. It is the RIGHT weak gate
// here: the link is handed out one person at a time, the worst a leak buys
// somebody is a junk row in a table I read by hand, and the alternative — a
// token per recipient — buys real privacy at the cost of a link I cannot simply
// paste into a message. The spam defence that backs it up is now a honeypot
// alone (see `TESTIMONIAL_HONEYPOT_FIELD`): the unique profile URL that used to
// collapse repeat sends into a single row went with the LinkedIn field, so two
// sends are two rows. Proportional to the stake — the list is short and I read
// it by hand.
//
// A SERVER component that renders a client form. Nothing here is fetched and
// nothing is personalised — the page is the same for everybody who opens it,
// and the only moving part is the form.
// ---------------------------------------------------------------------------

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
