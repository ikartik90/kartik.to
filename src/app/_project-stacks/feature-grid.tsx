import type { ComponentType, SVGProps } from "react";
import { css } from "../../../styled-system/css";
import { Dots } from "./dots";
import { Marked } from "./marked";

// An icon, a title and a line each: three to a row, except two or four, which go two to a row. On a phone each icon
// sits to the left of its words, as the UX gaps' legends set their marks.

export interface Feature {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  /** `*`s mark what's highlighted. */
  body: string;
}

const gridStyle = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "repeat(3, 1fr)" },
  columnGap: "xxl",
  rowGap: { base: "3xl", md: "4xl" },
  // An attribute, not :has(): WebKit doesn't re-match :has() on child-count selectors when items change.
  "&:is([data-count='2'], [data-count='4'])": { md: { gridTemplateColumns: "repeat(2, 1fr)" } },
  "& > div": {
    display: "flex",
    flexDirection: "column",
    gap: "md",
    mdDown: {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      columnGap: "md",
      rowGap: "md",
      "& > :not(:first-child)": { gridColumn: 2 },
    },
  },
});
// The metric card's frame and dotted ground. Beside its words on a phone, centred on the title's first line (`1lh`
// the title's), the line straight under the title.
const iconBoxStyle = css({
  position: "relative",
  isolation: "isolate",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.4xl)",
  height: "token(spacing.4xl)",
  marginBlockEnd: "sm",
  overflow: "hidden",
  borderRadius: "lg",
  boxShadow: "inset 0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.neutral.500) 25%, transparent)",
  color: "text.highlight",
  mdDown: {
    gridRow: "1 / span 2",
    textStyle: "bodyLarge",
    marginBlockStart: "calc((1lh - token(spacing.4xl)) / 2)",
    marginBlockEnd: 0,
  },
});
export const featureTitleStyle = css({ textStyle: "bodyLarge", color: "text.title" });
export const featureBodyStyle = css({ textStyle: "bodySmall", color: "text.body", textWrap: "pretty" });

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className={gridStyle} data-count={features.length}>
      {features.map(({ Icon, title, body }) => (
        <div key={title}>
          <span className={iconBoxStyle} data-feature-icon="">
            <Dots inset />
            <Icon aria-hidden />
          </span>
          <span className={featureTitleStyle}>{title}</span>
          <span className={featureBodyStyle}>
            <Marked text={body} />
          </span>
        </div>
      ))}
    </div>
  );
}
