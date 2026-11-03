import type { ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import type { SystemStyleObject } from "../../../../styled-system/types";

// An example's layout as its code shows it, in Tailwind's classes, each drawn by the Panda style it stands for. Panda
// only emits styles it finds written out, so every class an example uses needs its entry here.

export const TAILWIND: Record<string, SystemStyleObject> = {
  flex: css.raw({ display: "flex" }),
  grid: css.raw({ display: "grid" }),
  relative: css.raw({ position: "relative" }),

  "flex-1": css.raw({ flex: "1 1 0%" }),
  "flex-auto": css.raw({ flex: "1 1 auto" }),
  "flex-col": css.raw({ flexDirection: "column" }),
  "flex-wrap": css.raw({ flexWrap: "wrap" }),
  "shrink-0": css.raw({ flexShrink: 0 }),
  "self-stretch": css.raw({ alignSelf: "stretch" }),
  "min-w-0": css.raw({ minWidth: "0" }),

  "items-start": css.raw({ alignItems: "flex-start" }),
  "items-center": css.raw({ alignItems: "center" }),
  "items-end": css.raw({ alignItems: "flex-end" }),
  "justify-center": css.raw({ justifyContent: "center" }),
  "justify-between": css.raw({ justifyContent: "space-between" }),
  "justify-end": css.raw({ justifyContent: "flex-end" }),

  "gap-(--sw-gap-xs)": css.raw({ gap: "var(--sw-gap-xs)" }),
  "gap-(--sw-gap-sm)": css.raw({ gap: "var(--sw-gap-sm)" }),
  "gap-(--sw-gap-md)": css.raw({ gap: "var(--sw-gap-md)" }),
  "gap-(--sw-gap-xl)": css.raw({ gap: "var(--sw-gap-xl)" }),
  "gap-(--sw-gap-3xl)": css.raw({ gap: "var(--sw-gap-3xl)" }),
  "gap-(--sw-gap-xxl)": css.raw({ gap: "var(--sw-gap-xxl)" }),
  "mt-(--sw-margin-3xl)": css.raw({ marginTop: "var(--sw-margin-3xl)" }),
  "p-(--sw-padding-md)": css.raw({ padding: "var(--sw-padding-md)" }),
  "p-(--sw-padding-xl)": css.raw({ padding: "var(--sw-padding-xl)" }),
  "px-(--sw-padding-xxs)": css.raw({ paddingInline: "var(--sw-padding-xxs)" }),
  "px-(--sw-padding-xs)": css.raw({ paddingInline: "var(--sw-padding-xs)" }),
  "px-(--sw-padding-sm)": css.raw({ paddingInline: "var(--sw-padding-sm)" }),
  "px-(--sw-padding-xl)": css.raw({ paddingInline: "var(--sw-padding-xl)" }),
  "py-(--sw-padding-xxs)": css.raw({ paddingBlock: "var(--sw-padding-xxs)" }),
  "py-(--sw-padding-sm)": css.raw({ paddingBlock: "var(--sw-padding-sm)" }),
  "py-(--sw-padding-md)": css.raw({ paddingBlock: "var(--sw-padding-md)" }),
  "py-(--sw-padding-xxl)": css.raw({ paddingBlock: "var(--sw-padding-xxl)" }),
  "py-(--sw-padding-xl)": css.raw({ paddingBlock: "var(--sw-padding-xl)" }),
  "pt-(--sw-padding-xl)": css.raw({ paddingTop: "var(--sw-padding-xl)" }),
  "pb-(--sw-padding-xs)": css.raw({ paddingBottom: "var(--sw-padding-xs)" }),
  "pl-(--sw-padding-xl)": css.raw({ paddingLeft: "var(--sw-padding-xl)" }),
  "pe-[2.75rem]": css.raw({ paddingInlineEnd: "2.75rem" }),
  "pb-[13.75rem]": css.raw({ paddingBottom: "13.75rem" }),
  "pb-[15rem]": css.raw({ paddingBottom: "15rem" }),
  "pb-[15.25rem]": css.raw({ paddingBottom: "15.25rem" }),
  "pb-[18.75rem]": css.raw({ paddingBottom: "18.75rem" }),
  "pb-[21.25rem]": css.raw({ paddingBottom: "21.25rem" }),

  "w-full": css.raw({ width: "100%" }),
  "w-(--sw-width-card)": css.raw({ width: "var(--sw-width-card)" }),
  "w-[0.5rem]": css.raw({ width: "0.5rem" }),
  "w-[1.75rem]": css.raw({ width: "1.75rem" }),
  "w-[8.5rem]": css.raw({ width: "8.5rem" }),
  "w-[8.75rem]": css.raw({ width: "8.75rem" }),
  "w-[9.25rem]": css.raw({ width: "9.25rem" }),
  "w-[10.25rem]": css.raw({ width: "10.25rem" }),
  "w-[9.75rem]": css.raw({ width: "9.75rem" }),
  "w-[10rem]": css.raw({ width: "10rem" }),
  "w-[12.5rem]": css.raw({ width: "12.5rem" }),
  "w-[13rem]": css.raw({ width: "13rem" }),
  "w-[13.75rem]": css.raw({ width: "13.75rem" }),
  "w-[15.5rem]": css.raw({ width: "15.5rem" }),
  "w-[15.75rem]": css.raw({ width: "15.75rem" }),
  "w-[17.5rem]": css.raw({ width: "17.5rem" }),
  "w-[18.5rem]": css.raw({ width: "18.5rem" }),
  "w-[18.75rem]": css.raw({ width: "18.75rem" }),
  "w-[19rem]": css.raw({ width: "19rem" }),
  "w-[19.5rem]": css.raw({ width: "19.5rem" }),
  "w-[21.25rem]": css.raw({ width: "21.25rem" }),
  "w-[21.5rem]": css.raw({ width: "21.5rem" }),
  "w-[22.5rem]": css.raw({ width: "22.5rem" }),
  "w-[23.75rem]": css.raw({ width: "23.75rem" }),
  "w-[25.25rem]": css.raw({ width: "25.25rem" }),
  "w-[26rem]": css.raw({ width: "26rem" }),
  "w-[27.75rem]": css.raw({ width: "27.75rem" }),
  "w-[31.25rem]": css.raw({ width: "31.25rem" }),
  "w-[32.75rem]": css.raw({ width: "32.75rem" }),
  "w-[33.75rem]": css.raw({ width: "33.75rem" }),
  "w-[34.75rem]": css.raw({ width: "34.75rem" }),
  "w-[36.5rem]": css.raw({ width: "36.5rem" }),
  "w-[37.5rem]": css.raw({ width: "37.5rem" }),
  "w-[38.5rem]": css.raw({ width: "38.5rem" }),
  "w-[40rem]": css.raw({ width: "40rem" }),
  "w-[40.5rem]": css.raw({ width: "40.5rem" }),
  "w-[42.25rem]": css.raw({ width: "42.25rem" }),
  "w-[46.75rem]": css.raw({ width: "46.75rem" }),
  "w-[48rem]": css.raw({ width: "48rem" }),
  "w-[49rem]": css.raw({ width: "49rem" }),
  "w-[55rem]": css.raw({ width: "55rem" }),
  "w-[62rem]": css.raw({ width: "62rem" }),
  "h-[1.5rem]": css.raw({ height: "1.5rem" }),
  "h-[1.75rem]": css.raw({ height: "1.75rem" }),
  "h-[2.5rem]": css.raw({ height: "2.5rem" }),
  "h-[3rem]": css.raw({ height: "3rem" }),
  "h-[5.75rem]": css.raw({ height: "5.75rem" }),
  "h-[9.25rem]": css.raw({ height: "9.25rem" }),
  "h-[13.5rem]": css.raw({ height: "13.5rem" }),
  "h-[17.5rem]": css.raw({ height: "17.5rem" }),
  "*:h-[2.75rem]": css.raw({ "& > *": { height: "2.75rem" } }),
  "*:flex-[0_0_11rem]": css.raw({ "& > *": { flex: "0 0 11rem" } }),

  border: css.raw({ borderWidth: "1px", borderStyle: "solid" }),
  "border-(--sw-border-subdued)": css.raw({ borderColor: "var(--sw-border-subdued)" }),
  "rounded-(--sw-radius-xs)": css.raw({ borderRadius: "var(--sw-radius-xs)" }),
  "rounded-(--sw-radius-md)": css.raw({ borderRadius: "var(--sw-radius-md)" }),
  "overflow-hidden": css.raw({ overflow: "hidden" }),

  "bg-(--sw-surface-default)": css.raw({ backgroundColor: "var(--sw-surface-default)" }),
  "bg-(--sw-surface-subdued)": css.raw({ backgroundColor: "var(--sw-surface-subdued)" }),
  "bg-(--sw-surface-warning)": css.raw({ backgroundColor: "var(--sw-surface-warning)" }),
  "bg-(--sw-surface-alert)": css.raw({ backgroundColor: "var(--sw-surface-alert)" }),
  "bg-(--sw-surface-inverted-default)": css.raw({ backgroundColor: "var(--sw-surface-inverted-default)" }),
  "shadow-(--sw-overlay-shadow)": css.raw({ boxShadow: "var(--sw-overlay-shadow)" }),
  "text-(--sw-glyph-subdued)": css.raw({ color: "var(--sw-glyph-subdued)" }),
  "text-(--sw-glyph-placeholder)": css.raw({ color: "var(--sw-glyph-placeholder)" }),
  "text-(--sw-glyph-selected)": css.raw({ color: "var(--sw-glyph-selected)" }),
  "text-(--sw-glyph-success)": css.raw({ color: "var(--sw-glyph-success)" }),
  "text-(--sw-glyph-warning)": css.raw({ color: "var(--sw-glyph-warning)" }),
  "text-(--sw-glyph-alert)": css.raw({ color: "var(--sw-glyph-alert)" }),
  "text-(--sw-glyph-disabled)": css.raw({ color: "var(--sw-glyph-disabled)" }),
};

function classOf(tw: string) {
  return css(
    ...tw.split(/\s+/).map((name) => {
      const style = TAILWIND[name];
      if (!style) throw new Error(`No Panda style for Tailwind's ${name} in ds-tailwind.tsx`);
      return style;
    }),
  );
}

/** A `div` laid out by Tailwind's classes `tw`, written so in the code view. */
export function Div({ tw, children }: { tw: string; children?: ReactNode }) {
  return <div className={classOf(tw)}>{children}</div>;
}

Div.tag = "div";

/** A `span` laid out by Tailwind's classes `tw`, for inside phrasing content. */
export function Span({ tw, children }: { tw: string; children?: ReactNode }) {
  return <span className={classOf(tw)}>{children}</span>;
}

Span.tag = "span";
