import { defineSlotRecipe } from "@pandacss/dev";

// weatherWidget — the weather graphic framed as a home-screen card:
// where it is, what the sky is doing, and what that comes to.
//
// Every size in here is written in `cqw` against the card's own width,
// and that is the whole design of the recipe. The card is placed in a
// masonry grid where its column span is editable, so the same widget is
// asked to be 280px wide in one column and 900 spanning three — a `rem`
// type scale that reads correctly at one of those is a smudge or a
// billboard at the other. Proportional units mean the card has ONE
// composition that is simply drawn at different sizes, which is also
// how the graphic inside it already works (`weatherGraphic` sizes its
// blurs the same way).
//
// The card is square, and the composition is a single centred column read
// top to bottom: the place, the drawing, the temperature, the
// condition. It was a 2:1 landscape lockup of two squares side by side.
// Portrait is the shape a weather widget actually has on every phone
// there is, and in that shape the place has to come FIRST — a
// temperature is the loudest thing on the card, and a visitor who meets
// it before they meet the city reads it as their own weather and has to
// be corrected afterwards.
//
// Nothing here depends on the card's HEIGHT resolving, and that
// constraint is what shapes the numbers below. The frame sets the 1:1
// shape and its own 20px inset, and a height percentage inside that
// would be at the mercy of both; the column is sized from the WIDTH
// instead, and the frame centres it in whatever height it turns out to
// have.
//
// Which leaves a budget, because a column taller than its frame pushes
// the frame past its ratio rather than being cut off by it (that is
// `demoFrameDemoArea`'s documented behaviour). The column has to stay
// under (ratioH/ratioW·W − 40) / (W − 40) of the card's own width. On a
// SQUARE that resolves to exactly 100cqw at every width — the frame's
// 40px of block padding and its 40px of inline padding cancel — which
// is the tightest this card has been asked to be. What follows totals
// roughly 90; the remaining 10 is what the frame spends on centring the
// column rather than filling itself with it.
//
// It is a real constraint rather than a note. The card was 3:4 (134cqw
// of budget), then 5:6 (120), and is now square (100): each squaring-up
// took height off the total, and the drawing paid for most of it — it
// is the only item on the card with slack inside its own box. See
// `drawing` for where the rest came from.
export const weatherWidget = defineSlotRecipe({
  className: "weather-widget",
  description:
    "The weather graphic framed as a square home-screen card — the place, the drawing, and the temperature and condition beneath it, as one column centred on a single vertical axis. Sized entirely in container units so one composition scales across every column span the grid can give it.",
  slots: [
    "root",
    "place",
    "art",
    "drawing",
    "readout",
    "temperature",
    "degree",
    "condition",
  ],
  base: {
    root: {
      // What makes every `cqw` below mean the CARD's width rather than
      // the page's.
      containerType: "inline-size",
      display: "flex",
      flexDirection: "column",
      // Everything on one vertical axis — as items, AND as text. The
      // widest line here is a two-character number and the narrowest is
      // a five-letter word, so centring only the block would leave four
      // lines ragged against a left edge that nothing on the card
      // actually shares.
      alignItems: "center",
      textAlign: "center",
      // Only ever felt where something gives this column more height
      // than it asked for. The frame centres it already; this is what
      // keeps that true if it is ever stretched instead.
      justifyContent: "center",
      // A DESIGN width, clamped, rather than a plain 100%.
      //
      // `DemoFrame` measures its child in a `fit-content` box, so a
      // demo that asks for 100% resolves to nothing at all — the house
      // contract is that a demo states the size it was drawn at and the
      // frame gives it that much or as much as it has. 960 is a cap
      // rather than a target: a portrait card spanning that wide would
      // be 1280 tall and no row asks for one, so in practice this
      // simply means "as wide as the frame".
      width: "token(sizes.articleShowcase)",
      maxWidth: "token(spacing.full)",
      // Between the place, the drawing and the readout. Flex gap is
      // measured between MARGIN boxes, so the drawing's negative block
      // margin (see `drawing`) comes off first and this is added
      // outside the result — the gap is spaced from the painted
      // picture rather than from the transparent margin around it.
      gap: "3.5cqw",
    },

    // The city, and the first line on the card.
    //
    // Quiet all the same: it is the only line here that never changes,
    // and it is doing one job — stopping a visitor reading the number
    // below as their own weather. It only has to be legible to do that.
    place: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "4.5cqw",
      lineHeight: "1.4",
      color: "text.paragraph",
    },

    // The drawing's row: full width, centred, and no height of its own.
    // The landscape card had to ration height (its whole box was 50cqw
    // tall), so this was a sized square with the picture overhanging it.
    // Portrait has height to spare, so the row is simply as tall as
    // what is in it.
    art: {
      width: "token(spacing.full)",
      display: "flex",
      justifyContent: "center",
      // The one frame the entry starts from, drawn with every
      // transition inside the graphic switched off.
      //
      // The drawing animates between ANY two skies — that is what it
      // is for — which means dropping it to the resting sky is itself a
      // 900ms journey. Left alone, the clouds get the ~30ms before the
      // settle reverses them, fade to about 0.95, and come back: an
      // entry consisting of two layers twitching. Cutting to the
      // resting sky instead gives the settle somewhere to travel FROM,
      // and costs nothing visually because the frame it cuts on is the
      // first one the card is ever painted in.
      //
      // A descendant selector because the properties being suppressed
      // belong to `weatherGraphic`'s own slots, several levels down. It
      // is deliberately blunt: this is on screen for a single frame,
      // and anything it over-reaches is not yet visible either.
      "&[data-entry='resting'] *": {
        transition: "none !important",
      },
    },

    // The drawing itself — a square, and nearly the full width of the
    // card, with the difference taken back off as negative block
    // margin so the COLUMN measures less than the picture does.
    //
    // Worth the trick because the drawing carries a wide transparent
    // margin of its own: its square has to hold a plasma corona at its
    // widest and a column of rain at its tallest, so on a calm
    // condition the painted part fills barely half of the box and the
    // gaps above and below it read as holes in the column rather than
    // as spacing. Trimming the box is what puts the place and the
    // temperature at the same distance from the PICTURE that they are
    // from each other.
    //
    // A negative margin rather than `transform: scale`, deliberately:
    // every layer in the drawing is a filtered element, and scaling a
    // filter's output resamples it. This changes the size the drawing
    // is laid out at, so it is drawn sharp at that size instead.
    drawing: {
      // 66, down from the 78 a 5:6 card allowed and the 88 a 3:4 one
      // did. The picture is the only item here with real slack inside
      // it — on every condition but clear it paints across 40–59% of
      // its own box — so it is what pays when the card's shape gives
      // back height.
      //
      // A square could not be paid for out of the drawing alone,
      // though: 100cqw of budget against a column that stood at 107. The
      // type came down with it, by about a sixth across the board, so
      // what is left is the same composition drawn smaller rather than
      // a large readout with a token picture above it.
      width: "66cqw",
      marginBlock: "-6cqw",
    },

    // The number and the word, held closer than the column's own
    // rhythm. They are one statement read in a single glance — "23,
    // cloudy" — and at the column's 4cqw they came apart into two
    // unrelated lines.
    readout: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1.5cqw",
      // So a long condition wraps rather than widening the card.
      minWidth: "0",
    },

    // The number is the headline, and it is set much larger than
    // anything in the site's type scale on purpose — a widget is read
    // at a glance and from further away than prose is.
    temperature: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "15cqw",
      // 1, not the scale's 1.5: at this size the line box's leading is
      // tens of pixels of dead space above and below the digits, which
      // the column's gaps would then be added to — the readout would
      // drift away from the drawing by an amount nothing in here names.
      lineHeight: "1",
      letterSpacing: "-3%",
      color: "text.default",
    },

    // The ring, hung off the digits instead of set with them.
    //
    // The card centres every line on one vertical axis, and this was
    // the one line that looked off it: "23°" centred as a whole string
    // sits with its DIGITS half a ring's width to the left, and the
    // digits are what the eye reads a column's alignment from. Taking
    // the ring out of flow leaves the line's own box measuring the
    // number, so the number is what gets centred and the ring overhangs
    // to the right.
    //
    // No `left` or `top`, and that is the whole trick rather than an
    // omission: an absolutely positioned box with both offsets `auto`
    // is placed at its STATIC position — where it would have sat had it
    // stayed in flow, which is exactly where the ring belongs. So it
    // keeps the spacing and the baseline it had as inline text, and
    // goes on keeping them if the type scale above ever changes.
    // Measured identical to a hand-written `left: 100%; top: 0` in both
    // engines; the offsets were only ever restating the default.
    //
    // Note that `position: absolute` is doing ALL of the work here. The
    // same content set through a `::after` would need it just the same:
    // generated content is in flow, so it widens the line box and puts
    // the digits back off the axis — measured at 6.2px off, half the
    // ring's own width. A pseudo-element would only trade the span for
    // a literal "°" in this file, away from the `formatDegrees` that
    // has to keep agreeing with it, and lose text a visitor can select.
    degree: {
      position: "absolute",
    },

    // Lowercase, matching the caption treatment the drawing was
    // reviewed with — the word is the weather, not a label for it.
    condition: {
      fontFamily: "switzer",
      fontWeight: "base",
      fontSize: "5cqw",
      lineHeight: "1.2",
      letterSpacing: "-1.5%",
      textTransform: "lowercase",
      color: "text.default",
    },
  },
  variants: {
    /**
     * Whether there is a reading behind the card at all.
     *
     * With none, the drawing falls back to an empty sky — and an empty
     * sky drawn at full strength is a bright sun with the site's own
     * gradient in it, which is a CLAIM. The card would say "weather
     * unavailable" underneath a picture of a lovely afternoon. Dimming
     * it drops it to furniture: still a shape where the drawing goes,
     * no longer an assertion about the sky.
     */
    available: {
      false: {
        art: { opacity: "0.2" },
      },
    },
  },
  defaultVariants: {
    available: true,
  },
});
