"use client";

import { cx } from "../../../styled-system/css";
import { ClipsCarousel } from "./clips-carousel";
import { FeatureGrid } from "./feature-grid";
import { NORTH_STAR } from "./data";
import { HeadedCards } from "./headed-cards";
import { OnboardingGap } from "./onboarding-gap";
import { ONBOARDING } from "./onboarding-content";
import { ActivationsWireframe, InviteLinkWireframe, WorkflowsWireframe } from "./onboarding-wireframes";
import {
  articleStyle,
  bandStyle,
  Closing,
  Head,
  Prose,
  roomAboveStyle,
  roomBelowStyle,
  wideSectionStyle,
} from "./sheet-article";

/** The company onboarding sheet: the walkthrough, why it mattered, the UX gap, the North Star and how we got there. */
export function OnboardingSheet() {
  const { clips, stakes, northStar, cards, outcome, takeaway } = ONBOARDING;
  return (
    <article className={articleStyle}>
      <ClipsCarousel clips={clips} />

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <Head caption={stakes.eyebrow}>{stakes.heading}</Head>
        <Prose text={stakes.body} />
        <FeatureGrid features={stakes.reasons} />
      </section>

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <OnboardingGap />
      </section>

      <section className={bandStyle} data-sheet-step="">
        <Head caption={NORTH_STAR} large>
          {northStar}
        </Head>
      </section>

      <section className={cx(wideSectionStyle, roomBelowStyle)} data-bleed="" data-sheet-step="">
        <HeadedCards
          rows={[
            { ...cards.activations, graphic: <ActivationsWireframe /> },
            { ...cards.workflows, graphic: <WorkflowsWireframe /> },
            { ...cards.inviteLinks, graphic: <InviteLinkWireframe /> },
          ]}
        />
      </section>

      <Closing outcome={outcome} takeaway={takeaway} />
    </article>
  );
}
