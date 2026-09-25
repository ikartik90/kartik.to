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
      // There is a cursor on this device — a mouse or a trackpad, not a finger.
      // The site's affordances split on it: hover chrome and keyboard-shortcut
      // hints are an offer to a visitor who has the hardware to take them up,
      // and are noise on a touch-first device, where there is no pointer to
      // reveal them with and no key to press. Same query the custom cursor is
      // gated on in globals.css — one definition of "cursor-first" for both.
      //
      // Imported rather than written out, for the reason `bottomSheet` below
      // is: the command palette has to ask this one in JS too (`useHasCursor`),
      // and a stylesheet and a script disagreeing about what a cursor is would
      // draw a keyboard hint on a device that cannot press it.
      hasCursor: `@media ${HAS_CURSOR_QUERY}`,
      // The properties panel as a BOTTOM SHEET — see `BOTTOM_SHEET_QUERY` for
      // what the query says and why. Imported rather than written out, because
      // a pointer handler has to ask the browser the same question at press
      // time and the two must not drift.
      bottomSheet: `@media ${BOTTOM_SHEET_QUERY}`,
      // A rail on a viewport the page does not inset for — see
      // `NARROW_RAIL_QUERY`.
      narrowRail: `@media ${NARROW_RAIL_QUERY}`,
      demoFrameNarrow: "@container demoFrame (max-width: 760px)",
      demoFrameCompact: "@container demoFrame (max-width: 535px)",
      // The Shift Scheduling v0 form once its two columns have STACKED — the
      // one state where the calendar is alone on its line and the field column
      // is no longer beside it. 448px is not a width picked for the demo: it is
      // 2 × the calendar's 208px measure (7 × 24 cells + 6 × 4 gutters + 2 × 8
      // inset) plus the 32px column gap, which is exactly the crossover the
      // form's own flex floor already wraps at — the query restates it rather
      // than introducing a second, disagreeing breakpoint. Container, not
      // viewport: the form is staged in a DemoFrame that can be any width.
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

  // The one global declaration this config makes, and it exists to correct a
  // FALLBACK rather than to add a style.
  //
  // Panda's `focusVisibleRing` utility resolves its colour as
  // `var(--focus-ring-color-prop, var(--global-color-focus-ring, #005FCC))`.
  // Nothing here ever set that middle variable, so every focus ring in the app
  // — every button, every tile, every field — was drawing the preset's
  // hardcoded #005FCC blue. It reads as a browser default rather than as a
  // mistake, which is exactly why it survived: the one place it is obvious is
  // the presets strip, where a blue ring lands beside the brand-coloured ring
  // that marks the open cover and the two plainly disagree.
  //
  // Pointed at the SAME token that ring uses, so the two are one colour by
  // construction. A `var()` rather than a token reference because the semantic
  // token is already theme-aware — it resolves to brand pink or brand orange
  // under `_dark` on its own, and copying its value here would freeze one of
  // the two.
  globalCss: {
    ":root": {
      "--global-color-focus-ring": "var(--colors-border-focus-ring)",
    },
    // A media object that has nothing to paint yet — the hook is stamped by
    // `Media` on whichever element the fork produced, and let go the moment the
    // source can size itself. The box it sits in is already being HELD open by
    // an inline `aspect-ratio` (`mediaReservationStyle`); this is only what
    // goes inside it.
    //
    // Global rather than a slot in each of the four recipes that draw media,
    // for the reason the attribute is global: one component decides that an
    // object is waiting, so one rule should say what waiting looks like. A
    // reserved box is a new state for every surface at once — the article
    // block, the collection's lone tile, the library's preview and its
    // thumbnails — and four copies of it is four places for the shimmer to
    // drift.
    //
    // It paints as the element's OWN background rather than as a layer behind
    // it, which is what makes it exclusive with the checkerboard by
    // construction (see `collectionGrid`'s `image` slot): an object has one
    // ground, and while it is waiting the ground is this.
    // The grip a bottom sheet is pulled down by — the panel's own header, which
    // is a line of text. iOS starts a selection from the touch gesture rather
    // than from a cancelable mousedown, so it anchors on that title and paints
    // it blue with a Copy / Look Up callout over it while the sheet is being
    // dragged. The same defect the slider rows carry, and the same two-part
    // answer: this stops the anchor forming, and `control-drag` covers where
    // the gesture then travels.
    //
    // Global, and keyed on the attribute `useSheetDrag` hands out WITH its
    // handlers, for the reason the media rule below is global: one hook decides
    // what a grip is, so one rule should say what a grip refuses. One panel
    // drags its sheet today and its header is its own; the next one to wire the
    // hook gets this without having to know it exists.
    //
    // Scoped to the sheet — a docked rail's header is dragged by nobody and
    // keeps ordinary selection, which is how its `touch-action` is scoped too.
    "[data-sheet-grip]": {
      _bottomSheet: {
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      },
    },
    "[data-media-pending]": {
      backgroundColor: "var(--colors-bg-surface)",
      // The same shape of highlight the wireframe's bars use — a travelling
      // dip rather than a blend toward a second named colour, so it reads in
      // both themes off one declaration. `bg.canvas` is the neighbouring step
      // of the same neutral, lighter in light and darker in dark, so the sweep
      // moves the same DIRECTION as the surface it crosses in either.
      backgroundImage:
        "linear-gradient(90deg, transparent 0%, transparent 35%, color-mix(in srgb, var(--colors-bg-canvas) 70%, transparent) 50%, transparent 65%, transparent 100%)",
      backgroundSize: "200% 100%",
      // The same keyframe and the same clock as `wireframe`'s loading mode —
      // one pace for everything in the app that is waiting.
      animation: "wireframeShimmer 1.6s ease-in-out infinite",
    },
    "@media (prefers-reduced-motion: reduce)": {
      // The plate stays; only the sweep goes. A held box with no motion in it
      // still says "something is coming" by being there.
      "[data-media-pending]": { animation: "none" },
    },
    // The colour picker's overflow answer, and a CLAMP rather than the
    // `flip-block` every other anchored menu here uses. Flipping puts a 492px
    // panel's BOTTOM on its trigger, which for a row low on the screen throws
    // the whole thing off the top — the panel is taller than the distance it
    // would be flipping across. Pinning it to the foot of the viewport instead
    // keeps every row of it on screen and gives up only the level-with-the-row
    // alignment, which is the part that was never load-bearing.
  },

  outdir: "styled-system",
});
