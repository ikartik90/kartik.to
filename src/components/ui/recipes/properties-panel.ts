import { defineSlotRecipe } from "@pandacss/dev";

// The properties panel for an image's background effect — a header, a
// column of label ∣ control rows, and the remove action (Figma 845:7223).
//
// Anchored to the CELL being edited and fixed rather than absolute, for
// the same reason the slash menu is: `position-try-fallbacks` measures
// overflow against the viewport, and against a containing block taller
// than the viewport there is always "room", so the flip never fires.
// `flip-inline` is what puts the panel on a right-column cell's left.
// The properties panel — a docked inspector for whatever is being
// edited (Figma 845:7223).
//
// Docked to the viewport's right edge rather than anchored beside its
// subject, which is what the background-effect panel it replaces did.
// At fifteen rows that panel already stood taller than the cell it
// pointed at, so "beside" degenerated into "shifted up until it fits"
// and the relationship it was buying stopped reading. A docked panel
// makes no such promise: it is always in the same place, and it can
// grow to hold anything without ever choosing between fitting on
// screen and pointing at its subject.
//
// The whole thing is one shape nested three deep — a 40px header strip
// over a body: the panel (header ∣ sections), each section (header ∣
// control panel), and the rows inside that. Only the SECTIONS scroll,
// never the panel, so the title stays put however much is open below
// it.
export const propertiesPanel = defineSlotRecipe({
  className: "properties-panel",
  description:
    "Docked properties inspector — full viewport height at the right edge, sliding in from it. A fixed header over a scrolling column of sections, each a header strip whose add/remove button mounts and unmounts its control panel (Figma 845:7223).",
  slots: [
    "root",
    "header",
    "title",
    "section",
    "sectionHeader",
    "sectionTitle",
    "controlPanel",
    "text",
    "footer",
    // Last, so its `animation` overrides `root`'s: the two are both
    // single classes on the same element, and the tie is broken by the
    // order Panda emits the slots in — which is this order.
    "exiting",
  ],
  base: {
    root: {
      position: "fixed",
      zIndex: 50,
      // Full viewport height, flush to the edge: both block insets, so
      // the panel needs no height of its own and no dvh arithmetic to
      // survive a mobile browser's collapsing toolbar.
      insetBlock: 0,
      insetInlineEnd: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      width: "token(sizes.propertiesPanelWidth)",
      // On a phone the derived width is wider than the screen. Capping
      // it keeps the panel on screen; the control rows inside then
      // scroll horizontally rather than being clipped away.
      maxWidth: "100vw",
      // No radius, and a hairline on ONE side. The panel is docked, not
      // floating — rounding corners that sit flush against the edge of
      // the screen would draw two slivers of page either side of it.
      //
      // A SHADOW rather than a border, and that is a correctness point
      // rather than a preference: 0.5px of border is 0.5px of layout,
      // so it pushed the panel's content box onto a half pixel and
      // every control in the rail with it. The panel is `position:
      // fixed` — a composited layer of its own — and a layer whose
      // contents sit at a subpixel offset re-rounds them whenever
      // anything inside repaints. That is what made an icon button
      // appear to shift half a pixel as the pointer arrived, and what
      // turned the 0.5px ring inside a swatch into a halo instead of an
      // edge. An inset shadow draws the same hairline and takes no
      // space, so the rail lands on whole pixels. (`will-change:
      // transform` would have hidden the symptom by pinning the layer —
      // a permanent promotion to paper over a fractional layout.)
      //
      // Which EDGE carries it changes with the dock, so it is held in a
      // custom property the bottom sheet re-points; the drop shadow
      // beside it is the same either way round.
      "--panel-hairline":
        "inset 0.5px 0 0 var(--colors-border-divider)",
      backgroundColor: "bg.surface",
      "--colors-field-bg-default":
        "var(--colors-field-bg-default-on-surface)",
      boxShadow:
        "var(--panel-hairline), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
      // The panel IS the scroll container — there is no inner body to
      // scroll, because the structure is a header and then sections,
      // full stop. What keeps the title in place is `position: sticky`
      // on the header, not a wrapper the consumer would have to
      // remember to put its sections inside.
      //
      // Both axes, because the control rows have a fixed width the
      // panel is derived from: on a viewport narrower than that the
      // rows have to be reachable sideways rather than clipped off.
      overflow: "auto",
      // The page behind is a document the panel is editing — reaching
      // the end of the sections should not start scrolling it away.
      overscrollBehavior: "contain",
      animation: "propertiesPanelIn 200ms ease-out",
      // Dismissal — the docked rail's, and the sheet overrides the axis
      // below. It slides out through the edge it is docked against and
      // is then `hidden`, so a collapsed rail is out of the tab order
      // as well as off the screen.
      //
      // A STATE rather than an unmount, which is what lets the same
      // attribute mean the same thing in both layouts: the page turns
      // the width loose separately (`usePropertiesPanelInset`), and the
      // panel keeps its scroll position and its draft for the moment
      // you ask for it back.
      //
      // `visibility` on a delay equal to the slide keeps it reachable
      // for the length of the slide out, and the 0s on the way in is
      // what stops it being invisible while it slides back.
      transition: "translate 200ms ease-out, visibility 0s",
      "&[data-dismissed]": {
        translate: "100% 0",
        visibility: "hidden",
        transitionDelay: "0s, 200ms",
      },
      // A phone held upright gets the same panel along the BOTTOM
      // edge instead: full width, half the viewport tall. Half is the
      // point of it — the other half is where the thing being edited
      // stays visible, which a rail 360px wide on a 390px screen
      // cannot offer.
      //
      // SQUARE, like the rail it is the same panel as. The two upper
      // corners are the only ones not flush with the screen and a
      // radius there is the conventional sheet, but this sheet is a
      // properties panel that has changed edge rather than a card that
      // has slid up: it fills the width, it is bordered on the one side
      // it meets the page, and its rows run to both edges. Rounding
      // only where it happens to be free would make it read as two
      // different surfaces depending on which way the phone is held.
      //
      // `dvh`, not `vh`: a phone's toolbar collapses as you scroll and
      // a sheet measured against the tall viewport would leave a strip
      // of page under it.
      _bottomSheet: {
        insetBlockStart: "auto",
        insetInline: 0,
        width: "token(spacing.full)",
        maxWidth: "none",
        height: "50dvh",
        // The hairline moves to the edge the sheet meets the page on
        // — the same shadow, re-pointed. See `root`.
        "--panel-hairline":
          "inset 0 0.5px 0 var(--colors-border-divider)",
        animation: "bottomSheetIn 200ms ease-out",
        // The same dismissal as the rail's, turned through a right
        // angle: the sheet is docked to the bottom, so it leaves
        // downwards. Only the axis differs — the state, the timing and
        // the `visibility` handoff are the base rule's (see there).
        //
        // It used to be the ONLY dismissal, and rotating the phone was
        // how you undid it. That is no longer the repair: the state
        // survives the turn now, because the control that brings the
        // panel back is on the band in both layouts.
        "&[data-dismissed]": { translate: "0 100%" },
        // A finger owns the sheet while it is on it — the transition is
        // for letting go.
        "&[data-dragging]": { transition: "none" },
      },
    },
    header: {
      // Stays put over the sections travelling under it. It needs its
      // own fill for that — the root's is behind the scrolled content,
      // not between it and the header.
      position: "sticky",
      insetBlockStart: 0,
      zIndex: 1,
      backgroundColor: "bg.surface",
      "--colors-field-bg-default":
        "var(--colors-field-bg-default-on-surface)",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "md",
      height: "token(spacing.4xl)",
      paddingInline: "lg",
      // Two shadows: the panel's own edge, and this strip's underline.
      //
      // The edge has to be REDRAWN here, and that is the fill above
      // paying for itself. The root's hairline is an INSET shadow, so
      // it paints over the root's background but under every child's —
      // and this child is opaque, full-bleed and 40px tall, so it hid
      // the panel's edge for exactly its own height. The panel looked
      // like a rail whose left border began below its title.
      //
      // `--panel-hairline` rather than the edge written out, so this
      // follows the dock: the left edge on a docked rail, the top one
      // on a sheet, decided once on `root` (see there). The sheet had
      // the same fault for the same reason — its top edge is under this
      // header — and the same declaration answers both.
      //
      // A shadow for the underline too, for the reason the root's edge
      // is one: as a border it took half a pixel off the strip's own
      // height, which left the chips in it centred a quarter pixel
      // high. See `root`.
      boxShadow:
        "var(--panel-hairline), inset 0 -0.5px 0 var(--colors-border-divider)",
      // The whole strip is one ink, stated ONCE here (Figma 845:7232).
      // The buttons in it are `action`'s icon variant, which paints in
      // `currentColor` precisely so a toolbar decides its own ink —
      // left alone they inherit the page's `text.default` and read a
      // step brighter than the title beside them.
      color: "text.body",
    },
    title: {
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    section: {
      // Sections are content-sized and the panel scrolls; letting them
      // flex would share the panel's height out between them instead,
      // shrinking a long control list to fit.
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      // A shadow, for the reason the root's hairline is one — and here
      // it ACCUMULATED: as a border each divider pushed every section
      // below it another half pixel down, so by the fourth section the
      // rows were a pixel and a half off the grid. See `root`.
      boxShadow: "inset 0 -0.5px 0 var(--colors-border-divider)",
    },
    // What stands under every section, on the panel's bottom edge: the
    // auto margin takes whatever height the sections leave in the
    // column, and once they fill it the footer simply comes last in
    // the scroll. Inset by the 12px the section strips are drawn on.
    footer: {
      flexShrink: 0,
      marginBlockStart: "auto",
      padding: "lg",
    },
    sectionHeader: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "md",
      height: "token(spacing.4xl)",
      paddingInline: "lg",
      // One ink for the strip — see the panel header above. The add /
      // remove button and the section's own icon both take it.
      color: "text.body",
    },
    sectionTitle: {
      display: "flex",
      alignItems: "center",
      gap: "sm",
      minWidth: 0,
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
    },
    // Every labelled row IS a `Field`, relaid from the field's own
    // vertical stack into a label ∣ control ∣ action grid. Done here
    // rather than with a wrapper and a bare <span> label so each
    // control keeps its native `htmlFor`/`id` association — fifteen
    // rows of hand-written `aria-label` would be fifteen chances to
    // mislabel a slider.
    //
    // The third track is EMPTY and deliberately so: it is a declared
    // grid column rather than padding, so the day a row needs a reset
    // or an overflow button that button is a third child and nothing
    // here has to move. Empty, it is what keeps every row clear of the
    // panel's edge by the same 36px — see `propertyRowAction`.
    //
    // Stacked labels were the alternative and are not viable: at 15
    // parameters the background section alone would stand twice as
    // tall as the picture it describes.
    //
    // A descendant selector rather than a class on the field root,
    // because both are the same specificity as the `field` recipe's
    // own root and which one won would come down to layer order.
    controlPanel: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "md",
      padding: "lg",
      // The panel's ink, the same one the header strip and every
      // section header set. An icon `action` paints in `currentColor`,
      // so without this the chip in a row's action column inherits the
      // PAGE's `text.default` — a step brighter than everything around
      // it (see the `text` slot) — and the one chip sitting among the
      // controls reads darker than the identical chips in the header
      // above it. Field labels and values name their own colours and
      // are unaffected.
      color: "text.body",
      // A control that fills the panel rather than sitting in a
      // labelled row — the shader list. It still stops where the FIELD
      // column stops: the reserved action column runs unbroken from the
      // header strip to the foot of the panel, and a control spanning
      // it would be the one row that breaks that line. Same 36px every
      // other row gives up, subtracted here because this one is not on
      // the grid — which is the `text` slot's reasoning exactly, and
      // the same expression.
      "& [data-property-block]": {
        width:
          "calc(token(spacing.full) - token(spacing.md) - token(sizes.propertyRowAction))",
      },
      "& [data-property-control]": {
        display: "grid",
        gridTemplateColumns:
          "token(sizes.propertyRowLabel) token(sizes.propertyRowField) token(sizes.propertyRowAction)",
        alignItems: "center",
        columnGap: "md",
        width: "max-content",
      },
      // The label is a column of the grid now, so it must not also
      // stretch to the field's full width the way the stacked one does.
      "& [data-property-control] > label": { width: "auto" },
      // A row whose control is TALLER than one cell — the ramp's grid,
      // which is two rows of swatches. Centring the three tracks is
      // right for every ordinary row, where all three are one line high
      // and centre and start are the same place; against a two-row
      // control it floats the label and the action button into the
      // gutter BETWEEN the rows, pointing at neither.
      //
      // Opt-in rather than automatic, because CSS cannot ask how tall
      // the control turned out and every other row in the panel would
      // shift by the few pixels its control exceeds its label by.
      "& [data-property-control][data-control-align='start']": {
        alignItems: "start",
      },
      // Aligned to the first ROW, not to the top edge. The label's text
      // is shorter than a swatch, so `start` alone would hang it above
      // the cells; a band exactly one cell high, with the text centred
      // in it, puts the two on the same midline. `toolbarButton` is the
      // cell's own height and the action chip's, so all three agree by
      // construction.
      "& [data-property-control][data-control-align='start'] > label": {
        minHeight: "token(sizes.toolbarButton)",
        display: "flex",
        alignItems: "center",
      },

      // SEVERAL ROWS UNDER ONE ACTION — the icon set's size and
      // stroke, which move together (Figma 1274:3765). The rows keep
      // their own label ∣ field grid and give the action column up;
      // the tie takes it once, for the pair.
      "& [data-property-tie]": {
        display: "flex",
        alignItems: "center",
        gap: "md",
      },
      "& [data-property-tie] > [data-property-tie-rows]": {
        display: "flex",
        flexDirection: "column",
        gap: "md",
        flex: 1,
        minWidth: 0,
      },
      // Two columns, not three. A row that kept its own action column
      // would push the tie's chip a column further out than every
      // other chip in the panel, and break the line they stand in.
      "& [data-property-tie] [data-property-control]": {
        gridTemplateColumns:
          "token(sizes.propertyRowLabel) token(sizes.propertyRowField)",
      },
      // THE BRACKET. Two corners rather than an asset: it is drawn
      // from each row's midline — where the field's edge stops — out
      // to the chip's centreline and into its top and bottom edge, so
      // it takes the field's own hairline and follows it into both
      // themes. The arm is as long as the gap plus half the chip, and
      // as tall as the 4px the corner needs (`spacing.sm`, a 2px
      // straight and a 2px turn), which is how far the chip's edge is
      // from the row it is bracketed to.
      "& [data-property-tie-action]": {
        position: "relative",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        "&::before, &::after": {
          content: '""',
          position: "absolute",
          right: "calc(token(sizes.toolbarButton) / 2)",
          width:
            "calc(token(spacing.md) + token(sizes.toolbarButton) / 2)",
          height: "token(spacing.sm)",
          borderColor: "field.border.default",
          borderRightWidth: "token(spacing.xxs)",
          borderRightStyle: "solid",
        },
        // A whole pixel rather than the field frame's half: this is a
        // line in the open with nothing behind it to be the boundary
        // of, and at 0.5px it is a smudge on the panel's ground.
        "&::before": {
          bottom: "token(spacing.full)",
          borderTopWidth: "token(spacing.xxs)",
          borderTopStyle: "solid",
          borderTopRightRadius: "xs",
        },
        "&::after": {
          top: "token(spacing.full)",
          borderBottomWidth: "token(spacing.xxs)",
          borderBottomStyle: "solid",
          borderBottomRightRadius: "xs",
        },
      },

      // A SHEET is as wide as the phone; the ROW was drawn for a rail
      // whose width is the sum of its three columns and nothing else
      // (see `propertiesPanelWidth`). Left alone it keeps that 336px
      // and the slack collects at the right-hand end as dead margin —
      // 15px on the narrowest phone this page draws, 70 on the widest
      // — which reads as the sheet being narrower than the screen it
      // fills, and as every control in it stopping short of the edge
      // its own section header runs to.
      //
      // The FIELD column takes all of it, and only that one. The other
      // two would gain nothing by it: the label column is sized to the
      // words in it and the action column to the one chip it holds
      // open for, so slack there is empty space either side of
      // something already the size it wants to be. What fills the
      // middle is a slider track or a ramp of swatches, and there
      // every pixel is travel to aim along or a target big enough for
      // a finger.
      //
      // `minmax(0, 1fr)` rather than `1fr`, which is `minmax(auto,
      // 1fr)` and so floors the track at its content's intrinsic
      // minimum: the ramp is five swatches and a menu is as wide as
      // its longest option, and a track that cannot go below them
      // would push the action column off the end of a narrow sheet
      // rather than letting its own contents shrink.
      _bottomSheet: {
        "& [data-property-control]": {
          width: "token(spacing.full)",
          gridTemplateColumns:
            "token(sizes.propertyRowLabel) minmax(0, 1fr) token(sizes.propertyRowAction)",
        },
        // The same slack, one track short: a tied row has no action
        // column of its own to hold the extra back from.
        "& [data-property-tie] [data-property-control]": {
          width: "token(spacing.full)",
          gridTemplateColumns:
            "token(sizes.propertyRowLabel) minmax(0, 1fr)",
        },
      },
    },
    // Prose that fills its control panel — a caption, a note — rather
    // than a value sitting in a labelled row, so it wears no field
    // frame at all: the section header above it is the label, and a
    // box drawn round the only thing in the panel would be chrome
    // describing nothing.
    text: {
      // Stops where the FIELD column stops, not where the panel does:
      // the reserved action column runs unbroken from the header strip
      // to the foot of the panel, and prose spanning it would be the
      // one row that breaks the line. Same 36px every other row gives
      // up, subtracted here because this row is not on the grid.
      width:
        "calc(token(spacing.full) - token(spacing.md) - token(sizes.propertyRowAction))",
      minWidth: 0,
      margin: "none",
      background: "transparent",
      border: "none",
      padding: "none",
      textStyle: "sidenote",
      // The panel's ink, not the article's. This is a property being
      // edited in an inspector, and `text.default` is a step brighter
      // than everything around it (Figma 885:2249).
      color: "text.body",
      caretColor: "text.body",
      focusVisibleRing: "none",
      // Never a scrollbar of its own: it grows with what is typed and
      // the panel it sits in does the scrolling. A second scroll
      // region nested in the first is a second place to lose your
      // position. `rows` carries the floor where `field-sizing` is
      // unsupported.
      resize: "none",
      fieldSizing: "content",
      overflow: "hidden",
      _placeholder: { color: "text.body/40" },
    },
    // Composed onto `root` for the length of the closing slide. It has
    // to be a class rather than a data attribute because the element
    // is the shared Popover's, and `className` is the one hook the
    // shell gives us onto it.
    //
    // `forwards` so the panel HOLDS off-screen at the end instead of
    // snapping back into view for the frame between the animation
    // finishing and React unmounting it. Inert throughout — it is on
    // its way out and must not swallow the click that follows.
    exiting: {
      animation: "propertiesPanelOut 200ms ease-in forwards",
      pointerEvents: "none",
      // Out by the edge it came in by. See `bottomSheetIn`.
      _bottomSheet: {
        animation: "bottomSheetOut 200ms ease-in forwards",
      },
    },
  },
});
