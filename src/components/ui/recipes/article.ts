import { defineRecipe } from "@pandacss/dev";

// check-small.svg / cross-small.svg as masks, hand-synced with the files. Keep `fill='none'`, or
// the glyph masks as a filled blob.
const CHECK_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.05994 10.1813L9.14253 12.6249L12.9396 7.62488' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const CROSS_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.5 7.5L7.5 12.5M12.5 12.5L7.5 7.5' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

// A copy of blockquote.svg's path: re-inline it whenever the artwork changes.
const QUOTE_GLYPH_PATH =
  "M10.9494 8.65295C11.8225 8.41923 12.7194 8.93811 12.9533 9.81116C13.0483 10.1658 13.0219 10.5421 12.8772 10.8795C11.447 14.2114 11.3904 18.3371 12.7082 23.2555C15.3871 22.5377 18.0665 21.82 20.7453 21.1022C21.8548 20.8051 22.9949 21.4635 23.2922 22.5729L27.5989 38.6461C27.8962 39.7557 27.2378 40.8957 26.1282 41.193L12.0647 44.9615C10.9551 45.2589 9.81415 44.6005 9.51683 43.4908C8.26072 38.803 7.00438 34.1152 5.74827 29.4274C3.05655 19.3817 8.94032 9.1913 10.9494 8.65295ZM33.053 9.151C33.7647 8.96045 34.496 9.38266 34.6867 10.0944C34.7642 10.3835 34.7422 10.6903 34.6242 10.9655C33.4584 13.6815 33.4122 17.0449 34.4866 21.0543C36.6703 20.4692 38.8546 19.8836 41.0383 19.2985C41.9427 19.0564 42.8721 19.5934 43.1145 20.4977L46.6252 33.6002C46.8675 34.5047 46.3305 35.434 45.426 35.6764L33.9621 38.7487C33.0576 38.991 32.1274 38.454 31.885 37.5494C30.8611 33.7282 29.8376 29.9068 28.8137 26.0856C26.6195 17.8966 31.4152 9.58985 33.053 9.151Z";

const quoteGlyphMask = (paint: string) =>
  `url("data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${QUOTE_GLYPH_PATH}' ${paint}/%3E%3C/svg%3E")`;

const QUOTE_GLYPH_FILL_MASK = quoteGlyphMask("fill='white'");

// Stroked at 2px for a 1px edge: the stroke straddles the path and its outer half is masked off.
const QUOTE_GLYPH_STROKE_MASK = quoteGlyphMask(
  "fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'",
);

// A fixed 24px column, so every list style's prose starts at the same x.
const markerAlignmentBox = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "token(sizes.listMarker)",
  minWidth: "token(sizes.listMarker)",
  marginBlockStart: "xs",
  userSelect: "none",
  pointerEvents: "none",
} as const;

export const inlineCode = defineRecipe({
  className: "inline-code",
  description: "Inline code inside article text.",
  base: {
    textStyle: "inlineCode",
    background: "bg.surface",
    paddingInline: "sm",
    paddingBlock: "xs",
    borderRadius: "sm",
  },
});

export const articleLink = defineRecipe({
  className: "article-link",
  description:
    "A link inside article text, with an underline that turns into the brand gradient on hover.",
  base: {
    textDecorationLine: "none",
    color: "text.default",
    paddingBottom: "xs",
    backgroundImage:
      "token(colors.bg.brandedEmphasis), linear-gradient(color-mix(in srgb, var(--colors-text-body) 50%, transparent), color-mix(in srgb, var(--colors-text-body) 50%, transparent))",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 100%",
    backgroundSize: "100% 0, 100% token(spacing.xxs)",
    WebkitBoxDecorationBreak: "clone",
    boxDecorationBreak: "clone",
    transition: "color 150ms ease, background-size 150ms ease",
    _hover: {
      color: "text.title",
      backgroundSize:
        "100% token(spacing.xxs), 100% token(spacing.xxs)",
    },
  },
});

export const articleUnderline = defineRecipe({
  className: "article-underline",
  description: "Underlined text inside an article.",
  base: {
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textUnderlineOffset: "0.15em",
  },
});

export const articleStrikethrough = defineRecipe({
  className: "article-strikethrough",
  description: "Struck-through text inside an article.",
  base: {
    textDecorationLine: "line-through",
  },
});

export const articleHighlight = defineRecipe({
  className: "article-highlight",
  description:
    "Highlighted text inside an article, on a tint of the brand accent.",
  base: {
    backgroundColor: "bg.highlight",
    color: "text.highlight",
    paddingInline: "xxs",
    paddingBlock: "xxs",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    "& :is(strong, b, em, i, u, s, code, a)": {
      color: "inherit",
    },
  },
});

