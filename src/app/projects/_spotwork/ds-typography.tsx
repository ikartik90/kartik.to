"use client";

import { Children, Fragment, type ReactElement, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { Variants, defineStory } from "./ds-story";
import { TEXT_STYLES, specOf, type TextStyle } from "./ds-tokens";
import { PixelSwitch, usePixels } from "./ds-ui";
import { Divider, Typography, type GlyphColor } from "./ui";

// SW Curie's text styles as one component, each named for what it sets, as the portfolio's Typography is. Every
// component and page sets its text through it.

// A specimen for each of SW Curie's two faces.
const SPECIMENS: Record<TextStyle["face"], string> = {
  heading: "The principles of the typographic craft are difficult to master",
  body: "The goal of typography is to relate font size, line height, and line width in a proportional way that maximizes beauty and makes reading easier and more pleasant.",
};

const TAGS: Partial<Record<TextStyle["variant"], "h1" | "h2" | "h3" | "h4" | "p">> = {
  title: "h1",
  heading: "h2",
  subheading: "h3",
  subheadingSmall: "h4",
  bodyLarge: "p",
  bodyStrong: "p",
  body: "p",
};

// Badge's style is shown on Badge's own page.
const STYLES = TEXT_STYLES.filter((style) => style.variant !== "badge");

const COLORS: [label: string, color?: GlyphColor][] = [
  ["Default"],
  ["Subdued", "subdued"],
  ["Placeholder", "placeholder"],
  ["Info", "info"],
  ["Success", "success"],
  ["Warning", "warning"],
  ["Alert", "alert"],
  ["Disabled", "disabled"],
];

const specimensStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

const specimenStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-sm)",
  "& > [data-head]": { display: "flex", alignItems: "baseline", gap: "var(--sw-gap-md)" },
  // At a card's width, where the app's text sits, which wraps every style and so shows its line height.
  "& > :last-child": { maxWidth: "var(--sw-width-card)" },
});

/** The styles' specimens, a line between each. The code shows the specimens alone. */
function Specimens({ children }: { children: ReactNode }) {
  return (
    <div className={specimensStyle}>
      {Children.toArray(children).map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <Divider />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

Specimens.unwrap = ({ children }: { children: ReactNode }) => children;

/** `children`, a Typography, under its style's `name` and spec. The code shows `children` alone. */
function Specimen({ style, children }: { style: TextStyle; children: ReactElement }) {
  const pixels = usePixels();
  return (
    <div className={specimenStyle}>
      <div data-head="">
        <Typography variant="metadataStrong">{style.name}</Typography>
        <Typography variant="metadata" color="subdued">
          {specOf(style, pixels)}
        </Typography>
      </div>
      {children}
    </div>
  );
}

Specimen.unwrap = ({ children }: { children: ReactNode }) => children;

export const TYPOGRAPHY = defineStory({
  id: "Typography",
  figma: "Text Styles",
  examples: [
    {
      render: () => (
        <Typography tag="h1" variant="title">
          {SPECIMENS.heading}
        </Typography>
      ),
    },
    {
      title: "Variant",
      action: <PixelSwitch />,
      layout: "fill",
      render: () => (
        <Specimens>
          {STYLES.map((style) => (
            <Specimen key={style.variant} style={style}>
              <Typography tag={TAGS[style.variant]} variant={style.variant}>
                {SPECIMENS[style.face]}
              </Typography>
            </Specimen>
          ))}
        </Specimens>
      ),
    },
    {
      title: "Color",
      render: () => (
        <Variants>
          {COLORS.map(([label, color]) => (
            <Typography key={label} variant="body" color={color}>
              {label}
            </Typography>
          ))}
        </Variants>
      ),
    },
  ],
});
