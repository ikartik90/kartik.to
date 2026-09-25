import type { Metadata } from "next";
import { cx } from "../../../../styled-system/css";
import { Intro } from "./intro";
import { Landing } from "./landing";
import { Walkthrough } from "./walkthrough";
import { cashbyTheme, inter, interArrow } from "./theme";
import { LAB_PAGES } from "@/data/lab-pages";

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