export const articleSidenote = defineRecipe({
  className: "article-sidenote",
  description: "The annotated text and number that a margin note attaches to.",
  base: {
    cursor: "default",
    "& :is(strong, b, em, i, u, s, code, a)": { color: "inherit" },
  },
});

export const articleSidenoteText = defineRecipe({
  className: "article-sidenote-text",
  description: "The annotated words of a margin note, with a dotted underline.",
  base: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    textDecorationColor:
      "color-mix(in srgb, var(--colors-text-body) 50%, transparent)",
    textDecorationThickness: "token(spacing.xxs)",
    textUnderlineOffset: "token(spacing.xs)",
  },
});

export const articleSidenoteRef = defineRecipe({
  className: "article-sidenote-ref",
  description:
    "The superscript number after annotated text, read from `data-sidenote-number`.",
  base: {
    verticalAlign: "super",
    marginInlineStart: "3xs",
    fontSize: "0.7em",
    fontWeight: "medium",
    userSelect: "none",
    // Plain inline, not inline-block, which would let the ordinal wrap onto a line of its own.
    display: "inline",
    _after: {
      content: "attr(data-sidenote-number)",
      background: "bg.brandedEmphasis",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
    },
  },
});

export const codeBlock = defineRecipe({
  className: "code-block",
  description: "A code block inside an article.",
  base: {
    textStyle: "code",
    background: "bg.surface",
    borderRadius: "md",
    padding: "3xl",
    overflowX: "auto",
    color: "text.default",
    whiteSpace: "pre",
    _focusVisible: { focusVisibleRing: "none" },
  },
});

export const articleShowcase = defineRecipe({
  className: "article-showcase",
  description:
    "A full-width block for figures and embedded components in an article, with its caption at text width.",
  base: {
    width: "token(spacing.full)",
    display: "flex",
    flexDirection: "column",
    gap: "md",
    alignItems: "center",
    // The caption keeps the text column's measure. Its `text-wrap` can't be set here: Typography's
    // atomic `pretty` sits in a later layer.
    "& > figcaption": {
      maxWidth: "token(sizes.articleContent)",
      textAlign: "center",
    },
  },
});

export const articleBlockquoteShell = defineRecipe({
  className: "article-blockquote-shell",
  description:
    "Layout of an article blockquote: the quote mark beside the quote.",
  base: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "sm",
  },
});

export const articleBlockquoteMark = defineRecipe({
  className: "article-blockquote-mark",
  description:
    "The large quote mark of an article blockquote, in the brand gradient.",
  base: {
    position: "relative",
    width: "token(sizes.quoteMark)",
    height: "token(sizes.quoteMark)",
    flexShrink: 0,
    pointerEvents: "none",
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      inset: "0",
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    },
    // `opacity`, not a 15% copy of the gradient, so the two can't drift apart.
    "&::before": {
      background: "bg.brandedEmphasis",
      opacity: 0.15,
      maskImage: QUOTE_GLYPH_FILL_MASK,
      WebkitMaskImage: QUOTE_GLYPH_FILL_MASK,
    },
    // The 2px stroke intersected with the body keeps only its inner 1px.
    "&::after": {
      background: "bg.brandedEmphasis",
      maskImage: `${QUOTE_GLYPH_STROKE_MASK}, ${QUOTE_GLYPH_FILL_MASK}`,
      maskComposite: "intersect",
      WebkitMaskImage: `${QUOTE_GLYPH_STROKE_MASK}, ${QUOTE_GLYPH_FILL_MASK}`,
      WebkitMaskComposite: "source-in",
    },
  },
});

export const articleBlockquote = defineRecipe({
  className: "article-blockquote",
  description: "The text style of an article blockquote.",
  base: {
    textStyle: "quote",
    color: "text.default",
    wordBreak: "break-word",
    paddingBlockStart: "lg",
  },
});

export const articleHeadingShell = defineRecipe({
  className: "article-heading-shell",
  description:
    "Stacks an optional eyebrow caption above an article subheading.",
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "sm",
  },
});

export const articleSubheadingCaption = defineRecipe({
  className: "article-subheading-caption",
  description:
    "The eyebrow caption above an article subheading, in brand gradient text.",
  base: {
    textStyle: "caption",
    width: "fit-content",
    wordBreak: "break-word",
    // Only once there is text, or an empty editor field's placeholder turns transparent.
    "&:not(:empty):not([data-empty])": {
      background: "bg.brandedEmphasis",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
  },
});

export const articleBlockquoteBody = defineRecipe({
  className: "article-blockquote-body",
  description:
    "The column beside the quote mark, holding the quote and its citation.",
  base: {
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "sm",
  },
});

export const articleBlockquoteCite = defineRecipe({
  className: "article-blockquote-cite",
  description: "The citation line under an article blockquote.",
  base: {
    textStyle: "caption",
    fontStyle: "normal",
    color: "text.body/50",
    wordBreak: "break-word",
  },
});

export const articleListItemShell = defineRecipe({
  className: "article-list-item-shell",
  description: "An article list item's row: the marker beside the item's text.",
  base: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "md",
  },
});

