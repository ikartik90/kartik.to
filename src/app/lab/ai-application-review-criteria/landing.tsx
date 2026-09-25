import { Fragment } from "react";
import { css, cx } from "../../../../styled-system/css";
import { CashbyHeader } from "./cashby-header";
import { ReviewCard } from "./review-card";
import { JOB_TITLE } from "./job";
import HistoryIcon from "./icons/history.svg";
import DotIcon from "./icons/dot.svg";
import TitleChevron from "./icons/chevron-down-title.svg";
import DoorOpenIcon from "./icons/door-open.svg";
import StatusChevron from "./icons/chevron-small-down-white.svg";
import GotoIcon from "./icons/goto.svg";
import ButtonChevron from "./icons/chevron-down-button.svg";
import SidebarSeparator from "./icons/separator-sidebar.svg";
import AiIcon from "./icons/ai.svg";
import TabCornerBefore from "./icons/tab-corner-before.svg";
import TabCornerAfter from "./icons/tab-corner-after.svg";

const SECTIONS = [
  { group: "Activity", items: ["Candidate pipeline", "Dashboard"] },
  {
    group: "Admin",
    items: ["Settings", "Openings", "Interview plan", "Job postings"],
  },
] as const;

const pageStyle = css({
  display: "flex",
  flexDirection: "column",
  minHeight: "100dvh",
});

const breadcrumbStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  flexShrink: 0,
  height: "32px",
  paddingInline: "20px",
  font: "var(--cashby-text-label)",
  color: "var(--cashby-accent)",
  whiteSpace: "nowrap",
});

const jobHeaderStyle = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
  flexShrink: 0,
  paddingBlock: "12px",
  paddingInline: "20px",
});

const jobTitleBlockStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
});

const jobTitleRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
});

const jobTitleStyle = css({
  font: "var(--cashby-text-page-title)",
  whiteSpace: "nowrap",
});

const statusStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  height: "32px",
  paddingInline: "8px",
  borderRadius: "16px",
  backgroundColor: "var(--cashby-positive)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-body)",
});

const jobActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
});

const jobActionStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  height: "40px",
  paddingInline: "12px",
  borderRadius: "8px",
  borderWidth: "var(--cashby-rule)",
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  font: "var(--cashby-text-button)",
});

const jobActionLabelStyle = css({
  maxWidth: "148px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const panelRegionStyle = css({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  paddingBlock: "12px",
  paddingInline: "20px",
});

// The outline is an ::after overlay: the white pane runs to the edge and would cover a border.
const shellStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  borderRadius: "16px",
  backgroundColor: "var(--cashby-fill)",
  _after: {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-hairline)",
    pointerEvents: "none",
  },
});

const sectionsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  flexShrink: 0,
  width: "160px",
  paddingBlock: "8px",
  paddingInlineStart: "8px",
});

const sectionGroupStyle = css({
  display: "flex",
  alignItems: "center",
  height: "28px",
  paddingInline: "6px",
  font: "var(--cashby-text-label)",
  color: "var(--cashby-slate-muted)",
  textTransform: "uppercase",
});

const sectionItemStyle = css({
  display: "flex",
  alignItems: "center",
  height: "32px",
  paddingInline: "6px",
  borderRadius: "6px",
  whiteSpace: "nowrap",
});

const sectionsRuleStyle = css({ position: "relative", height: 0 });
const sectionsRuleLineStyle = css({
  position: "absolute",
  insetBlockStart: "-0.25px",
  insetInlineStart: "-0.25px",
});

const currentSectionStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  height: "32px",
  paddingBlockStart: "6px",
  paddingInline: "6px",
  borderStartStartRadius: "8px",
  borderEndStartRadius: "8px",
  backgroundColor: "var(--cashby-surface)",
  font: "var(--cashby-text-tab)",
  whiteSpace: "nowrap",
});

// Paints the corners: SVGR turns their white into `currentColor`.
const tabCornerStyle = css({
  position: "absolute",
  insetInlineEnd: 0,
  color: "var(--cashby-surface)",
});
const tabCornerBeforeStyle = css({ insetBlockStart: "-8px" });
const tabCornerAfterStyle = css({ insetBlockEnd: "-8px" });

const paneStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  flex: 1,
  alignSelf: "stretch",
  minWidth: 0,
  padding: "12px",
  backgroundColor: "var(--cashby-surface)",
});

const paneTitleStyle = css({ font: "var(--cashby-text-section-title)" });

export function Landing() {
  return (
    <div className={pageStyle}>
      <CashbyHeader />

      <div className={breadcrumbStyle}>
        <HistoryIcon aria-hidden />
        <span>Job dashboard</span>
        <DotIcon aria-hidden />
        <span>Overview</span>
      </div>

      <div className={jobHeaderStyle}>
        <div className={jobTitleBlockStyle}>
          <div className={jobTitleRowStyle}>
            <h1 className={jobTitleStyle}>{JOB_TITLE}</h1>
            <TitleChevron aria-hidden />
          </div>
          <span className={statusStyle}>
            <DoorOpenIcon aria-hidden />
            Open
            <StatusChevron aria-hidden />
          </span>
        </div>
        <div className={jobActionsStyle}>
          <span className={jobActionStyle}>
            <span className={jobActionLabelStyle}>Job board</span>
            <GotoIcon aria-hidden />
          </span>
          <span className={jobActionStyle}>
            <span className={jobActionLabelStyle}>More</span>
            <ButtonChevron aria-hidden />
          </span>
        </div>
      </div>

      <main className={panelRegionStyle}>
        <div className={shellStyle}>
          <div className={sectionsStyle}>
            {SECTIONS.map(({ group, items }, index) => (
              <Fragment key={group}>
                {index > 0 && (
                  <span className={sectionsRuleStyle} aria-hidden>
                    <SidebarSeparator className={sectionsRuleLineStyle} />
                  </span>
                )}
                <span className={sectionGroupStyle}>{group}</span>
                {items.map((item) => (
                  <span key={item} className={sectionItemStyle}>
                    {item}
                  </span>
                ))}
              </Fragment>
            ))}
            <span className={currentSectionStyle} aria-current="page">
              <AiIcon aria-hidden />
              AI features
              <TabCornerBefore
                aria-hidden
                className={cx(tabCornerStyle, tabCornerBeforeStyle)}
              />
              <TabCornerAfter
                aria-hidden
                className={cx(tabCornerStyle, tabCornerAfterStyle)}
              />
            </span>
          </div>

          <section className={paneStyle}>
            <h2 className={paneTitleStyle}>AI features</h2>
            <ReviewCard />
          </section>
        </div>
      </main>
    </div>
  );
}
