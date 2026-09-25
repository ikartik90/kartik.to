import { defineRecipe } from "@pandacss/dev";

/**
 * check-small.svg / cross-small.svg as masks, so the brand gradient can be
 * painted through them. A mask reads alpha: keep `fill='none'` or the glyph
 * masks as a filled blob instead of its stroke. Hand-synced with the .svg files.
 */
const CHECK_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.05994 10.1813L9.14253 12.6249L12.9396 7.62488' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const CROSS_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.5 7.5L7.5 12.5M12.5 12.5L7.5 7.5' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

/**
 * blockquote.svg as two masks off the SAME path — `fill` gives the body,
 * `stroke` the contour — so the mark can be a translucent wash with a solid
 * edge inside it. Two layers, because one mask reveals one colour. The glyph's
 * lean is drawn into the artwork, not CSS.
 *
 * NOTE: a COPY of the .svg, not a reference — nothing imports that file.
 * Re-inline the path whenever the artwork changes or the two silently drift.
 */
const QUOTE_GLYPH_PATH =
  "M10.9494 8.65295C11.8225 8.41923 12.7194 8.93811 12.9533 9.81116C13.0483 10.1658 13.0219 10.5421 12.8772 10.8795C11.447 14.2114 11.3904 18.3371 12.7082 23.2555C15.3871 22.5377 18.0665 21.82 20.7453 21.1022C21.8548 20.8051 22.9949 21.4635 23.2922 22.5729L27.5989 38.6461C27.8962 39.7557 27.2378 40.8957 26.1282 41.193L12.0647 44.9615C10.9551 45.2589 9.81415 44.6005 9.51683 43.4908C8.26072 38.803 7.00438 34.1152 5.74827 29.4274C3.05655 19.3817 8.94032 9.1913 10.9494 8.65295ZM33.053 9.151C33.7647 8.96045 34.496 9.38266 34.6867 10.0944C34.7642 10.3835 34.7422 10.6903 34.6242 10.9655C33.4584 13.6815 33.4122 17.0449 34.4866 21.0543C36.6703 20.4692 38.8546 19.8836 41.0383 19.2985C41.9427 19.0564 42.8721 19.5934 43.1145 20.4977L46.6252 33.6002C46.8675 34.5047 46.3305 35.434 45.426 35.6764L33.9621 38.7487C33.0576 38.991 32.1274 38.454 31.885 37.5494C30.8611 33.7282 29.8376 29.9068 28.8137 26.0856C26.6195 17.8966 31.4152 9.58985 33.053 9.151Z";

const quoteGlyphMask = (paint: string) =>
  `url("data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${QUOTE_GLYPH_PATH}' ${paint}/%3E%3C/svg%3E")`;

const QUOTE_GLYPH_FILL_MASK = quoteGlyphMask("fill='white'");

/**
 * Stroked at 2px — DOUBLE the 1px edge it draws. An SVG stroke straddles its
 * path, so intersecting with the body mask discards the outer half.
 */
const QUOTE_GLYPH_STROKE_MASK = quoteGlyphMask(
  "fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'",
);

/**
 * The column every list marker occupies — a fixed 24px box centring whatever
 * ink the marker draws, on the first text line via `marginBlockStart` of
 * (28px bodyLarge line box - 24) / 2. Fixed so the prose column starts at the
 * same x for every list style, whatever size the ink inside happens to be.
 */
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
  description: "Inline code mark inside article prose.",
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
    "Hyperlink inside article prose. The underline is drawn as two stacked background bars, not text-decoration, so the hover state can be the brand gradient (text-decoration-color can't be a gradient): a neutral color-mix bar (text.body @ 50%) with the brandedEmphasis gradient layered on top, hidden at rest and grown in on hover. box-decoration-break:clone repeats the bars on each line of a wrapped link.",
  base: {
    // The underline is the background bars below, so suppress the UA's.
    textDecorationLine: "none",
    color: "text.default",
    paddingBottom: "xs",
    backgroundImage:
      "token(colors.bg.brandedEmphasis), linear-gradient(color-mix(in srgb, var(--colors-text-body) 50%, transparent), color-mix(in srgb, var(--colors-text-body) 50%, transparent))",
    backgroundRepeat: "no-repeat",
    // Bottom-anchored, so the gradient grows upward to exactly cover
    // the neutral bar on hover.
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
  description: "Solid underline mark inside article prose.",
  base: {
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textUnderlineOffset: "0.15em",
  },
});

export const articleStrikethrough = defineRecipe({
  className: "article-strikethrough",
  description: "Strikethrough mark inside article prose.",
  base: {
    textDecorationLine: "line-through",
  },
});

export const articleHighlight = defineRecipe({
  className: "article-highlight",
  description:
    "Highlight mark (<mark>) inside article prose — the brand accent at 15% behind the accent at full strength (pink in light, orange in dark). Flat colour, not the brand gradient, so the marked text stays legible as prose rather than reading as a badge.",
  base: {
    backgroundColor: "bg.highlight",
    color: "text.highlight",
    paddingInline: "xxs",
    paddingBlock: "xxs",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    // Keep nested marks on the highlight's own colour (see self-improvement.md).
    "& :is(strong, b, em, i, u, s, code, a)": {
      color: "inherit",
    },
  },
});