export const listMarkerBox = defineRecipe({
  className: "list-marker-box",
  description: "The fixed-width column that centres a numbered list's number.",
  base: {
    ...markerAlignmentBox,
    width: "token(sizes.listMarker)",
  },
});

export const listMarker = defineRecipe({
  className: "list-marker",
  description:
    "A numbered list's number: a small gradient pill holding the digits.",
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "token(spacing.xl)",
    minWidth: "token(spacing.xl)",
    paddingInline: "xs",
    // Optical centring: digits sit 0.0535em low in Switzer, doubled because a centred flex item
    // shifts by half its padding. Re-measure if the typeface changes.
    paddingBlockEnd: "0.107em",
    borderRadius: "lg",
    // Two layers on one element: a pseudo-element chip would cover the `background-clip: text` digits.
    backgroundImage:
      "token(colors.bg.brandedEmphasis), linear-gradient(token(colors.bg.listMarker) 0 0)",
    backgroundClip: "text, padding-box",
    WebkitBackgroundClip: "text, padding-box",
    WebkitTextFillColor: "transparent",
    textStyle: "caption",
    fontWeight: "medium",
    textAlign: "center",
    whiteSpace: "nowrap",
    userSelect: "none",
    pointerEvents: "none",
  },
});

export const listBullet = defineRecipe({
  className: "list-bullet",
  description:
    "A bulleted list's marker: a small gradient dot beside the first line.",
  base: {
    ...markerAlignmentBox,
    "&::before": {
      content: '""',
      display: "block",
      width: "token(sizes.listBullet)",
      height: "token(sizes.listBullet)",
      borderRadius: "token(spacing.half)",
      background: "bg.brandedEmphasis",
    },
  },
});

export const listBulletIcon = defineRecipe({
  className: "list-bullet-icon",
  description: "The column that holds a check or cross list marker.",
  base: { ...markerAlignmentBox },
});

export const listBulletCircle = defineRecipe({
  className: "list-bullet-circle",
  description:
    "A check or cross list marker: a small circle holding the `glyph`.",
  base: {
    position: "relative",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "token(spacing.xl)",
    height: "token(spacing.xl)",
    borderRadius: "token(spacing.half)",
    backgroundColor: "bg.listMarker",
    "&::after": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "token(sizes.listBulletGlyph)",
      height: "token(sizes.listBulletGlyph)",
      transform: "translate(-50%, -50%)",
      background: "bg.brandedEmphasis",
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      pointerEvents: "none",
    },
  },
  variants: {
    glyph: {
      check: {
        "&::after": {
          maskImage: CHECK_GLYPH_MASK,
          WebkitMaskImage: CHECK_GLYPH_MASK,
        },
      },
      cross: {
        "&::after": {
          maskImage: CROSS_GLYPH_MASK,
          WebkitMaskImage: CROSS_GLYPH_MASK,
        },
      },
    },
  },
});

export const articleListItemContent = defineRecipe({
  className: "article-list-item-content",
  description: "The text column of an article list item.",
  base: {
    flex: "1 1 auto",
    minWidth: 0,
    textStyle: "bodyLarge",
    color: "text.body",
    wordBreak: "break-word",
  },
});

export const articleMetric = defineRecipe({
  className: "article-metric",
  description: "A metric callout in an article: a large value above its label.",
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "sm",
    wordBreak: "break-word",
  },
});

export const articleMetricCaption = defineRecipe({
  className: "article-metric-caption",
  description: "The optional caption above a metric's value.",
  base: {
    textStyle: "caption",
    color: "text.default",
    textAlign: "left",
    wordBreak: "break-word",
  },
});

export const articleMetricValue = defineRecipe({
  className: "article-metric-value",
  description: "A metric's value, in large brand gradient text.",
  base: {
    textStyle: "title",
    width: "fit-content",
    maxWidth: "token(spacing.full)",
    wordBreak: "break-word",
    // Only once there is text; see articleSubheadingCaption.
    "&:not(:empty):not([data-empty])": {
      background: "bg.brandedEmphasis",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
  },
});

export const articleMetricLabel = defineRecipe({
  className: "article-metric-label",
  description: "The label under a metric's value.",
  base: {
    textStyle: "bodyLarge",
    color: "text.default",
    wordBreak: "break-word",
  },
});

export const horizontalRule = defineRecipe({
  className: "horizontal-rule",
  description:
    "A horizontal rule in an article, the same in the reader and the editor.",
  base: {
    border: "none",
    height: "token(spacing.3xs)",
    backgroundColor: "border.divider",
    marginBlock: "3xl",
  },
});
