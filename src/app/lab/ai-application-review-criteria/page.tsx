import type { Metadata } from "next";
import { cx } from "../../../../styled-system/css";
import { Intro } from "./intro";
import { Landing } from "./landing";
import { Walkthrough } from "./walkthrough";
import { cashbyTheme, inter, interArrow } from "./theme";
import { LAB_PAGES } from "@/data/lab-pages";

// ---------------------------------------------------------------------------
// A full-screen prototype: AI-assisted application review, with criteria
// benchmarked against candidates whose outcome is already known.
//
// UNLISTED, on purpose. It is not in `SITE_PAGES`, so it is out of the
// sitemap, `llms.txt` and the link-card picker at once. For now the ⌘K palette
// lists it among the projects (`LAB_PAGES`); otherwise the way in is its
// prototype article, which says what it is testing. No
// `robots: noindex` to go with that — a published post links here, and a page
// a post links to has nothing to hide.
//
// Everything it looks like is local to this folder (`theme.ts`, `icons/`): it
// is drawn in the recruiting product's clothes, not the site's. It opens on
// `Intro`, which says what the prototype is for, and goes on to the
// `Walkthrough` of trying it.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: LAB_PAGES.reviewCriteria.title,
  description:
    "Benchmark AI application-review criteria against twelve candidates whose outcome is already known.",
};

export default function AiApplicationReviewCriteriaPage() {
  return (
    <div className={cx(inter.variable, interArrow.variable, cashbyTheme)}>
      <Walkthrough>
        <Landing />
        <Intro />
      </Walkthrough>
    </div>
  );
}