export const articleSidenote = defineRecipe({
  className: "article-sidenote",
  description:
    "Sidenote annotation mark — wraps the annotated run of prose plus its ordinal superscript. Carries an `anchor-name` (set inline, per note) the aside card positions against; the dotted underline lives on the inner articleSidenoteText span.",
  base: {
    cursor: "default",
    // Nested marks keep their own colour; only the underline is added.
    "& :is(strong, b, em, i, u, s, code, a)": { color: "inherit" },
  },
});

export const articleSidenoteText = defineRecipe({
  className: "article-sidenote-text",
  description:
    "The annotated prose inside a sidenote mark — a dotted underline signals the margin note. The underline sits HERE rather than on the wrapper so it never runs beneath the ordinal superscript, which is a sibling of this span (see articleSidenoteRef).",
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
    "Superscript ordinal after an annotated run. The digit is read from the `data-sidenote-number` attribute — assigned from the AST-derived ordinal (see collectSidenotes / SidenoteLayer + the reader). A CSS counter was avoided because Chromium doesn't re-resolve `counter()` generated content when a preceding counter-incrementing element is removed, so ordinals wouldn't decrement live. Painted in the brand gradient.",
  base: {
    verticalAlign: "super",
    marginInlineStart: "3xs",
    fontSize: "0.7em",
    fontWeight: "medium",
    userSelect: "none",
    // A PLAIN inline, deliberately: an atomic inline (inline-block)
    // carries an unconditional soft-wrap opportunity before it, so the
    // ordinal could be orphaned onto a line of its own. Non-atomic, it
    // travels with the last annotated word.
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
  description:
    "Code block container for article content. Inherited text styles cascade to <code> children; focus ring suppressed for contentEditable use.",
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
    "Wide showcase container for figures and embeddable components inside article content. The block itself spans the article's full 960 column; its caption wraps at the 640 text column, since a caption is prose and reads at the measure the paragraphs around it do.",
  base: {
    width: "token(spacing.full)",
    display: "flex",
    flexDirection: "column",
    gap: "md",
    alignItems: "center",
    // The picture is 960 wide; the words under it are not. A caption
    // set to the block's width would run to a measure no other prose
    // in the article uses, so it takes the text column's — centred
    // under the block by the `alignItems` above, exactly as a shorter
    // caption already sits. `textAlign` centres the LINES too, so a
    // caption that wraps still reads as centred rather than as a
    // ragged left column — the same alignment the editor's own
    // caption has always had.
    // (The caption's `text-wrap` cannot be set here — `Typography`'s
    // own `pretty` is an atomic utility, a later layer than this one,
    // so the balance is a `wrap` variant on the type itself.)
    "& > figcaption": {
      maxWidth: "token(sizes.articleContent)",
      textAlign: "center",
    },
  },
});

export const articleBlockquoteShell = defineRecipe({
  className: "article-blockquote-shell",
  description:
    "Blockquote layout shell — quote mark and text in normal flow (Figma 358:20 light, 358:26 dark).",
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
    "Quote mark (52×52) — a `bg.brandedEmphasis` body at 15% with a 1px full-strength inner edge of that same gradient running inside its contour, each a mask off the same blockquote glyph path. Two layers because one mask can only reveal one colour, and both are PSEUDO-ELEMENTS rather than one being the element itself: a mask clips its element's descendants too, so a fill mask on the box would have cut away the outer half of the stroke drawn inside it. As siblings they clip independently, and ::after paints over ::before, putting the outline on top of the body. The glyph's lean is drawn into the artwork, so no CSS rotation here.",
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
    // Both layers paint the SAME gradient over the same box, so the
    // edge is the full-strength version of the ramp the body is washing
    // out — the two stay in register at every point of the glyph.
    // `opacity` rather than a second 15% gradient token: duplicating
    // the stops would let the copy drift if `bg.brandedEmphasis` is
    // retuned, and multiplying a fully opaque layer by 0.15 is the same
    // result as authoring the stops at 15% alpha.
    "&::before": {
      background: "bg.brandedEmphasis",
      opacity: 0.15,
      maskImage: QUOTE_GLYPH_FILL_MASK,
      WebkitMaskImage: QUOTE_GLYPH_FILL_MASK,
    },
    // The 2px stroke INTERSECTED with the body, keeping only the half
    // inside the glyph. An inset `box-shadow` can't do this: it draws
    // on the element's BOX, not along the masked contour.
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
  description: "Blockquote typography inside article prose.",
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
    "Column that stacks an optional eyebrow caption above a subheading.",
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "sm",
  },
});

