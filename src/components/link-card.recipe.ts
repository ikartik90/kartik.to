import { defineSlotRecipe } from "@pandacss/dev";
import { CARD_SCRIM_MIN_SHARE, cardWashGradient } from "../utils/card-scrim";
import { aspectRatioEntries } from "./ui/recipes/shared";

// The same ratios again, wrapped for a SLOT recipe: a slot recipe's variant is
// a map of slot → styles, not styles, so `linkCard` cannot share the object
// `demoFrameDemoArea` takes even though the declaration inside it is identical.
// Derived a third time rather than copied for the reason the whole map exists:
// a twelfth ratio should be one line in one file, not a line here as well.
const linkCardAspectVariants = Object.fromEntries(
  aspectRatioEntries.map(([ratio, [w, h]]) => [
    ratio,
    { root: { aspectRatio: `${w} / ${h}` } },
  ]),
);

// ---------------------------------------------------------------------------
// The scrim a link card's caption stands on: half the card, or the words,
// whichever is taller.
//
// Three versions to get here and each was wrong in a way you could see. The
// first spent its whole fade inside the caption's box plus 32px of clearance,
// and a ramp that steep is not a fade — the slope changed abruptly where the
// clearance ended and the card wore a horizontal seam across the picture. The
// second ran the ramp over the whole card, which has no seam in it anywhere
// and buys the most contrast, and it swallowed the picture: by mid-card the
// wash was already half-strength, so a cover with a scrim on it stopped being
// a cover. The third held it to exactly half, which is right for every card
// whose name fits in half — and on a 307×173 tile a two-line title starts at
// 58% of the card, eight points ABOVE the scrim, so its first line and the
// date over it stood on bare picture. Measured against a near-white screenshot
// in dark mode: 1.8:1 and 1.0:1, which is white on white.
//
// So the share is a FLOOR, and it is a quarter. The scrim is the box the
// caption sits in, with a `min-block-size` of a quarter of the card —
// `max(a quarter, the words)` said in one declaration and with nothing
// measured. A wide card, where the name is one line at the foot, is exactly a
// quarter and no more; only a tile whose caption genuinely reaches higher goes
// past it, and then only as far as its own words.
//
// A SHARE rather than a length, so the ramp is 135px on a 960×540 card with no
// fixed number in it to go stale. And the box bounds the FROSTING as well as
// the wash, because a blur across the top of a picture covers it just as surely
// as a gradient does.
// ---------------------------------------------------------------------------

/** The floor: the scrim is at least this much of the card, and often exactly. */
const CARD_SCRIM_MIN_HEIGHT = `${CARD_SCRIM_MIN_SHARE * 100}%`;

/**
 * The ramp itself — SMOOTHERSTEP, `6t⁵ − 15t⁴ + 10t³`, described by nine stops
 * and mixed here out of the card's own surface token.
 *
 * The curve is `cardWashStops`, in `src/utils/card-scrim.ts`, and the only
 * thing supplied here is the paint. It moved out because the wash has a second
 * reader now: an Open Graph image is this same card composed by Satori, which
 * reads neither `color-mix()` nor a token, so it cannot be given this string —
 * and a curve restated there would be the one that stops matching the first
 * time either is tuned. See that file; the reasoning stays here.
 *
 * WHY that curve: its SLOPE is zero at both ends as well as its value. A power
 * curve reaches zero at the top of the ramp but arrives there travelling — it
 * is already a quarter opaque an eighth of the way down, so the gradient reads
 * as starting somewhere, and the eye finds that somewhere and calls it an edge.
 * Ending at zero is not the same as ending softly. This one leaves the top of
 * the scrim at nothing and stays at nothing long enough that there is no line
 * to find, then does its work in the middle and settles flat into the foot,
 * where a hard arrival would be just as findable, under the words.
 *
 * WHY nine stops: not the quantisation — 0.95 of alpha across a quarter of a
 * card is several levels a pixel, which cannot band — but because a browser
 * interpolates LINEARLY between stops, so the curve is only ever as smooth as
 * the polyline describing it.
 *
 * `bg.surface` and not an ink of its own, because that is the colour the
 * caption has ALWAYS been read against — the card's own plate.
 */
const CARD_WASH = cardWashGradient(
  (alpha) =>
    `color-mix(in srgb, token(colors.bg.surface) ${(alpha * 100).toFixed(1)}%, transparent)`,
);

