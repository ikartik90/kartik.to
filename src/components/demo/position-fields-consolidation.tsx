"use client";

import type { ReactNode } from "react";
import { css, cx } from "../../../styled-system/css";
import { RedesignDiagram, type DiagramRedline } from "./redesign-diagram";
import type { DemoProps } from "./registry";
import { Field } from "@/components/ui/input/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/wireframe";
import BanIcon from "@/assets/icons/ban.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import InfoIcon from "@/assets/icons/info.svg";
import MapPinIcon from "@/assets/icons/map-pin.svg";
import SiteMapWireframe from "@/assets/wireframes/site-map.svg";

// Sized for the Before: its redlines must reach full length inside the block.
const BODY_HEIGHT = 300;

const TOGGLE_GAP = 12;

// Header 73 + toothed top 36 + notice 82 + gap 12: level with the first field.
const REDLINE_TOP = 73 + 36 + 82 + 12;

const REDLINES: DiagramRedline[] = [
  {
    label: "Disabled Fields",
    side: "start",
    top: REDLINE_TOP,
    spine: 218,
    attach: 109,
  },
  {
    label: "Poor Hierarchy",
    side: "end",
    top: REDLINE_TOP,
    spine: 172,
    tail: 44,
    attach: 109,
  },
];

const beforePaneStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  "&[data-presented=false]": { transform: "translateY(-12px)" },
});

const noticeHeadingStyle = css({
  textStyle: "bodySmall",
});

// One heading line tall (`1lh`), so the glyph centres on the heading.
const noticeIconStyle = css({
  display: "flex",
  alignItems: "center",
  textStyle: "bodySmall",
  height: "1lh",
  "& svg": { height: "token(spacing.xxl)" },
});

const noticeActionStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  gap: "sm",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});

const actionIconStyle = css({
  display: "block",
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

const noticeHintStyle = css({
  display: "flex",
  flexDirection: "column",
  marginBlockStart: "xs",
  textStyle: "sidenote",
  color: "field.text.muted",
});

const fieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

const fieldRowStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "xl",
});

const narrowFieldStyle = css({
  width: "133.75px",
  flexShrink: 0,
});

const wideFieldStyle = css({
  flex: "1 1 0",
  minWidth: 0,
});

const DIMMED_INK = "field.text.default/50";

const disabledInputStyle = css({ opacity: 0.5 });

const disabledLabelStyle = css({ color: DIMMED_INK });

const banStyle = css({
  display: "block",
  flexShrink: 0,
  marginInlineStart: "auto",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: DIMMED_INK,
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// Clears faster than its pane: the cut's gradient over it fades 80ms behind.
const croppedFieldStyle = css({
  transitionProperty: "opacity",
  transitionDuration: "120ms",
  transitionTimingFunction: "ease-out",
  "[data-presented=false] &": { opacity: 0 },
});

const textareaFrameStyle = css({
  height: "68px",
  alignItems: "flex-start",
  paddingBlock: "6px",
});

const textareaLinesStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  color: "field.text.default",
});

const DISABLED_FIELDS = [
  { label: "Site Address", value: "60%", width: "wide" },
  { label: "Unit", value: "44%", width: "narrow" },
  { label: "Hourly Wage", value: "54%", width: "narrow" },
  { label: "Department", value: "32%", width: "wide" },
] as const;

function DisabledField({
  label,
  frameClassName,
  children,
}: {
  label: string;
  frameClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Field.Label className={disabledLabelStyle}>{label}</Field.Label>
      <Field.Frame className={cx(disabledInputStyle, frameClassName)}>
        {children}
        <span className={banStyle} data-testid="disabled-mark" aria-hidden>
          <BanIcon />
        </span>
      </Field.Frame>
    </>
  );
}

const afterPaneStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  // Only the parts travel (`panelStyle`); moving the pane too would double every distance.
});

const panelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  overflow: "hidden",
  // The Scheduling Layout Redesign's step timing; keep the two diagrams in step.
  "& > *": {
    transitionProperty: "opacity, transform",
    transitionDuration: "260ms",
    transitionTimingFunction: "ease-out",
    "[data-presented=false] &": { opacity: 0, transform: "translateY(-12px)" },
    "&:nth-child(2)": { transitionDelay: "60ms" },
  },
  borderRadius: "md",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
});

const panelHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "lg",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderBottomColor: "field.border.default",
  color: "field.text.default",
});

const panelBodyStyle = css({
  display: "flex",
  gap: "lg",
  paddingInline: "lg",
  paddingBlockEnd: "lg",
});

const detailColumnStyle = css({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "md",
});

const mapColumnStyle = css({
  width: "208px",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: "lg",
});

const detailStyle = css({
  display: "flex",
  flexDirection: "column",
});

const detailLabelStyle = css({
  textStyle: "sidenote",
  color: "field.text.muted",
  whiteSpace: "nowrap",
});

