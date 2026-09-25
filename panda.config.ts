import { defineConfig } from "@pandacss/dev";
import {
  BOTTOM_SHEET_QUERY,
  HAS_CURSOR_QUERY,
  NARROW_RAIL_QUERY,
} from "./src/data/media-queries";
import { recipes, slotRecipes } from "./src/components/ui/recipes";
import { keyframes } from "./src/data/theme/keyframes";
import { semanticTokens } from "./src/data/theme/semantic-tokens";
import { textStyles } from "./src/data/theme/text-styles";
import { tokens } from "./src/data/theme/tokens";

export default defineConfig({
  presets: [],
  preflight: true,

  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  conditions: {
    extend: {
      starting: "@starting-style",
      dark: '.dark &, [data-theme="dark"] &',
      // Queries shared with JS are imported so the stylesheet and the script cannot drift.
      hasCursor: `@media ${HAS_CURSOR_QUERY}`,
      bottomSheet: `@media ${BOTTOM_SHEET_QUERY}`,
      narrowRail: `@media ${NARROW_RAIL_QUERY}`,
      demoFrameNarrow: "@container demoFrame (max-width: 760px)",
      demoFrameCompact: "@container demoFrame (max-width: 535px)",
      // 2 × the calendar's 208px + the 32px gap: where the form's columns already wrap.
      shiftFormStacked: "@container shiftForm (max-width: 448px)",
    },
  },

  theme: {
    breakpoints: {
      md: "820px",
      lg: "1200px",
    },

    extend: {
      tokens,
      containerNames: ["demoFrame", "projectsGrid", "shiftForm"],
      semanticTokens,
      keyframes,
      recipes,
      slotRecipes,
      textStyles,
    },
  },

  // Panda's focus ring falls back to a hardcoded blue unless this is set.
  globalCss: {
    ":root": {
      "--global-color-focus-ring": "var(--colors-border-focus-ring)",
    },
    // Stops iOS anchoring a text selection on a dragged sheet's header.
    "[data-sheet-grip]": {
      _bottomSheet: {
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      },
    },
    "[data-media-pending]": {
      backgroundColor: "var(--colors-bg-surface)",
      backgroundImage:
        "linear-gradient(90deg, transparent 0%, transparent 35%, color-mix(in srgb, var(--colors-bg-canvas) 70%, transparent) 50%, transparent 65%, transparent 100%)",
      backgroundSize: "200% 100%",
      animation: "wireframeShimmer 1.6s ease-in-out infinite",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "[data-media-pending]": { animation: "none" },
    },
  },

  outdir: "styled-system",
});
