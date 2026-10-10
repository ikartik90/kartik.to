"use client";

import { css, cx } from "../../../styled-system/css";
import { CHECK_INS } from "./check-ins-content";
import { CheckInsGap } from "./check-ins-gap";
import { RiskDashboardWireframe } from "./check-ins-risk";
import { SpiderSignalsSplit } from "./check-ins-spider";
import { CheckInsPageWireframe, OffAppWireframe, TimecardWireframe } from "./check-ins-wireframes";
import { ClipsCarousel } from "./clips-carousel";
import { NORTH_STAR } from "./data";
import { FeatureGrid } from "./feature-grid";
import { HeadedCards } from "./headed-cards";
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

// A head under a rule across the sheet, spaced as the North Star's band (`bandStyle`), its words on the column's edge.
const edgeInk = "color-mix(in srgb, token(colors.border.divider) 50%, transparent)";
const ruledHeadStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  alignItems: "flex-start",
  width: "calc(100% + 2 * token(spacing.3xl))",
  marginInline: "calc(-1 * token(spacing.3xl))",
  marginBlock: "4xl",
  paddingInline: "3xl",
  paddingBlockStart: "5xl",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: edgeInk,
  "& > *": { width: "min(100%, token(sizes.articleContent))" },
  mdDown: {
    width: "calc(100% + 2 * token(spacing.xl))",
    marginInline: "calc(-1 * token(spacing.xl))",
    marginBlockStart: "3xl",
    marginBlockEnd: 0,
    paddingInline: "xl",
    paddingBlockStart: "calc(2 * token(spacing.3xl))",
  },
});

/**
 * The check-ins and time tracking sheet: the walkthrough, why it mattered, the UX gap, the North Star, what floor
 * managers and finance got, a worker's risk signals, then the operations team's dashboard.
 */
export function CheckInsSheet() {
  const { clips, stakes, gap, northStar, cards, signals, traceability, outcome, takeaway } = CHECK_INS;
  return (
    <article className={articleStyle}>
      <ClipsCarousel clips={clips} />

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <Head caption={stakes.eyebrow}>{stakes.heading}</Head>
        <Prose text={stakes.body} />
        <FeatureGrid features={stakes.reasons} />
      </section>

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <CheckInsGap {...gap} />
      </section>

      <section className={bandStyle} data-sheet-step="">
        <Head caption={NORTH_STAR} large>
          {northStar}
        </Head>
      </section>

      <section className={wideSectionStyle} data-bleed="" data-sheet-step="">
        <HeadedCards
          rows={[
            { ...cards.checkIns, graphic: <CheckInsPageWireframe /> },
            { ...cards.timecards, graphic: <TimecardWireframe /> },
            { ...cards.offApp, graphic: <OffAppWireframe /> },
          ]}
        />
      </section>

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-bleed="" data-sheet-step="">
        <SpiderSignalsSplit data={signals.spider} head={signals} />
      </section>

      <section className={ruledHeadStyle} data-sheet-step="">
        <Head caption={traceability.eyebrow}>{traceability.heading}</Head>
      </section>

      <section className={cx(wideSectionStyle, roomBelowStyle)} data-bleed="" data-sheet-step="">
        <HeadedCards rows={[{ ...cards.dashboard, graphic: <RiskDashboardWireframe /> }]} />
      </section>

      <Closing outcome={outcome} takeaway={takeaway} />
    </article>
  );
}
