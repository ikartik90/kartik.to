import { defineSlotRecipe } from "@pandacss/dev";

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
    // Must stay last: slot order sets CSS order, so its `animation` beats `root`'s.
    "exiting",
  ],
  base: {
    root: {
      position: "fixed",
      zIndex: 50,
      insetBlock: 0,
      insetInlineEnd: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      width: "token(sizes.propertiesPanelWidth)",
      maxWidth: "100vw",
      // A shadow, not a border: a 0.5px border puts this fixed layer's content on a subpixel.
      // The edge lives in a custom property so the bottom sheet can re-point it.
      "--panel-hairline":
        "inset 0.5px 0 0 var(--colors-border-divider)",
      backgroundColor: "bg.surface",
      "--colors-field-bg-default":
        "var(--colors-field-bg-default-on-surface)",
      boxShadow:
        "var(--panel-hairline), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
      // Scrolls on both axes: the rows have a fixed width a phone may not fit.
      overflow: "auto",
      overscrollBehavior: "contain",
      animation: "propertiesPanelIn 200ms ease-out",
      // `visibility` flips after the slide, so a dismissed panel leaves the tab order.
      transition: "translate 200ms ease-out, visibility 0s",
      "&[data-dismissed]": {
        translate: "100% 0",
        visibility: "hidden",
        transitionDelay: "0s, 200ms",
      },
      // An upright phone docks it to the bottom edge, half the viewport tall (`dvh`).
      _bottomSheet: {
        insetBlockStart: "auto",
        insetInline: 0,
        width: "token(spacing.full)",
        maxWidth: "none",
        height: "50dvh",
        "--panel-hairline":
          "inset 0 0.5px 0 var(--colors-border-divider)",
        animation: "bottomSheetIn 200ms ease-out",
        "&[data-dismissed]": { translate: "0 100%" },
        "&[data-dragging]": { transition: "none" },
      },
    },
    header: {
      // Needs its own fill: the root's is behind the scrolled content.
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
      // Redraws the panel's edge: the root's inset hairline paints under this opaque strip.
      boxShadow:
        "var(--panel-hairline), inset 0 -0.5px 0 var(--colors-border-divider)",
      // One ink for the strip: icon buttons paint in `currentColor`.
      color: "text.body",
    },
    title: {
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    section: {
      // Content-sized; flexing would squeeze sections to fit the panel.
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      // A shadow, not a border: borders here accumulate subpixel offsets. See `root`.
      boxShadow: "inset 0 -0.5px 0 var(--colors-border-divider)",
    },
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
    // Each labelled row is a `Field` relaid as a label ∣ control ∣ action grid, keeping its native
    // label association. A descendant selector, so it doesn't tie on specificity with `field`.
    controlPanel: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "md",
      padding: "lg",
      // Icon actions paint in `currentColor`; without this they take the page's brighter ink.
      color: "text.body",
      // Full-width controls still stop at the action column.
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
      "& [data-property-control] > label": { width: "auto" },
      // Opt-in for controls taller than one row (the ramp): centring floats the label between rows.
      "& [data-property-control][data-control-align='start']": {
        alignItems: "start",
      },
      // A one-cell-high band, so the label shares the first row's midline.
      "& [data-property-control][data-control-align='start'] > label": {
        minHeight: "token(sizes.toolbarButton)",
        display: "flex",
        alignItems: "center",
      },

      // Rows tied under one action (the icon set's size and stroke).
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
      "& [data-property-tie] [data-property-control]": {
        gridTemplateColumns:
          "token(sizes.propertyRowLabel) token(sizes.propertyRowField)",
      },
      // The bracket joining the tied rows to their chip, in the field's border colour.
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

      // On a sheet the field column takes the slack. `minmax(0, 1fr)`, not `1fr`, so wide content
      // can't push the action column off the edge.
      _bottomSheet: {
        "& [data-property-control]": {
          width: "token(spacing.full)",
          gridTemplateColumns:
            "token(sizes.propertyRowLabel) minmax(0, 1fr) token(sizes.propertyRowAction)",
        },
        "& [data-property-tie] [data-property-control]": {
          width: "token(spacing.full)",
          gridTemplateColumns:
            "token(sizes.propertyRowLabel) minmax(0, 1fr)",
        },
      },
    },
    // Frameless prose (a caption, a note); the section header is its label.
    text: {
      // Stops at the field column, like every other row.
      width:
        "calc(token(spacing.full) - token(spacing.md) - token(sizes.propertyRowAction))",
      minWidth: 0,
      margin: "none",
      background: "transparent",
      border: "none",
      padding: "none",
      textStyle: "sidenote",
      color: "text.body",
      caretColor: "text.body",
      focusVisibleRing: "none",
      // Grows with its content and never scrolls itself; `rows` is the fallback without `field-sizing`.
      resize: "none",
      fieldSizing: "content",
      overflow: "hidden",
      _placeholder: { color: "text.body/40" },
    },
    // A class because `className` is the only hook onto the shared Popover's element.
    // `forwards` holds it off-screen until React unmounts it.
    exiting: {
      animation: "propertiesPanelOut 200ms ease-in forwards",
      pointerEvents: "none",
      _bottomSheet: {
        animation: "bottomSheetOut 200ms ease-in forwards",
      },
    },
  },
});
