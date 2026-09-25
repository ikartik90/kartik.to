import { defineSlotRecipe } from "@pandacss/dev";

// The option list behind a Combobox, and a stand-alone always-open
// select on its own. Presentation only; filtering and selection live in
// `option-list.tsx`. `tone` mirrors the calendar's (Figma
// 647:1947/2045 default, 629:1416/630:1702 onBrand).
export const optionList = defineSlotRecipe({
  className: "option-list",
  description:
    "Option list: an optional search/filter row above a scrollable listbox of option buttons on a 28px row pitch. Options carry their state as attributes (aria-selected / data-active / :disabled), so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand selected chip; `onBrand` drops into the Combobox popover (which owns the surface) and inverts — options brand, selected chip neutral.",
  slots: ["root", "search", "list", "option", "empty", "divider"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      width: "token(sizes.optionListWidth)",
      borderRadius: "sm",
      overflow: "hidden",
    },
    // A full-width Field.Search dressed as the filter row — the same
    // look as the calendar's search slot.
    search: {
      flexShrink: 0,
      width: "token(spacing.full)",
      height: "token(spacing.4xl)",
      paddingInline: "md",
      paddingBlock: "none",
      border: "none",
      borderBottomWidth: "token(spacing.3xs)",
      borderBottomStyle: "solid",
      borderBottomColor: "field.border.default",
      background: "transparent",
      appearance: "none",
      color: "field.text.default",
      textStyle: "bodyLarge",
      caretColor: "field.text.active",
      "&::placeholder": { color: "field.text.placeholder" },
      "&::-webkit-search-cancel-button": { display: "none" },
    },
    list: {
      display: "flex",
      flexDirection: "column",
      // Rows abut directly — each is its own hit target.
      gap: "none",
      padding: "sm",
      overflowX: "hidden",
      overflowY: "auto",
      // 7 full rows + a ~12px peek, so the half-row signals there is
      // more to scroll (Figma 647:2386).
      maxHeight:
        "calc(7 * token(sizes.optionRow) + 2 * token(spacing.sm) + token(spacing.lg))",
    },
    option: {
      display: "flex",
      alignItems: "center",
      // Space a leading icon from the label when an option composes both.
      gap: "md",
      width: "token(spacing.full)",
      flexShrink: 0,
      // The inset alone defines the row/chip box (Figma 647:2387) — no
      // fixed height, so an icon-only toolbar chip comes out 28px and a
      // text row its line-box + 8px, rather than all forced to 32px.
      padding: "sm",
      borderRadius: "sm",
      // Anchors the selection ring below.
      position: "relative",
      border: "none",
      background: "transparent",
      appearance: "none",
      textAlign: "left",
      textStyle: "bodySmall",
      color: "field.text.default",
      cursor: "pointer",
      userSelect: "none",
      // Single line, truncated with an ellipsis.
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      // A composed leading icon, tracking the row colour.
      "& svg": {
        width: "token(spacing.xxl)",
        height: "token(spacing.xxl)",
        flexShrink: 0,
        display: "block",
      },
      "& svg path[stroke]": { stroke: "currentColor" },
      "& svg path[fill]": { fill: "currentColor" },
      transition:
        "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
      // `data-active` is the roving/keyboard highlight, sharing the
      // hover declaration so arrowing onto a row reads like pointing at
      // it. The `:not` guards the selected row, which is the default
      // roving target and so carries BOTH attributes — without it the
      // neutral hover tint wins over the brand chip (equal specificity
      // → atomic-CSS order decides) and selection reads grey.
      "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
        { backgroundColor: "field.bg.hover" },
      // The bare :hover tint, split out so it can be gated on the live
      // input modality. A LISTBOX row only tints while the pointer is
      // the live device: a cursor parked over a menu opened with `/`
      // would otherwise paint a second lit row beside the one the
      // keyboard is driving, and the two are indistinguishable. A
      // TOOLBAR has no roving highlight, so nothing there can conflict
      // and hover always tints. Gated on `:not(…='keyboard')` so the
      // pre-input state, where the attribute is absent, still hovers.
      // `:where()` contributes no specificity, so both selectors keep
      // exactly the weight the single combined rule used to have.
      ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
        { backgroundColor: "field.bg.hover" },
      // One "on" state: a selected row and a pressed toggle share the
      // brand chip.
      "&[aria-selected='true'], &[aria-pressed='true']": {
        backgroundColor: "field.bg.active",
        color: "field.text.active",
      },
      // ── SELECTION RING (trial) ───────────────────────────────
      // A chip filled with `field.bg.active` also wears the matching
      // `field.border.active` edge — which is what the Switch and the
      // Checkbox have always done, and what the segmented control now
      // does over its rail. Scoped to exactly that fill: the `onBrand`
      // tone below takes the neutral `field.bg.selected` chip instead
      // and turns the ring off, because on a brand surface the accent
      // IS the background and an accent edge would have nothing to sit
      // against.
      //
      // On a pseudo rather than a `box-shadow`, so it composes with the
      // focus ring the slot already spends its `box-shadow` on.
      //
      // `segmentedControl` narrows this rather than redrawing it: in a
      // rail the inline edges belong to the SEAM, and the row's two
      // outer corners belong to the rail. See that recipe.
      "&[aria-selected='true']::after, &[aria-pressed='true']::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        borderWidth: "token(spacing.3xs)",
        borderStyle: "solid",
        borderColor: "field.border.active",
        pointerEvents: "none",
      },
      "&:disabled": {
        color: "field.text.muted",
        opacity: 0.4,
        cursor: "not-allowed",
        "&:hover, &[data-active]": { backgroundColor: "transparent" },
      },
      "html[data-keyboard-focus] &:focus-visible": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    empty: {
      display: "flex",
      alignItems: "center",
      height: "token(sizes.optionRow)",
      paddingInline: "sm",
      textStyle: "bodySmall",
      color: "field.text.muted",
      userSelect: "none",
    },
    // Separates option groups; the inline variant flips it vertical.
    divider: {
      flexShrink: 0,
      backgroundColor: "border.divider",
      width: "token(spacing.full)",
      height: "token(spacing.xxs)",
    },
  },
  variants: {
    tone: {
      default: {
        // Self-contained field surface, like the calendar's default
        // tone — edge as a box-shadow so the width arithmetic holds.
        root: {
          backgroundColor: "field.bg.default",
          boxShadow:
            "inset 0 0 0 0.5px var(--colors-field-border-default)",
        },
      },
      onBrand: {
        // The Combobox popover owns the surface, so the root just
        // fills it and the palette inverts.
        root: { width: "token(spacing.full)" },
        search: {
          color: "field.text.active",
          borderBottomColor: "field.border.active",
          "&::placeholder": { color: "field.text.activeMuted" },
        },
        option: {
          color: "field.text.active",
          // Same selected-row guard, and the same split of the roving
          // highlight from the modality-gated :hover, as the base tone
          // (see there). This override has to repeat the split: left
          // combined, its ungated :hover would outrank the base rule
          // and keep tinting the row under a parked cursor.
          "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
            { backgroundColor: "field.bg.hoverBrand" },
          ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
            { backgroundColor: "field.bg.hoverBrand" },
          // Neutral chip against the brand surface.
          "&[aria-selected='true'], &[aria-pressed='true']": {
            backgroundColor: "field.bg.selected",
            color: "field.text.default",
          },
          // Neutral chip, so no brand edge — see the base slot's ring.
          "&[aria-selected='true']::after, &[aria-pressed='true']::after":
            { borderWidth: 0 },
          "&:disabled": {
            "&:hover, &[data-active]": {
              backgroundColor: "transparent",
            },
          },
        },
        empty: { color: "field.text.activeMuted" },
      },
      plain: {
        // For a menu whose Popover already owns the surface (the slash
        // menu): the neutral sibling of onBrand, but the root also
        // COLLAPSES, so the listbox sits directly in the popover and
        // the list's own padding is the only gap.
        root: { display: "contents" },
      },
    },
    // How tall the scroll box may grow.
    //   scroll  — the base cap: 7 full rows plus a half-row peek that
    //             signals there is more to reach. Right for a long,
    //             browsable list (the Combobox's fruit list).
    //   content — hug the rows, so a menu that FITS shows itself whole
    //             instead of inventing a scrollbar it doesn't need
    //             (the slash menu, whose 11 commands are the whole
    //             vocabulary — seeing them all is the point). Still
    //             bounded by the viewport, so a list taller than the
    //             screen stays scrollable rather than running off it.
    fit: {
      scroll: {},
      content: {
        list: { maxHeight: "calc(100dvh - token(spacing.5xl))" },
      },
    },
    // The row pitch (Figma 1027:2276 for `sm`).
    //   md — the default: a 32px row, 24px of line box on a 4px inset
    //        all round, rows abutting so each is its own hit target.
    //   sm — the dense list: the inset goes vertical-first, so the row
    //        IS its 24px line box and a 2px gap does the separating a
    //        padded row did. The search strip drops 40 → 28 and its
    //        text 16 → 14 with it, or a full-size field would sit over
    //        a list two thirds its pitch.
    size: {
      md: {},
      sm: {
        search: {
          height: "token(sizes.optionSearchSm)",
          textStyle: "bodySmall",
        },
        list: {
          gap: "xs",
          paddingInline: "sm",
          // The list keeps an inset of its own top and bottom, so the
          // first and last rows are not flush against the search strip
          // and the bottom edge (Figma 1027:2282).
          paddingBlock: "sm",
          // Read exactly as the base cap above it: the rows it means to
          // show, plus their gaps, plus the list's own block padding,
          // plus a half-row peek that says there is more to scroll. A
          // shorter row fits more of them in — 9 here against the
          // base's 7.
          maxHeight:
            "calc(9 * token(sizes.optionRowSm) + 8 * token(spacing.xs) + 2 * token(spacing.sm) + token(spacing.lg))",
        },
        option: { paddingInline: "sm", paddingBlock: "none" },
        empty: { height: "token(sizes.optionRowSm)" },
      },
    },
    direction: {
      // The vertical list is already encoded in the base.
      block: {},
      // A row — toolbars and horizontal single-selects. The root
      // collapses so the options sit directly in the consumer's frame
      // (e.g. selectionPopover), which owns the pill surface.
      inline: {
        root: { display: "contents" },
        list: {
          flexDirection: "row",
          alignItems: "center",
          gap: "xs",
          maxHeight: "none",
          overflow: "visible",
          width: "max-content",
          padding: "none",
        },
        option: { width: "auto" },
        divider: {
          width: "token(spacing.xxs)",
          height: "auto",
          alignSelf: "stretch",
        },
      },
    },
  },
  defaultVariants: {
    tone: "default",
    direction: "block",
    fit: "scroll",
    size: "md",
  },
  // Runtime variant values — force every branch to be emitted.
  staticCss: [
    { tone: ["*"], direction: ["*"], fit: ["*"], size: ["*"] },
  ],
});
