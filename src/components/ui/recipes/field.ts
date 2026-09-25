import { defineSlotRecipe } from "@pandacss/dev";

export const field = defineSlotRecipe({
  className: "field",
  description:
    "Text-input family field — a label, a framed input shell (leading icon + control + optional trailing), and a hint. The presentational frame owns no behavior; the assembly fills the control slot. The 'Active' state is CSS-driven off the control's engagement (`:focus-visible`, a slider's plain `:focus`, or an open trigger's `aria-expanded` — see the label slot) rather than a prop, so label, frame bg/border, control text and the leading icon all shift to the brand accent (pink in light, orange in dark) on focus while the hint stays muted (Figma 586:876). Built to be shared by the forthcoming Select/Date inputs. A `role=\"switch\"` or `role=\"checkbox\"` control flips the same root into a control ∣ label/hint grid (the toggle archetype, shared by Switch and Checkbox), detected via `:has` — no prop. Scope: default + active only.",
  slots: ["root", "label", "frame", "control", "hint"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      width: "token(spacing.full)",
      // A toggle control flips the field from a vertical stack into the
      // control ∣ label/hint grid — detected structurally, no prop, the
      // way the active state keys off :focus-visible.
      //
      // The control sits on the label's FIRST LINE, not on the middle
      // of the label. On a one-line statement the two readings are the
      // same; on a wrapped one — a long label, or a narrow card — a
      // centred switch floats down between the lines and stops reading
      // as the thing the sentence starts with. So the row aligns to the
      // top and the control is nudged back down by half the difference
      // between one line box and its own height.
      //
      // `translateY` rather than a margin, because a PERCENTAGE there
      // resolves against the element's own border box — so the control
      // centres itself without this recipe having to know how tall a
      // switch or a checkbox is, and the sizes stay their own recipes'
      // business. It also takes no layout, so nothing below moves.
      // `1lh` is the label's line box, which the size variants hand the
      // control by giving it the label's own text style (it holds no
      // text of its own, so that is the only thing it inherits).
      "&:has([role='switch'], [role='checkbox'])": {
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        alignItems: "start",
        rowGap: "xs",
        columnGap: "md",
        width: "fit-content",
        "& > [role='switch'], & > [role='checkbox']": {
          transform: "translateY(calc((1lh - 100%) / 2))",
        },
      },
    },
    label: {
      color: "field.text.muted",
      width: "token(spacing.full)",
      wordBreak: "break-word",
      cursor: "default",
      transition: "color 150ms ease",
      // Tracked from the field ROOT, so the label recolors even though
      // it sits outside the frame.
      //
      // The selector is a UNION because each control archetype signals
      // engagement differently, and `:focus-visible` alone does not
      // cover them all:
      //   • text inputs — `:focus-visible`, which the spec makes always
      //     match on a keyboard-editable element, click or tab.
      //   • the Date/Select trigger — `aria-expanded`, so an open
      //     popover keeps its field lit.
      //   • the Slider — plain `:focus`. Its control is a <div>, which
      //     matches `:focus-visible` on a PROGRAMMATIC focus (what the
      //     track's pointerdown does) only while the browser's last
      //     interaction was the keyboard. Click any button first and
      //     the modality flips to pointer, so the field would stay
      //     resting through an entire drag. Text inputs never show this
      //     because of the rule above.
      // The keyboard ring below stays on `:focus-visible` alone — that
      // one IS meant to be keyboard-only.
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
        {
          color: "field.text.active",
        },
      // Toggle archetype: the label is a full statement beside the
      // control, so it reads as resting field text rather than a muted
      // label, and clicking it toggles (Figma 684:1133).
      "[data-field]:has([role='switch'], [role='checkbox']) &": {
        gridColumn: 2,
        gridRow: 1,
        width: "auto",
        color: "field.text.default",
        cursor: "pointer",
      },
    },
    frame: {
      display: "flex",
      alignItems: "center",
      gap: "md",
      width: "token(spacing.full)",
      paddingInline: "md",
      borderRadius: "sm",
      borderWidth: "token(spacing.3xs)",
      borderStyle: "solid",
      overflow: "hidden",
      // Clicking the frame's dead padding focuses the control.
      cursor: "text",
      // A MULTI-LINE control (Field.TextArea) needs the shell to grow
      // instead of holding the size variant's fixed height, which would
      // clip every line after the first. Detected with `:has` rather
      // than by a prop, for the reason the toggle archetype is: the
      // frame and the control would otherwise need to be told the same
      // thing twice and could be told differently.
      //
      // The HEIGHT is not here, and cannot be. Panda emits a recipe's
      // variants into a later cascade layer than its base, and a layer
      // beats specificity outright — so `height: auto` written here
      // loses to `size`'s `height` no matter how specific the selector
      // is. It is repeated in each size variant instead, which is the
      // only place in the same layer. Everything a variant does not
      // also set stays here, where it is said once.
      //
      // Padding turns vertical because the frame no longer has a fixed
      // height centring a single line for us.
      "&:has(textarea)": {
        alignItems: "flex-start",
        paddingBlock: "sm",
      },
      backgroundColor: "field.bg.default",
      borderColor: "field.border.default",
      // The single source for the leading icon and the control (both
      // `color: inherit`); the active selector flips all three at once.
      color: "field.text.default",
      transition:
        "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
        {
          backgroundColor: "field.bg.active",
          borderColor: "field.border.active",
          color: "field.text.active",
        },
      // The ring goes on the shell so it hugs the whole field, icon
      // included. Inset, so the frame's overflow:hidden can't clip it;
      // width/colour match the app-wide ring in globals.css.
      "html[data-keyboard-focus] [data-field]:has([data-control]:focus-visible) &":
        {
          boxShadow:
            "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        },
      // Icons compose straight into the frame, leading or trailing:
      // fixed box, frame colour, non-interactive so clicks fall through
      // to the frame. `> svg` keeps this off icons inside the control.
      "& > svg": {
        flexShrink: 0,
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        display: "block",
        pointerEvents: "none",
        transition: "color 150ms ease",
      },
      "& > svg path[stroke]": { stroke: "currentColor" },
      "& > svg path[fill]": { fill: "currentColor" },
    },
    control: {
      flex: "1 1 0",
      minWidth: 0,
      width: "token(spacing.full)",
      margin: "none",
      padding: "none",
      border: "none",
      background: "transparent",
      appearance: "none",
      color: "inherit",
      transition: "color 150ms ease",
      caretColor: "field.text.active",
      // The textarea case. `resize` is off because the frame clips its
      // overflow, so the native grip would be drawn into a corner it
      // cannot escape — size the box with `rows` instead. The rest
      // undoes the element's own defaults, which differ from an
      // input's: a textarea ships a border, a scrollbar gutter and a
      // baseline-aligned inline box that would sit the first line off
      // the frame's padding.
      "&:is(textarea)": {
        resize: "none",
        display: "block",
        overflowY: "auto",
      },
      // The native `::placeholder` and the Select/Date trigger's
      // `[data-placeholder]` sentinel share one rule. On active it
      // follows the rest of the field into the accent, rather than
      // staying stranded in grey on a brand-tinted frame.
      "&::placeholder, &[data-placeholder]": {
        color: "field.text.placeholder",
      },
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &::placeholder, [data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &[data-placeholder]":
        { color: "field.text.activeMuted" },
      // The app-wide keyboard ring targets the raw <input>, which this
      // frame's overflow:hidden clips into an awkward inner rectangle.
      // Suppress it; the frame carries the ring instead.
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "none",
      },
    },
    hint: {
      color: "field.text.muted",
      width: "token(spacing.full)",
      wordBreak: "break-word",
      marginTop: "sm",
      // Toggle archetype: the hint drops under the label, aligned to it
      // rather than stacked with its own top margin.
      "[data-field]:has([role='switch'], [role='checkbox']) &": {
        gridColumn: 2,
        gridRow: 2,
        width: "auto",
        marginTop: "none",
      },
    },
  },
  // Label, value, hint and frame height move together, so you get a
  // "small field" rather than a mismatched label over a normal input.
  // `md` is the Figma default (586:876); `lg` steps each part up one
  // text style and the frame up 8px, holding the same 6px vertical
  // inset. `sm` steps every part down one — 12/20 label, 14/24 value,
  // `fineprint` hint — into a 28px frame. Its 8px padding and gap come
  // from the base and deliberately do NOT shrink: at 28px tall that
  // horizontal rhythm is what keeps the value off the border.
  variants: {
    size: {
      sm: {
        label: { textStyle: "sidenote" },
        control: { textStyle: "bodySmall" },
        hint: { textStyle: "fineprint" },
        // 20 + 8: no single spacing token lands on 28, and the sum
        // mirrors how `lg` derives its own height from `4xl` + `md`.
        frame: {
          height: "calc(token(spacing.xxl) + token(spacing.md))",
          // A multi-line control grows instead. Here rather than in the
          // base block because a variant's layer outranks it — see the
          // note on `frame`'s own `:has(textarea)`.
          "&:has(textarea)": { height: "auto" },
        },
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            columnGap: "sm",
            // Same text style as the label above, so `1lh` on the
            // control IS the label's line box — see the root's base.
            "& > [role='switch'], & > [role='checkbox']": {
              textStyle: "sidenote",
            },
          },
        },
      },
      md: {
        label: { textStyle: "bodySmall" },
        control: { textStyle: "bodyLarge" },
        hint: { textStyle: "sidenote" },
        frame: {
          height: "token(spacing.4xl)",
          "&:has(textarea)": { height: "auto" },
        },
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            "& > [role='switch'], & > [role='checkbox']": {
              textStyle: "bodySmall",
            },
          },
        },
      },
      lg: {
        label: { textStyle: "bodyLarge" },
        control: { textStyle: "subheading" },
        hint: { textStyle: "bodySmall" },
        frame: {
          height: "calc(token(spacing.4xl) + token(spacing.md))",
          "&:has(textarea)": { height: "auto" },
        },
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            "& > [role='switch'], & > [role='checkbox']": {
              textStyle: "bodyLarge",
            },
          },
        },
      },
    },
    // Reverses the toggle archetype: the statement first, the switch
    // after it. That is the arrangement a settings ROW wants — the
    // reader scans labels down one margin and states down the other —
    // where the default keeps the control first, which is what a switch
    // standing on its own in a form wants.
    //
    // The slack goes to the LABEL's column, so a field stretched wider
    // than its parts pushes the track to its far edge (a full-width
    // settings row) while one left to hug keeps the label against the
    // switch it speaks for. Both are had from the same variant.
    //
    // Only the toggle archetype has two orders to choose between, so
    // every rule here is scoped to it — on a stacked text field the
    // label is above the control either way, and this does nothing.
    labelFirst: {
      true: {
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            gridTemplateColumns: "1fr auto",
            // The control's own slot belongs to `switchField` /
            // `checkbox`, not to this recipe, so its column is moved
            // structurally — the same `:has` the archetype itself is
            // detected with.
            "& [role='switch'], & [role='checkbox']": {
              gridColumn: 2,
            },
          },
        },
        label: {
          "[data-field]:has([role='switch'], [role='checkbox']) &": {
            gridColumn: 1,
          },
        },
        hint: {
          "[data-field]:has([role='switch'], [role='checkbox']) &": {
            gridColumn: 1,
          },
        },
      },
    },
  },
  defaultVariants: { size: "md" },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [{ size: ["*"], labelFirst: ["*"] }],
});
