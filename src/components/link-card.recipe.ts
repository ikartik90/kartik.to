import { defineSlotRecipe } from "@pandacss/dev";
import { CARD_SCRIM_MIN_SHARE, cardWashGradient } from "../utils/card-scrim";
import { aspectRatioEntries } from "./ui/recipes/shared";

const linkCardAspectVariants = Object.fromEntries(
  aspectRatioEntries.map(([ratio, [w, h]]) => [
    ratio,
    { root: { aspectRatio: `${w} / ${h}` } },
  ]),
);

const CARD_SCRIM_MIN_HEIGHT = `${CARD_SCRIM_MIN_SHARE * 100}%`;

const CARD_WASH = cardWashGradient(
  (alpha) =>
    `color-mix(in srgb, token(colors.bg.surface) ${(alpha * 100).toFixed(1)}%, transparent)`,
);

export const linkCard = defineSlotRecipe({
  className: "link-card",
  description:
    "A link drawn as a shaped tile: a cover image or effect, a scrim and a caption, cropped to `aspect`; `tone` sets the caption colour.",
  slots: [
    "root",
    "cover",
    "backgroundEffect",
    "mediaFrame",
    "media",
    "scrim",
    "wash",
    "caption",
  ],
  base: {
    root: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      // The clip holds the declared aspect (long titles would stretch the card) and rounds the cover.
      borderRadius: "lg",
      overflow: "hidden",
      textDecoration: "none",
      _active: { transform: "scale(0.98)" },
      // Drawn over the cover; a border on the root would paint beneath it.
      _after: {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        borderWidth: "token(spacing.3xs)",
        borderStyle: "solid",
        borderColor: "border.divider",
        pointerEvents: "none",
      },
      // Reassigns tokens, not colours: Typography's utilities layer beats any recipe-layer rule.
      "&[data-covered]": {
        "--colors-text-body": "var(--colors-text-title)",
        "--colors-text-default": "var(--colors-text-title)",
      },
    },
    // Paint order is tree order (no z-index): plate, picture, frosting, wash, then the words.
    cover: {
      position: "absolute",
      inset: 0,
      backgroundColor: "bg.surface",
      "--colors-field-bg-default":
        "var(--colors-field-bg-default-on-surface)",
    },
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      pointerEvents: "none",
    },
    // Positioned, so tree order rather than flow puts the picture over its ground.
    mediaFrame: {
      position: "absolute",
      inset: 0,
    },
    // No `object-fit` or corner here: `Media` sets both inline.
    media: {
      display: "block",
      width: "100%",
      height: "100%",
    },
    scrim: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      minBlockSize: CARD_SCRIM_MIN_HEIGHT,
    },
    wash: {
      position: "absolute",
      inset: 0,
      backgroundImage: CARD_WASH,
    },
    caption: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "sm",
      padding: "xl",
    },
  },
  variants: {
    aspect: linkCardAspectVariants,
    // Pins the band to the picture's theme, not the page's, via the tokens it resolves through.
    tone: {
      light: {
        scrim: {
          "--colors-bg-surface": "var(--colors-neutral-200)",
          "--colors-text-title": "var(--colors-neutral-900)",
          "--colors-text-body": "var(--colors-neutral-900)",
          "--colors-text-default": "var(--colors-neutral-900)",
        },
      },
      dark: {
        scrim: {
          "--colors-bg-surface": "var(--colors-neutral-800)",
          "--colors-text-title": "var(--colors-neutral-100)",
          "--colors-text-body": "var(--colors-neutral-100)",
          "--colors-text-default": "var(--colors-neutral-100)",
        },
      },
    },
  },
  // Chosen at runtime, so the extractor needs them listed; separate entries avoid a cross product.
  staticCss: [{ aspect: ["*"] }, { tone: ["*"] }],
});
