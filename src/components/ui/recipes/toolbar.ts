import { defineRecipe } from "@pandacss/dev";

// The app's shared toolbar chrome: the box a row of icon controls sits
// in — a hugging horizontal rail on `bg.surface` with a concentric
// corner. Three surfaces drew this and each wrote the metrics out
// again (the editor's floating `selectionPopover`, the demo frame's
// `demoFrameControls` rail, the collection cell's hover pill); they now
// compose this and keep only what is actually theirs — where the rail
// is positioned, and whether it is bordered, elevated or clipped. Those
// three genuinely differ (one floats on a CSS anchor, one is furniture
// in a frame's corner, one fades in over a photo's scrim), which is why
// the shared part stops at the box and does not try to be the skin.
//
// `size` is the whole variant axis, because the numbers that make a
// toolbar only ever move together:
//   md — the default rail. 40px tall, controls 4px apart on a 6px
//        inset. 6 + 28px button + 6 = 40 was already the block-axis
//        arithmetic, and the inline inset now agrees with it, so the
//        buttons sit in a band of one thickness instead of 8 from the
//        ends and 6 from the edges. There is no 6px token and a single
//        inset does not earn one, so it is spelled as the 4 + 2 it is
//        made of. The corner stays `md` (8px): strict concentricity
//        would now want 4 + 6 = 10, which is not on the radius scale,
//        and 8 is what the rest of the floating chrome curves at.
//   sm — the rail shrink-wrapped onto its buttons: 28px tall (exactly
//        `sizes.toolbarButton`, so the box IS one button), no inset, no
//        gap, and the ITEMS go square so the rail is the only thing in
//        the box with a corner. With no inset and no gap there is
//        nothing left for a per-item radius to round against — the
//        chips abut each other and reach the rail's edge, so rounding
//        them would just notch four bites of surface out of every
//        seam. One 4px corner on the outside, and the rail clips the
//        square ends of the row to it.
export const toolbar = defineRecipe({
  className: "toolbar",
  description:
    "The app's shared toolbar chrome — the horizontal rail a row of controls sits in, with a corner concentric to the buttons inside it. Owns the box only (layout, height, inset, gap, radius, surface); positioning and whether the rail is bordered, elevated or clipped stay with the consumer, since the surfaces that draw it differ on exactly those. `size=md` is the default 40px rail (6px inset, 4px gap, 8px radius) whose buttons keep their own 4px corners; `size=sm` shrink-wraps it onto the buttons at 28px with no inset and no gap, squares the items, and keeps a single 4px corner on the rail itself — which it clips the row to. `tone` picks the ground: `surface` for free-standing chrome, `field` for a rail that is one row of a form (the segmented control). `fit` picks hug-your-contents or fill-your-slot.",
  base: {
    display: "flex",
    alignItems: "center",
  },
  variants: {
    // WHAT the rail is drawn on. `surface` is the free-standing chrome
    // every floating/furniture toolbar wears; `field` drops it into a
    // form row as one of the field family's own controls, taking that
    // family's fill and hairline so a segmented control lines up with
    // the text inputs and sliders stacked above and below it
    // (Figma 885:1963).
    tone: {
      surface: {
        backgroundColor: "bg.surface",
        "--colors-field-bg-default":
          "var(--colors-field-bg-default-on-surface)",
      },
      field: {
        backgroundColor: "field.bg.default",
        // An inset ring rather than a `border`, exactly as the `field`
        // frame draws its own edge: a real border would eat into the
        // 28px and leave the rail a pixel shorter than the slider
        // beside it.
        boxShadow:
          "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
      },
    },
    // Whether the rail sizes to its contents or to its slot. Hugging is
    // right for chrome that floats or tucks into a corner; filling is
    // right for a control that is one row of a form and has to agree
    // with the column its neighbours sit in.
    fit: {
      hug: {
        // Also overrides the `article > *` width rule (@layer base)
        // that would otherwise stretch it to the text column.
        width: "max-content",
      },
      fill: { flex: "1 1 0", minWidth: 0 },
    },
    size: {
      md: {
        gap: "sm",
        height: "token(spacing.4xl)",
        // 6px — the block-axis inset the 40px height already implies
        // around a 28px button. Composed rather than tokenised: the
        // scale stops at 4 and jumps to 8, and one rail's inset is not
        // reason enough to wedge a step between them.
        paddingInline: "calc(token(spacing.sm) + token(spacing.xs))",
        borderRadius: "md",
      },
      sm: {
        gap: "none",
        height: "token(sizes.toolbarButton)",
        paddingInline: "none",
        borderRadius: "sm",
        // A rail's own `gap` only spaces its DIRECT children, and half
        // the toolbars in the app do not lay their buttons out
        // themselves: they hold an `OptionList.Toolbar`, whose inline
        // direction owns the 2px between the options. Asking for no gap
        // has to mean no gap wherever the row is actually laid out,
        // otherwise `sm` reads as gapless when the buttons are direct
        // children (the demo frame's rail) and 2px-apart when they come
        // from an OptionList — the same variant, two different boxes.
        // Deliberately not `:where()`, which would leave this tied with
        // the option list's own inline rule and let stylesheet order
        // decide the winner.
        // `listbox` as well as `toolbar`: the option list's inline
        // direction serves both a multi-toggle row and a horizontal
        // single-select (a segmented control is the latter), and the
        // rail cannot tell which it was handed.
        "& :is([role='toolbar'], [role='listbox'])": { gap: "none" },
        // The items go square: the rail owns the only corner in the
        // box. Reaches every control the same way the gap rule does,
        // since a button here may be a direct child (the demo frame's
        // rail) or an `OptionList.Option` a row down.
        "& :is(button, [role='button'])": { borderRadius: 0 },
        // Which makes the clip load-bearing rather than optional — the
        // end chips are square and would otherwise square off the 4px
        // corner they sit in. Safe to set here even though
        // `demoFrameControls` argues against `overflow: hidden` at
        // `md`: that argument is about not laying a trap for a
        // descendant that wants out, and the one thing in these rails
        // that ever wanted out — a hover tooltip — now portals itself
        // to the body rather than relying on its host not to crop.
        overflow: "hidden",
      },
    },
  },
  defaultVariants: { size: "md", tone: "surface", fit: "hug" },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ size: ["*"], tone: ["*"], fit: ["*"] }],
});