// ------------------------------------------------------------------
// A pointer into the site drawn as a picture with its name written
// across it — the tile the projects listing is made of, and the tile
// the articles listing will be made of next.
//
// It replaced a card that was a 16/9 cover with the title, and
// sometimes a blurb, stacked in a column underneath. That shape had two
// problems worth naming. The card's height was whatever its text came
// to, so a column of them was a column of unequal boxes with the
// pictures at unequal heights; and the blurb was the FIRST PARAGRAPH of
// the post, dug out of the document by the card itself, which is the
// kind of derivation that reads as a summary while being nothing of the
// sort. Both went the same way: the card is now one box, at one
// declared shape, and everything it shows is laid over the picture.
//
// `aspect` is the whole of that promise, and the reason `overflow` is
// not decoration. `aspect-ratio` on an auto-height box is a FLOOR, not
// a shape: the box's automatic minimum size is still its content, so a
// title long enough to wrap past the ratio's height simply pushes the
// bottom edge down and the card silently comes out taller than the
// shape it declared. Measured, not assumed — a 3:2 card asked for 100px
// and rendered 392px with enough words in it. Clipping is what makes
// the declaration true, and it is why the caption may sit in flow at
// all: the cover is taken out of flow so only the words can ever push
// the box, and then they cannot.
// ------------------------------------------------------------------
export const linkCard = defineSlotRecipe({
  className: "link-card",
  description:
    "A link rendered as one shaped tile — the card the homepage grid is made of. `root` is the whole card and the only box with a shape: it takes an `aspect` from the app's shared ratio map and CLIPS to it, since aspect-ratio alone is only a floor, and it carries `data-covered` when there is a picture. `cover` is out of flow and holds the whole stack, in paint order — a flat `bg.surface` plate, the `backgroundEffect` ground the author put behind the picture, the `media` in its positioned `mediaFrame`, all inside `cover`. The `scrim` is a SIBLING of that: the box the `caption` sits in, at least half the card tall and taller only where the words are, holding `ScrimBlur`'s progressive frosting with the `wash` over it — so the blur and the gradient are bounded by the same box and neither can reach past the other. `caption` is the name and, for a dated listing, the date, and it takes the theme's strongest ink wherever there is a picture under it. No hover state of its own beyond the press.",
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
      // The caption sits on the bottom edge, which is the one that
      // moves: a card is read from its picture down to its name, and
      // pinning the name to the foot keeps every card in a column
      // agreeing on where the words are regardless of how many lines
      // they run to.
      justifyContent: "flex-end",
      // Same 12px the card has always worn. The cover carries none of
      // its own — an overlay pinned flush inside a clipped, rounded box
      // is already rounded BY it, and a second radius would only hold
      // the plate back from the corner.
      borderRadius: "lg",
      overflow: "hidden",
      textDecoration: "none",
      _active: { transform: "scale(0.98)" },
      // The edge, drawn OVER everything the card holds. A border on
      // the root itself paints with its background, beneath the cover —
      // and the cover is a picture edge to edge, so a clip as dark as
      // the page (or as light, in the light theme) took the card's
      // outline with it and left only the stretch the scrim lightens.
      // Last in tree order and positioned, so it paints after the cover
      // and the scrim without a z-index. The demo frame's hairline, so
      // a card reads the same whether it holds a demo or a picture.
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
      // Over a picture the caption takes the theme's STRONGEST ink,
      // and the muted greys `Typography` hands out are dropped. They
      // are tuned to sit on a flat plate; a picture is not one.
      //
      // Done by REASSIGNING the tokens rather than by writing a colour
      // over the words, and the difference is the cascade rather than
      // taste. `Typography` colours itself from a `cva`, which Panda
      // emits into the `utilities` layer — and a layer beats
      // specificity outright, so a `[data-covered] … :is(h2, p)` rule
      // from the `recipes` layer loses to it however specific it is.
      // (It was written that way first. The rule reached the
      // stylesheet, matched the element, and did nothing.) Custom
      // properties are not in the fight at all: the utility still
      // wins and still says `var(--colors-text-body)`, and this is
      // what that resolves to. Same move `bg.surface` surfaces make
      // for `--colors-field-bg-default`, one slot up.
      "&[data-covered]": {
        "--colors-text-body": "var(--colors-text-title)",
        "--colors-text-default": "var(--colors-text-title)",
      },
    },
    // The picture and everything laid over it, and the ORDER inside it
    // is the whole design. A backdrop filter samples what has already
    // painted beneath it, so a frosting layer above the wash filters
    // the wash — which is to say it filters a near-opaque plate and
    // does visibly nothing. That is what the first version did, and it
    // is why the card looked like a plain gradient with a seam in it
    // rather than like the playground's glass.
    //
    // So: plate, picture, frosting, wash, and then the words outside
    // this box entirely. The picture SOFTENS under the caption and the
    // wash tints what the blur produced. All of it is positioned with
    // no z-index anywhere, so tree order is paint order — the order the
    // component writes them in.
    cover: {
      position: "absolute",
      inset: 0,
      backgroundColor: "bg.surface",
      "--colors-field-bg-default":
        "var(--colors-field-bg-default-on-surface)",
    },
    // The ground the author put behind the picture, carried off the
    // media object exactly as the reader's tile and the lightbox carry
    // it — the effect belongs to the PICTURE, so a card showing that
    // picture shows it on the same ground or it is showing something
    // else. The card's corner rather than the picture's: this fills the
    // tile, and the picture in front of it wears its own.
    backgroundEffect: {
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      pointerEvents: "none",
    },
    // The box the media composes INSIDE, and the reason it exists is
    // paint order. An `<img>` is in-flow and the ground is positioned,
    // and a stacking context paints its positioned descendants after
    // its in-flow ones however they are written — so an absolutely
    // placed ground lands on TOP of the picture it is supposed to be
    // behind. Giving the picture a positioned box of its own puts both
    // in the same class, where tree order settles it, which is the rule
    // every other layer in this cover already follows.
    //
    // It also has to be a box rather than the media element itself:
    // `Media` may wrap the object in a frame and an inset box of its
    // own (`mediaFrameStyle`, `mediaBoxStyle`), and the class this
    // recipe hands over lands on the object, not on those.
    mediaFrame: {
      position: "absolute",
      inset: 0,
    },
    // No `object-fit` here on purpose. `Media` states one inline from
    // the object's own layout — `DEFAULT_MEDIA_FIT` where the author
    // chose nothing, which is `cover` and fills the tile — and an
    // inline declaration outranks this class anyway, so a fit written
    // here would be a second answer that is right only by luck. Same
    // for the corner.
    media: {
      display: "block",
      width: "100%",
      height: "100%",
    },
    // The box the scrim IS, and the box the caption sits in — one
    // element, which is what makes `max(half the card, the words)` a
    // single declaration instead of a measurement. In flow, so it takes
    // the caption's height; `min-block-size`, so it can never be less
    // than half; last in a `flex-end` column, so it sits at the foot.
    //
    // The frosting and the wash are its children at `inset: 0`, which
    // is what holds BOTH to it — see `CARD_SCRIM_MIN_HEIGHT`. The
    // caption is a child too, and a positioned one, so it paints over
    // them by tree order like everything else in this card.
    scrim: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      minBlockSize: CARD_SCRIM_MIN_HEIGHT,
    },
    // The tint over the frosting, and the last thing under the words.
    //
    // `bg.surface` and not an ink of its own, because that is the
    // colour the caption has ALWAYS been read against — the card's own
    // plate — so the words keep the contrast they had in both themes
    // and the picture is the only thing that changed behind them.
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
    // Which theme the band is drawn in, PINNED, rather than the
    // reader's.
    //
    // Every other surface in this app follows the page, and this one
    // must be able not to: what the caption stands on is the PICTURE,
    // and the picture does not change when the page does. A card whose
    // cover is a light screenshot keeps a light screenshot in dark
    // mode, so a wash and an ink that flipped with the page would put
    // white words on a near-white plate — which is the 1.0:1 the scrim
    // note above measured, arrived at from the other direction.
    //
    // Expressed by REASSIGNING the two tokens the band is built out of
    // rather than by writing colours over it, for the reason the
    // `[data-covered]` block one slot up gives at length: `Typography`
    // colours itself from a `cva` in the `utilities` layer, and a layer
    // beats specificity outright, so a rule from here cannot win
    // against it — but it can change what the variable that rule reads
    // resolves to. `bg.surface` is the wash's own colour (see `wash`),
    // and the three text tokens are what the caption's two lines
    // resolve through: `[data-covered]` on the root points `body` and
    // `default` at `title`, and a custom property that refers to
    // another is substituted where it is DECLARED — so pointing them
    // all at one fixed ink here, on the scrim, is what actually
    // reaches the words inside it.
    //
    // Held to the scrim slot deliberately. The plate behind the picture
    // (`cover`) keeps following the page, because that is the app's own
    // background showing through the inset of a `contain`-fitted
    // screenshot and it should match the page around the card.
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
  // The shape is chosen per card at RUNTIME, so the extractor never
  // sees one: without this only the ratios that happen to be written as
  // literals somewhere would be emitted, and every other card would
  // fall back to no shape at all. Same trap `demoFrameDemoArea` sprang.
  //
  // The tone is here for the same reason and in a SEPARATE entry: one
  // object listing both would emit the cross product — every ratio
  // times every tone — for two properties that never interact.
  staticCss: [{ aspect: ["*"] }, { tone: ["*"] }],
});
