import { defineRecipe, defineSlotRecipe } from "@pandacss/dev";

// The third of the covering popovers, and the one whose body is the
// same OptionList the Combobox opens — so it takes `comboboxPopover`'s
// geometry exactly, and differs only in the anchor it answers to. That
// difference is the whole reason it exists rather than being reused: a
// form with a date, a select and a time on it would otherwise have
// three fields publishing one anchor name, and whichever opened last
// would drag the others' popovers onto itself.
export const timePopover = defineRecipe({
  className: "time-popover",
  description:
    "Covering time-list popover for the Time input: anchored over the trigger frame (top/left) with an opaque brand-tinted surface + brand inset border, at the option-list width and ≥ the trigger width. The clock sibling of datePopover and comboboxPopover.",
  base: {
    // Absolute for the same reason as its two siblings — same shell,
    // same covering geometry, same scroll flutter if it were fixed.
    position: "absolute",
    zIndex: 50,
    positionAnchor: "--time-popover",
    top: "anchor(top)",
    left: "anchor(left)",
    width: "token(sizes.optionListWidth)",
    minWidth: "anchor-size(width)",
    backgroundColor: "field.bg.popover",
    borderRadius: "sm",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow:
      "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  },
});

// The parts a list of TIMES needs that a list of options does not
// (Figma 1204:9848 dark / 1204:9954 light). Everything else in the time
// popover is already `optionList` at `onBrand` — the search strip, the
// 32px rows, the brand text, the neutral selected chip — so this recipe
// is deliberately only the difference: the rule that names the day the
// list crosses into, and the two halves of a row that carries a
// duration beside its clock.
export const timePicker = defineSlotRecipe({
  className: "time-picker",
  description:
    "The time list's own parts, over an `optionList` at `onBrand`: the 'Next Day' rule at the midnight crossing, and a row split into its time and the elapsed span beside it. Both annotations are the ROW's colour at half strength rather than a colour of their own, so they follow brand text on an ordinary row and neutral on the selected one without a second rule.",
  slots: ["heading", "label", "elapsed"],
  base: {
    // The rule between two days, on the row pitch the calendar gives a
    // month label — it is the same sentence ("what you are now looking
    // at"), one unit down.
    heading: {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
      height: "token(sizes.calendarDay)",
      paddingInline: "sm",
      textStyle: "sidenote",
      color: "field.text.active",
      opacity: 0.5,
      whiteSpace: "nowrap",
      userSelect: "none",
    },
    // The clock takes the slack and truncates; the duration never does.
    label: {
      flex: "1 1 0",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    elapsed: {
      flexShrink: 0,
      textStyle: "sidenote",
      // Half of whatever the row is, rather than a colour of its own —
      // brand on an ordinary row, neutral on the selected chip, and it
      // can never drift from the value it annotates.
      opacity: 0.5,
      whiteSpace: "nowrap",
    },
  },
});
