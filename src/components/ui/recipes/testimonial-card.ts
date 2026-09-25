import { defineSlotRecipe } from "@pandacss/dev";

// ------------------------------------------------------------------
// One collected testimonial, on the admin board at `/edit/testimonials`
// — the words somebody sent through `/vouch`, with the face and the
// profile I put beside them afterwards.
//
// A CARD THAT IS A BUTTON, which is what most of this recipe is about.
// Selecting it opens the rail that edits it, so the whole card is the
// hit target — and a `<button>` is the only element that gets keyboard
// operation, focus and the pressed state for free. The cost is that a
// button's own appearance has to be taken off it first (`all: unset` is
// too blunt — it would take the focus ring with it), and that NOTHING
// inside may be interactive: a link nested in a button is not operable
// by keyboard in any browser. That is why the profile is drawn here as
// its handle in text rather than as a link to it — the rail is where it
// is clickable, and the card is where it is VISIBLE.
//
// The picture and the profile are each absent until I add them, so
// every slot below has to read as deliberate while empty. The avatar
// keeps its circle and shows the initial; the handle row simply is not
// drawn. Neither leaves a hole where something is loading.
// ------------------------------------------------------------------
export const testimonialCard = defineSlotRecipe({
  className: "testimonial-card",
  description:
    "Testimonial card — one collected testimonial, composed as root > byline(avatar + identity(name, tagline) + profile) + quote + select. `select` is an empty control stretched over the whole card, and what it IS follows the surface: a button that opens the properties rail on the admin board (the `selected` variant marks which card the rail is on), and an anchor to the person's profile on the page. The board also draws the profile as a real link (the house social icon, shader and all) above that overlay at the byline's far edge — only possible because it is a SIBLING of the button rather than a child; the page does not, because there the card itself is that link.",
  slots: [
    "root",
    "select",
    "quote",
    "byline",
    "avatar",
    "identity",
    "name",
    "tagline",
    "profile",
  ],
  base: {
    root: {
      // The overlay hangs off this, so the card is its containing
      // block — and the profile link stacks against it.
      position: "relative",

      display: "flex",
      flexDirection: "column",
      // NOT `space-between`. Who said it goes on top and the words
      // follow directly under; with the ends pushed apart, a short
      // quote would hang at the bottom of a card stretched to its
      // neighbour's height, leaving a hole under the name.
      justifyContent: "flex-start",
      gap: "lg",
      width: "token(spacing.full)",
      // NO height. The card is as tall as the words in it, which is
      // what makes the board read almost like a masonry wall once the
      // excerpts differ in length. It used to be `100%` — stretched to
      // the tallest card in its row — which is the right call when
      // every card holds the same SHAPE of thing (a cover, a title) and
      // the wrong one here, where the content IS the variation.

      padding: "xl",
      borderRadius: "lg",
      borderWidth: "token(spacing.xxs)",
      borderStyle: "solid",
      // The divider hairline at HALF strength. A board is a grid of
      // these, so every card's edge is drawn twice over — once by the
      // card and once by its neighbour's gap — and at full divider
      // weight the wall reads as ruled paper rather than as cards
      // resting on the canvas. Selection is still legible against it
      // because that state swaps the colour outright.
      borderColor: "border.divider/50",
      backgroundColor: "bg.surface",
      // Colour and border only, so a card taking selection does not
      // move — nothing here changes the box's size.
      transition: "background-color 150ms ease, border-color 150ms ease",
      _hover: { backgroundColor: "bg.itemHover" },
    },
    // The hit target: an empty button covering the card, over the
    // content so a press anywhere lands on it, and under the one thing
    // that must stay reachable — the profile link.
    select: {
      appearance: "none",
      margin: "none",
      padding: "none",
      borderWidth: "0",
      backgroundColor: "transparent",
      font: "inherit",
      color: "inherit",
      cursor: "pointer",
      position: "absolute",
      inset: 0,
      zIndex: 1,
      // So the keyboard ring traces the card's own corners rather than
      // a square inside them.
      borderRadius: "inherit",
    },
    quote: {
      // `sidenote`, not the `quote` style the words will get on a
      // published page, and a step below the name that owns them. This
      // is a board, not the page: the job is to read six at once and
      // find the one being annotated, and 20px prose in a 280px track
      // turns a testimonial into a ragged column. At 12px the whole
      // quote is one glance, the name above it stays the thing the eye
      // lands on, and the 0.5% tracking the sub-14px family carries is
      // what keeps a full 280 characters legible that small. The rail
      // is where one row is looked at closely.
      textStyle: "sidenote",
      color: "text.body",
      margin: "none",
      // NOT clamped. A line clamp is the wrong trade on this surface:
      // the cap on a testimonial is 280 characters, so the longest one
      // possible still fits in a card, and hiding the end of the very
      // quote being annotated is hiding the thing the board exists to
      // show. Unequal cards are the cost, and the grid absorbs it —
      // every card in a row stretches to the tallest.
    },
    // Who said it, ABOVE the words rather than under them: the board
    // is scanned for a person, and the face is what the eye lands on.
    // `flex-start` rather than `center` so the avatar stays level with
    // the first line of a name that has wrapped onto two.
    byline: {
      display: "flex",
      alignItems: "flex-start",
      // The profile sits at the FAR edge, with the words taking the
      // slack between — the icon is a fixed 20px and the name is
      // whatever length it is, so pushing them apart is the only
      // arrangement that reads the same on every card.
      justifyContent: "space-between",
      gap: "lg",
      minWidth: 0,
    },
    avatar: {
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      width: "token(spacing.4xl)",
      height: "token(spacing.4xl)",
      borderRadius: "full",
      overflow: "hidden",
      // The ring is what keeps an EMPTY avatar legible as a slot
      // waiting for a picture rather than as a gap in the layout — and
      // it is the same inset outline every other picture on this site
      // wears, so a filled one is not a special case.
      boxShadow: "inset 0 0 0 token(spacing.xxs) token(colors.border.imageOutline)",
      backgroundColor: "bg.surfaceRaised",
      // The initial, shown only while there is no picture over it.
      textStyle: "bodySmall",
      color: "text.body/50",
      textTransform: "uppercase",
      "& img": {
        width: "token(spacing.full)",
        height: "token(spacing.full)",
        objectFit: "cover",
        display: "block",
      },
    },
    identity: {
      display: "flex",
      flexDirection: "column",
      gap: "3xs",
      minWidth: 0,
      // Takes the slack between the avatar and the profile, so the
      // words start AT the avatar rather than floating in the middle of
      // the row — which is what `space-between` does to three children
      // when the middle one is content-sized.
      flex: "1 1 auto",
    },
    name: {
      textStyle: "bodySmall",
      color: "text.default",
      margin: "none",
      // WRAPS. These are self-described — "Lalit Arya - Senior UX
      // Designer" is one value in the `name` column — and a single
      // ellipsised line would cut the title off every one of them.
      // Nothing here is a fixed-height row, so there is nothing for a
      // second line to break.
      wordBreak: "break-word",
    },
    // What they do, under their name — drawn only when there is one,
    // so a row without a tagline leaves no gap reading as a line still
    // loading.
    tagline: {
      textStyle: "fineprint",
      color: "text.body/50",
      margin: "none",
      minWidth: 0,
      // Wraps for the reason the name does: it is a role and a company,
      // and a card is 280px wide.
      wordBreak: "break-word",
    },
    // The profile link's place in the byline: above the overlay that
    // covers everything else, and centred against the avatar rather
    // than pinned to the top of a byline that may be two lines tall.
    profile: {
      position: "relative",
      zIndex: 2,
      flexShrink: 0,
      // 24px here rather than the row's 28, and none of it set from
      // this slot: the link is drawn at `size="sm"`, which is a 16px
      // GLYPH in the same 4px inset every icon chip wears, so the box
      // follows the icon down. A slot recipe could not do it anyway —
      // slots land in `recipes.slots`, which the un-nested `recipes`
      // layer the chip is in beats outright, so an override written
      // here is emitted and then loses to the rule it is overriding.
      // Level with the NAME, which is the line it belongs to. Centring
      // it against the byline instead drops it to the middle of a
      // three-line identity, beside the tagline rather than the name.
      alignSelf: "flex-start",
    },
  },
  variants: {
    /**
     * Whether the rail is currently editing THIS card.
     *
     * Drawn on the border rather than with a ring or a shadow, because
     * the card already has a border: thickening the same edge moves
     * nothing, where an added outline would shift a grid of cards by a
     * pixel as selection travels across it.
     */
    selected: {
      true: {
        root: {
          borderColor: "border.focusRing",
          backgroundColor: "bg.itemHover",
        },
      },
    },
    /**
     * WHICH SURFACE this card is on, and the two answers differ in
     * exactly two ways.
     *
     * `board` is `/edit/testimonials`: the whole card is a button that
     * opens the rail, so it takes a pointer and a hover wash, and the
     * words are set at `sidenote` because the job there is to read six
     * at once and find the one being annotated.
     *
     * `page` is the homepage wall: a testimonial is a quote and nothing
     * more. The pointer and the hover would both be promises the card
     * cannot keep, and the words are being READ rather than scanned, so
     * they step up a size.
     *
     * ONE variant rather than two booleans, because it is one fact. A
     * card that was a control but set for reading, or vice versa, is
     * not a state either surface wants — and naming the surface says
     * why the pair move together.
     *
     * A variant rather than a second recipe because the card itself is
     * the same object in both places: same frame, same byline, same
     * near-masonry behaviour. Only its job changes.
     */
    surface: {
      board: { root: { cursor: "pointer" } },
      page: {
        root: {
          cursor: "auto",
          // Undone explicitly rather than left to the base: `_hover`
          // is in the base layer, and the wash it draws is the board's
          // answer to "this row is about to be edited", which is not
          // what happens when you press one of these.
          _hover: { backgroundColor: "bg.surface" },

          // A CARD WITH A PROFILE BEHIND IT IS A LINK, and the whole
          // card is the hit area — the icon that used to be the only
          // way through is gone, and `select` is stretched over the
          // card as an anchor instead. So the edge answers the pointer.
          //
          // THE SAME HAIRLINE AT FULL STRENGTH. The resting edge is the
          // divider at half (the base's `border.divider/50`) and the
          // hovered one is the divider itself — fifty percent more
          // opacity, taken off the value the card is actually written
          // with rather than off the alpha it lands on.
          //
          // It was `/75` first, which is the other reading of the same
          // instruction, and it does not survive contact with a 1px
          // line: the divider's own colour is already half-transparent,
          // so 50% of it is 0.25 alpha and 75% is 0.375, and composited
          // on `bg.surface` that is rgb(43,46,52) against rgb(50,56,63)
          // — seven values of red across one pixel. At full strength
          // the step is twice that and can actually be seen, which is
          // the whole job of a hover state.
          //
          // Written as one colour at two strengths so a change to the
          // divider carries to both, and it arrives over the
          // border-color transition the base already declares.
          //
          // Gated on the mark rather than applied to every card,
          // because a testimonial with no profile stored is a quote and
          // nothing else. An edge that lights under the pointer is a
          // promise that pressing does something, and that card has
          // nothing to press.
          "&[data-linked]:hover": {
            borderColor: "border.divider",
          },
        },
        quote: {
          // `bodySmall`, and NOT the 20px `quote` style this slot's
          // note above anticipated. That note assumed a published page
          // would give these words a page's measure; the wall gives
          // them a 280px card instead, and 20px in a 280px track is
          // about twenty characters a line — which turns a 280-character
          // testimonial into a twelve-line ribbon and the wall into
          // something nobody reaches the bottom of. 14px is the reading
          // size the card can actually hold.
          textStyle: "bodySmall",
        },
      },
    },
  },
  defaultVariants: {
    selected: false,
    surface: "board",
  },
});
