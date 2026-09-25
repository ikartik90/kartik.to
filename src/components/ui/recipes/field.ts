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
      // Toggle archetype, detected by `:has`. The control sits on the label's first line, shifted by half
      // of (1lh − its own height); the size variant hands it the label's text style for `1lh`.
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
      // A union, since each archetype signals engagement differently: `:focus-visible` (text), plain `:focus`
      // (the slider's div, which misses :focus-visible after a click), `aria-expanded` (open triggers).
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
        {
          color: "field.text.active",
        },
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
      cursor: "text",
      // Grows for a textarea. Its `height: auto` lives in each size variant: a variant's layer beats
      // the base's regardless of specificity.
      "&:has(textarea)": {
        alignItems: "flex-start",
        paddingBlock: "sm",
      },
      backgroundColor: "field.bg.default",
      borderColor: "field.border.default",
      // The single colour source for the leading icon and the control (both `color: inherit`).
      color: "field.text.default",
      transition:
        "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
        {
          backgroundColor: "field.bg.active",
          borderColor: "field.border.active",
          color: "field.text.active",
        },
      // On the shell and inset, so `overflow: hidden` can't clip it.
      "html[data-keyboard-focus] [data-field]:has([data-control]:focus-visible) &":
        {
          boxShadow:
            "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
        },
      // `> svg` keeps this off icons inside the control.
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
      // `resize` off: the frame clips its overflow, so size the box with `rows`.
      "&:is(textarea)": {
        resize: "none",
        display: "block",
        overflowY: "auto",
      },
      "&::placeholder, &[data-placeholder]": {
        color: "field.text.placeholder",
      },
      "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &::placeholder, [data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &[data-placeholder]":
        { color: "field.text.activeMuted" },
      // The frame clips an input's own ring, so the frame carries it instead.
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "none",
      },
    },
    hint: {
      color: "field.text.muted",
      width: "token(spacing.full)",
      wordBreak: "break-word",
      marginTop: "sm",
      "[data-field]:has([role='switch'], [role='checkbox']) &": {
        gridColumn: 2,
        gridRow: 2,
        width: "auto",
        marginTop: "none",
      },
    },
  },
  // Label, value, hint and frame height move together; `sm` keeps the base's 8px padding and gap.
  variants: {
    size: {
      sm: {
        label: { textStyle: "sidenote" },
        control: { textStyle: "bodySmall" },
        hint: { textStyle: "fineprint" },
        frame: {
          height: "calc(token(spacing.xxl) + token(spacing.md))",
          // Here, not in the base: a variant's layer outranks it.
          "&:has(textarea)": { height: "auto" },
        },
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            columnGap: "sm",
            // The label's text style, so `1lh` on the control is the label's line box.
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
    labelFirst: {
      true: {
        root: {
          "&:has([role='switch'], [role='checkbox'])": {
            gridTemplateColumns: "1fr auto",
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
  // Variants are chosen at runtime, so emit every branch.
  staticCss: [{ size: ["*"], labelFirst: ["*"] }],
});