const detailValueStyle = css({
  display: "flex",
  flexDirection: "column",
  color: "field.text.default",
  opacity: 0.5,
});

const detailHintStyle = css({
  display: "flex",
  flexDirection: "column",
  color: "field.text.muted",
  opacity: 0.5,
});

// The SVG is the streets only (`currentColor`); the wash and ring are drawn here.
const mapStyle = css({
  position: "relative",
  width: "208px",
  height: "112px",
  flexShrink: 0,
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  color: "field.text.muted",
  "& > svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

const mapPinStyle = css({
  position: "absolute",
  insetBlockStart: "35px",
  insetInlineStart: "102px",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  color: "field.text.active",
  "& svg": {
    display: "block",
    width: "token(spacing.full)",
    height: "token(spacing.full)",
  },
});

// Pinned to the foot of the stretched row, so both columns' last details share a line.
const detailFooterStyle = css({ marginBlockStart: "auto" });

function Detail({
  label,
  footer,
  children,
}: {
  label: string;
  footer?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx(detailStyle, footer && detailFooterStyle)}>
      <span className={detailLabelStyle}>{label}</span>
      {children}
    </span>
  );
}

export function PositionFieldsConsolidation({
  aspect = "3/2",
}: DemoProps = {}) {
  return (
    <RedesignDiagram
      ariaLabel="Position fields layout"
      bodyHeight={BODY_HEIGHT}
      toggleGap={TOGGLE_GAP}
      aspect={aspect}
      redlines={REDLINES}
      before={{
        className: beforePaneStyle,
        overflows: true,
        children: (
          <>
            <Notice>
              <Notice.Icon className={noticeIconStyle}>
                <InfoIcon />
              </Notice.Icon>
              <Notice.Label className={noticeHeadingStyle}>
                <strong>Default Job Position</strong>
                <span className={noticeHintStyle}>
                  <Skeleton width="97%" />
                  <Skeleton width="21%" />
                </span>
              </Notice.Label>
              <span className={noticeActionStyle}>
                <span className={actionIconStyle} aria-hidden>
                  <EditIcon />
                </span>
                Edit Position
              </span>
            </Notice>

            <div className={fieldsStyle}>
              <div className={fieldRowStyle}>
                {DISABLED_FIELDS.slice(0, 2).map((entry) => (
                  <Field
                    key={entry.label}
                    className={
                      entry.width === "narrow"
                        ? narrowFieldStyle
                        : wideFieldStyle
                    }
                  >
                    <DisabledField label={entry.label}>
                      <Skeleton width={entry.value} />
                    </DisabledField>
                  </Field>
                ))}
              </div>

              <div className={fieldRowStyle}>
                {DISABLED_FIELDS.slice(2).map((entry) => (
                  <Field
                    key={entry.label}
                    className={
                      entry.width === "narrow"
                        ? narrowFieldStyle
                        : wideFieldStyle
                    }
                  >
                    <DisabledField label={entry.label}>
                      <Skeleton width={entry.value} />
                    </DisabledField>
                  </Field>
                ))}
              </div>

              <Field className={croppedFieldStyle}>
                <DisabledField
                  label="Entrance Instructions"
                  frameClassName={textareaFrameStyle}
                >
                  <span className={textareaLinesStyle}>
                    <Skeleton width="91%" />
                    <Skeleton width="14%" />
                  </span>
                </DisabledField>
              </Field>
            </div>
          </>
        ),
      }}
      after={{
        className: afterPaneStyle,
        children: (
          <div className={panelStyle} data-testid="position-summary">
            <div className={panelHeaderStyle}>
              <Skeleton width="27%" />
              <span className={noticeActionStyle}>
                View Position
                <span className={actionIconStyle} aria-hidden>
                  <GotoIcon />
                </span>
              </span>
            </div>

            <div className={panelBodyStyle}>
              <div className={detailColumnStyle}>
                <Detail label="Site Location">
                  <span className={detailValueStyle}>
                    <Skeleton width="72%" />
                    <Skeleton width="17%" />
                  </span>
                </Detail>

                <span className={detailHintStyle}>
                  <Skeleton width="90%" />
                  <Skeleton width="19%" />
                </span>

                <Detail label="Hourly Wage" footer>
                  <span className={detailValueStyle}>
                    <Skeleton width="30%" />
                  </span>
                </Detail>
              </div>

              <div className={mapColumnStyle}>
                <span className={mapStyle} data-testid="site-map">
                  <SiteMapWireframe aria-hidden />
                  <span className={mapPinStyle} aria-hidden>
                    <MapPinIcon />
                  </span>
                </span>

                <Detail label="Department" footer>
                  <span className={detailValueStyle}>
                    <Skeleton width="80%" />
                  </span>
                </Detail>
              </div>
            </div>
          </div>
        ),
      }}
    />
  );
}