export const articleSubheadingCaption = defineRecipe({
  className: "article-subheading-caption",
  description:
    "Eyebrow caption above a subheading — brand gradient text (same gradient as numbered-list ordinals) revealed via background-clip once populated.",
  base: {
    textStyle: "caption",
    width: "fit-content",
    wordBreak: "break-word",
    // Only clip once there is text, or an empty editor field turns its
    // own placeholder transparent.
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
    "Column beside the quote mark that stacks the quote text and an optional citation.",
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
  description:
    "Citation line beneath a blockquote — caption typography, upright (not italic).",
  base: {
    textStyle: "caption",
    fontStyle: "normal",
    color: "text.body/50",
    wordBreak: "break-word",
  },
});

export const articleListItemShell = defineRecipe({
  className: "article-list-item-shell",
  description:
    "Numbered-list item row — ordinal badge and text content in a flex row (Figma 413:684 light, 413:688 dark). No width: inherits the `article > *` content-column width (a recipe-layer width would beat the base-layer rule and align the marker with showcase blocks).",
  base: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "md",
  },
});

export const listMarkerBox = defineRecipe({
  className: "list-marker-box",
  description:
    "Alignment box for a numbered-list ordinal — the shared 24px marker column centring the `listMarker` pill inside it, exactly as `listBulletIcon` centres a `listBulletCircle`. The pill is narrower than the column and grows with its digit count, so it needs a fixed box around it or a numbered list's prose column would sit left of a bulleted one's. `width` is PINNED rather than left to `minWidth`: a 3+ digit pill outgrows 24px, and on min-width alone only that one item's column would widen, leaving the prose ragged down its own list. Pinned, such a pill overhangs the column instead — symmetrically, since it is centred — eating into the 8px gap rather than moving the text.",
  base: {
    ...markerAlignmentBox,
    width: "token(sizes.listMarker)",
  },
});

export const listMarker = defineRecipe({
  className: "list-marker",
  description:
    "Numbered-list ordinal badge — 16px gradient pill with theme-flipped caption digits; circular at a single digit, widening for zero-padded multi-digit ordinals. Sized off `spacing.xl` to match the 16px check/cross disc. Vertical placement belongs to its `listMarkerBox` wrapper, not here.",
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "token(spacing.xl)",
    minWidth: "token(spacing.xl)",
    paddingInline: "xs",
    // Optical centring: flex centring aligns the font's CONTENT AREA,
    // but digits have no descender, so their ink sits low by 0.642px in
    // Switzer at 12px = 0.0535em. Doubled here, since a centred flex
    // item shifts up by HALF its padding. Re-measure only if the
    // typeface changes.
    paddingBlockEnd: "0.107em",
    borderRadius: "lg",
    // TWO layers on ONE element: the gradient clipped to the glyphs,
    // the chip clipped to the padding box. A pseudo-element can't
    // supply the chip — `background-clip: text` paints the digits in
    // the BACKGROUND layer, which any child would cover.
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
    "Bulleted-list marker — 10px circular gradient dot centered on the first text line, within the shared `markerAlignmentBox` footprint every list style uses.",
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
  description:
    "Check/cross bulleted-list marker — the shared `markerAlignmentBox` (matching the dot and the numbered ordinal, so content stays aligned across list styles) centring a `listBulletCircle` glyph.",
  base: { ...markerAlignmentBox },
});

export const listBulletCircle = defineRecipe({
  className: "list-bullet-circle",
  description:
    "The 16×16 circle inside a check/cross bullet marker (Figma 476:278 check, 474:38 cross) — a flat `bg.listMarker` chip holding a brand-gradient glyph, which overflows it slightly. The glyph is a masked pseudo-element rather than an inline SVG: those icons paint with `stroke=\"currentColor\"`, and currentColor can only ever be a flat colour, so a gradient has to arrive the way the blockquote mark's does — filling a box that the glyph's alpha masks to shape. Pick the shape with the `glyph` variant; the renderer and editor pass it instead of a child icon.",
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
  description:
    "List item text column beside the ordinal badge or bullet dot.",
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
  description:
    "Metric callout — a large brand-gradient value stacked over a descriptive label (Figma 456:979 light / 456:968 dark). No width: inherits the `article > *` content-column width so it aligns with prose.",
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
  description:
    "Metric caption — optional eyebrow above the value; same style as an image caption but left-aligned (the metric column is flush-left).",
  base: {
    textStyle: "caption",
    color: "text.default",
    textAlign: "left",
    wordBreak: "break-word",
  },
});

export const articleMetricValue = defineRecipe({
  className: "article-metric-value",
  description:
    "Metric value — brand gradient display text (theme-directional gradient) revealed via background-clip once populated, mirroring the subheading eyebrow.",
  base: {
    textStyle: "title",
    width: "fit-content",
    maxWidth: "token(spacing.full)",
    wordBreak: "break-word",
    // Only clip once there is text (see articleSubheadingCaption).
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
  description:
    "Metric label — descriptive line beneath the value; paragraph text style, standard text colour (neutral.600 light / neutral.200 dark per Figma).",
  base: {
    textStyle: "bodyLarge",
    color: "text.default",
    wordBreak: "break-word",
  },
});

export const horizontalRule = defineRecipe({
  className: "horizontal-rule",
  description:
    "Horizontal rule rendered identically on both read-only and edit article surfaces.",
  base: {
    border: "none",
    height: "token(spacing.3xs)",
    backgroundColor: "border.divider",
    marginBlock: "3xl",
  },
});
