"use client";

import { css } from "../../styled-system/css";
import { MenuButton } from "@/components/menu-button";
import { ScrimBlur } from "@/components/scrim-blur";
import { ThemeToggleButton } from "@/components/theme-toggle";

// ---------------------------------------------------------------------------
// The site's two gutter controls, on the band an article opens with.
//
// A playground has to carry them itself: `Header` draws them for the homepage
// alone, and an article hangs them off its intro row. Shared because the
// calchemy and icons playgrounds are the same page in this respect — one
// full-height scroller with a frosted band pinned over the top of it — and
// the band is sixty lines of positioning whose every number has a reason.
// Written out twice, the second copy is where those reasons go to rot.
//
// FIXED, not in the page's flow: a band inside the scroller would scroll away
// with the first row of content. It is the mirror of each playground's own bar
// at the foot — an overlay the scrollport runs under, with the page reserving
// its height at both ends so nothing ever comes to rest behind it.
//
// HOW TALL is the PAGE's to say, through `--chrome-band`, because the height
// of this box and the room reserved above the content are the same number and
// one of them not knowing what the other did would either cover the first row
// or hold room for a band that is not there. The fallback is the site's 80px
// so a page that forgets still gets a band rather than a collapsed strip.
//
// What it deliberately does NOT own is the room it takes. A page reserves that
// itself (`padding-block-start`, `scroll-padding-top`), since only the page
// knows what is scrolling under the band.
// ---------------------------------------------------------------------------

const CHROME_BAND = "var(--chrome-band, token(spacing.5xl))";

/** The frosted clearance under the band, matching each playground's foot. */
const SCRIM_CLEARANCE = "token(spacing.3xl)";

// The strip runs the width of the page and the controls sit in a box the
// content's own width inside it, so the menu and the toggle land on the
// content's left and right edges. Two boxes rather than one because the inner
// `100%` has to be the space LEFT of the rail: a fixed box is measured against
// the viewport, so a width capped against `100%` would not know the rail was
// there.
const chromeStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  height: `calc(${CHROME_BAND} + ${SCRIM_CLEARANCE})`,
  // The band dissolves into the page rather than ending on a line — the foot's
  // gradient, upside down, with `ScrimBlur` laying the foot's frosting over it
  // the same way. `bg.canvas` because a playground has no panel of its own to
  // fade over.
  backgroundImage:
    "linear-gradient(to bottom, token(colors.bg.canvas), transparent)",
  // The scrollport runs underneath, so the strip must not eat the wheel. The
  // controls take their own presses back.
  pointerEvents: "none",
  zIndex: 1,
  // The band is the page's, so it is centred in what the page has:
  // `--page-inset-end` is what a docked rail insets the page by, and it is 0
  // wherever no rail is docked. Every playground puts its controls in the same
  // place at every width as a result.
  insetInlineEnd: "var(--page-inset-end, 0px)",
  // A custom property flips instantly while the page's own padding is
  // transitioned, so without this the band would jump the width of the rail
  // while the page slid. 200ms ease-out is what globals.css moves the page by.
  transition: "inset-inline-end 200ms ease-out",
});

// The site's showcase measure with the page's own 20px margin below it, the
// band's height, and the two ends of a two-column grid — the menu on the left,
// the theme toggle pushed to the right of the second column.
const chromeRowStyle = css({
  // ABOVE the band's frosting, and this is painting order rather than taste.
  // The blur layers are `position: absolute` and this row is not, and a
  // stacking context paints its positioned descendants AFTER its in-flow ones
  // however they are written — so the frosting landed on top of the two
  // controls and took them into its own backdrop. The menu's ⌘K chip came out
  // smeared with the page showing through it.
  //
  // The foot has never had the problem because its bar is a SIBLING of the
  // scrim rather than a child, sitting a z-index above it. This is that same
  // arrangement said from inside: the band frosts the page behind it, and the
  // navigation stands clear of it.
  position: "relative",
  zIndex: 1,
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  marginInline: "auto",
  height: CHROME_BAND,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  // The menu's row alone on a phone, 8px down from the top of the screen — the
  // same standoff the shader's canvas keeps from its own edges.
  _bottomSheet: { paddingBlockStart: "md" },
  // The strip itself is inert so the scrollport under it still takes the wheel;
  // the controls take their own presses back.
  "& > *": { pointerEvents: "auto" },
});

/** The band's trailing cluster. */
const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

export function PlaygroundChrome() {
  return (
    <div className={chromeStyle}>
      {/* Behind the controls, and inert with the strip: `chromeRowStyle` takes
          its own children's presses back, and these are not among them. */}
      <ScrimBlur towards="bottom" />
      <div className={chromeRowStyle}>
        <MenuButton />

        <div className={chromeEndStyle}>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}
