"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { propertiesPanel, toolbar } from "../../../../styled-system/recipes";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePropertiesPanelInset } from "@/hooks/use-properties-panel-inset";
import { useSheetDrag } from "@/hooks/use-sheet-drag";
import { isBottomSheetLayout } from "@/data/media-queries";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { AspectRail } from "@/components/aspect-rail";
import { deleteShaderPreset, publishShaderPreset, unpublishShaderPreset } from "@/app/actions/shader-preset";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoPreloader } from "@/components/demo-component";
import { useTrickleProgress } from "@/hooks/use-demo-loader";
import { PresetsPane } from "./presets-pane";
import { ShaderStage } from "./shader-stage";
import { useDraftHistory } from "./use-draft-history";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { ColorSwatchGrid } from "@/components/ui/input/color-swatch-grid";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { ToggleBar } from "@/components/ui/input/toggle-bar";
import { OptionList } from "@/components/ui/input/option-list";
import { Typography } from "@/components/ui/typography";
import { Tooltip } from "@/components/ui/tooltip";
import BottomSheetIcon from "@/assets/icons/bottom-sheet.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import {
  SHADER_IDS,
  extraColorRows,
  SHADER_SPECS,
  FRAMING_CONTROL_KEYS,
  MOTION_CONTROL_KEYS,
  type ControlSpec,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import {
  framingFor,
  paletteFor,
  shaderParamsFor,
  type ShaderPresetSettings,
  type ShaderPresetTheme,
  type ThemedColor,
} from "@/domain/shader-preset";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// Shader Playground — where a preset's background is tuned, on its way to being
// published as a component. The art it is aimed at is the fanned light blades
// and soft colour washes of the reference presets.
//
// One shader is mounted at a time, which is deliberate: every paper-shaders
// instance holds its OWN webgl2 context, the library pools nothing and
// registers no `webglcontextlost` handler, so a page that rendered all five
// side by side would be one long session away from blank canvases. Compare by
// switching, not by tiling.
//
// The controls come from the table in `shader-specs.ts` rather than being
// written out here, so a range can only be wrong in one place.
//
// Client-side throughout: this is one long-lived piece of local state — which
// shader, its uniforms, the canvas theme — over a WebGL canvas, and none of it
// is the server's business. `page.tsx` next to this file is the route.
// ---------------------------------------------------------------------------

// The page is the viewport, edge to edge — the canvas takes all of it.
//
// The panel's width is NOT reserved here: `usePropertiesPanelInset` insets the
// body while a panel is docked, everywhere in the app, and this page opts into
// that like every other. Reserving it a second time would inset the canvas
// twice and leave a band of nothing between the two.
//
// `padding: none` is stated rather than omitted because `main` already carries
// the site's own (globals.css) — 20px inline, 32px block — which would inset
// the canvas from the edges it is meant to reach. That inset is also why the
// panel is `fixed` rather than a flex child: in flow it would sit inside the
// padding instead of flush to the viewport's top, bottom and right.
//
// Two lengths the page hands down rather than each part working out for
// itself, because they are the SAME division of the viewport read twice: the
// canvas leaves room at its foot for the sheet, and the card sizes itself to
// what is left. Written as one variable the other is derived from, so the two
// cannot disagree about where the halfway line is.
//
//   --sheet-space  what the properties panel is holding: nothing while it is a
//                  side rail (it is `fixed`, and the body's own inset already
//                  answers for that), half the viewport while it is a sheet,
//                  and nothing again once the sheet has been sent away.
//   --presets-space what the saved-presets strip is holding at the foot of the
//                  canvas: nothing at all when there is no strip. Its own tiles
//                  and padding (80 + 2×12), the band its unsaved marks hang in
//                  above the plate (another 16), and the four pixels it stands
//                  off the bottom edge — the same tokens the pane itself is
//                  built from, so the two cannot drift.
//   --canvas-band  the room reserved above AND below the picture: whichever of
//                  the two pieces of chrome is taller, mirrored. Mirrored
//                  because a picture centred between two UNEQUAL bands is not
//                  centred in the viewport — it used to sit 22px high with a
//                  strip on screen and 40px low without one, since the gutter
//                  row is 80 and the strip is 124. Taking the larger of the two
//                  on both sides costs the picture some height and buys the one
//                  thing a thing being judged should have, which is the middle
//                  of the screen.
//
//                  The SHEET is deliberately not in it. It is not chrome over
//                  the picture, it is a panel that takes the bottom half of the
//                  phone — so the canvas is the top half, and the picture
//                  centres in THAT. Mirroring it would reserve half the screen
//                  above the picture as well and leave nothing to draw in.
//   --canvas-head  the reserve ABOVE the picture, and
//   --canvas-foot  the reserve BELOW it. Two names for what the band was one
//                  name for, because a PHONE does not mirror. There, the two
//                  ends hold different things and each holds only its own: the
//                  gutter row above, and whichever of the sheet and the strip
//                  is at the foot. Mirroring on a phone is what made the card
//                  an icon — 812px of screen with 124 reserved twice over, 406
//                  given to the sheet and 40 of margins left 118px to draw a
//                  poster in.
//   --card-gutter  the margin the card keeps inside all that: the page's own
//                  20px, and 8px on a phone, where every pixel the card is not
//                  drawn in is one it did not have to give up.
//   --chrome-band  how tall the gutter controls' box is: the site's 80px band,
//                  and the menu's own row plus its standoff on a phone. Named
//                  because the box's height and the room reserved above the
//                  picture are the same number, and one of them not knowing
//                  what the other did would either overlap the card or hold
//                  room for a row that is not there.
//   --rail-space   what the aspect rail is holding UNDER the card: nothing at
//                  all where it rides in the gutter row, and its own 40px plus
//                  the 8px it stands off the card on a phone. In the card's
//                  budget rather than in a canvas reserve, because it is not a
//                  band at the edge of anything — it is a second thing in the
//                  middle of the canvas that the card divides the room with.
//   --card-space   everything the preset may NOT have: both reserves and two
//                  gutters. It is the block axis alone — the width term reads
//                  the same gutter off the canvas it is centred in.
//
// One declaration rather than one per layout, which `--sheet-space` is what
// makes possible: it is 0px wherever there is no sheet, so the same expression
// reads correctly on a desktop, on a phone under a sheet, and on the same phone
// once the sheet has been sent away.
const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  padding: "none",
  gap: 0,
  "--sheet-space": "0px",
  "--presets-space": "0px",
  "--canvas-band": "max(token(spacing.5xl), var(--presets-space))",
  "--canvas-head": "var(--canvas-band)",
  "--canvas-foot": "calc(var(--sheet-space) + var(--canvas-band))",
  "--card-gutter": "token(spacing.xxl)",
  "--chrome-band": "token(spacing.5xl)",
  "--rail-space": "0px",
  "--card-space":
    "calc(var(--canvas-head) + var(--canvas-foot) + var(--rail-space) + 2 * var(--card-gutter))",
  // The phone, where the two ends stop being the same number.
  //
  // Above: the gutter row and nothing else — the strip is not up there, so
  // there is nothing for its band to be mirrored for.
  //
  // Below: the LARGER of the sheet and the strip, not their sum. The sheet
  // covers the strip now rather than riding above it (see `presets-pane`), so
  // reserving both would hold room for a strip nobody can see. `max` is what
  // says that: with the sheet up it is the sheet, and with the sheet away it
  // is the strip again.
  _bottomSheet: {
    "--sheet-space": "50dvh",
    // 8 + 40: the standoff from the top of the screen, and the menu's row.
    // Given the `md` rail's own 40px, so the row the menu sits in is the height
    // a rail would have been — the two are the same furniture at opposite ends
    // of the canvas. It was the site's 80px band, which is a number that fills
    // a gap an article already opens above its first row; there is no such gap
    // here, so 80px stopped being a band being filled and became 52px of air
    // being made. See globals.css `[data-site-menu]`.
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
    // The rail's 40px and the 8px it stands off the card — the same 8px as the
    // standoff above and as the card's own gutter, so the phone layout is one
    // number throughout.
    "--rail-space": "calc(token(spacing.4xl) + token(spacing.md))",
    "--canvas-head": "var(--chrome-band)",
    "--canvas-foot": "max(var(--sheet-space), var(--presets-space))",
    "--card-gutter": "token(spacing.md)",
  },
  // A strip is on screen, so the picture gives up its band. Asked of the PANE
  // rather than of the session, because "is there a strip" is no longer the
  // same question as "is the author signed in": a visitor is shown the
  // published presets, and gets no strip only when there are none. The pane is
  // the one thing that knows, and `:has()` is what lets it say so without the
  // page holding a second copy of the list to count.
  //
  // The arithmetic stays here, which is the half that was always right: the
  // page owns the division of the viewport and every part reads it off one
  // variable — the same call the dismissed sheet's attribute makes below.
  "&:has([data-presets])": {
    "--presets-space":
      "calc(token(spacing.5xl) + 2 * token(spacing.lg) + token(spacing.xl) + token(spacing.sm))",
  },
  // The sheet is gone, so the canvas has the whole screen back. An attribute
  // rather than a second media query: it outranks the one above wherever it is
  // set, and means nothing at all in the orientations that have no sheet.
  "&[data-sheet-dismissed]": { "--sheet-space": "0px" },
});

// The canvas: everything the panel leaves, with the preset in the middle of
// THAT rather than of the viewport, so the panel never presets the thing being
// judged. Positioned because the theme control sits in its corner. It takes no
// ground of its own — the page's `bg.canvas` is already the right one, in
// whichever theme is in force.
const canvasStyle = css({
  position: "relative",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // The same band above and below, so the picture lands in the middle of what
  // it is being looked at in. Chrome must not preset the thing being judged —
  // the gutter row's controls above, the presets strip below — and reserving
  // each side only what its own chrome needs left the picture off-centre by the
  // difference between them. See `--canvas-band`.
  //
  // The sheet is in the FOOT alone: it is the bottom half of a phone rather
  // than chrome over the picture, so the canvas becomes the top half and the
  // picture centres in that. One declaration for every layout, because the two
  // reserves are worked out by the page — see `--canvas-head` / `--canvas-foot`,
  // which are the mirrored band everywhere but on a phone.
  paddingBlockStart: "var(--canvas-head)",
  paddingBlockEnd: "var(--canvas-foot)",
  transition: "padding-block 200ms ease-out",
  // The same phone on its side: a rail again, on a viewport globals.css does
  // not inset for (that starts at 820px). MARGIN rather than padding, because
  // what has to move is not just the picture — the gutter controls are
  // absolutely positioned against this box, and an absolute child is laid out
  // against the PADDING box, so padding would leave the theme toggle sitting
  // underneath the rail.
  _narrowRail: { marginInlineEnd: "token(sizes.propertiesPanelWidth)" },

  // On a phone the canvas holds TWO things rather than one: the card, and the
  // aspect rail 8px under it. A column, so the pair is centred together and the
  // rail tracks the card's bottom edge whatever shape it is in — which is the
  // whole point of moving it down here. The gutter row and the presets strip
  // are out of flow and take no part in it.
  _bottomSheet: { flexDirection: "column", gap: "md" },
});

// The gutter controls, in the seat they take everywhere else: an 80px band
// across the top, the menu on the left and the theme toggle answering from the
// right.
//
// Flush with the SHOWCASE, not with the viewport. The pair is confined to the
// same centred `min(100%, 960px)` box the site header and an article's intro
// are — the width the page reads at — so past 960 the two controls hold still
// and below it they come in with the box, on the page's own 20px margin. The
// canvas behind them still runs to the edges; only the controls are confined,
// which is the whole point of the rule. (Same declarations as
// `[data-site-header]` in globals.css. Restated because that rule also hangs
// the pair off `bottom: 100%`, clear of the row they are anchored to — which
// on an article is the intro and here would be the top of the screen.)
//
// Out of flow, for the reason that rule gives: the controls are the only thing
// that has ever run out of room, so the card underneath keeps the whole canvas
// to centre itself in rather than being pushed down by a strip.
const canvasChromeStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInline: 0,
  marginInline: "auto",
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  height: "var(--chrome-band)",

  // The two ends and nothing between them: the menu on the left, the theme
  // toggle pushed to the right of the second column.
  //
  // It was three columns with EQUAL outer ones, which held the aspect rail on
  // the row's own midline whatever the ends weighed — the rail is out of this
  // box now (see `aspectRailStyle`), and a third column kept open for it would
  // push the toggle to the middle of the row.
  //
  // Why the rail left: on a phone the three across ran the row out of width. It
  // had been measured and found to fit — 330 of 335px at the narrowest viewport
  // this page draws — but that was before the rail grew the panel's way back,
  // and before the sheet started life collapsed, which is what puts that button
  // on the band from the first paint rather than only after a dismissal. The
  // three came to 375px on a 335px row, and what gave was the menu's ⌘K chip,
  // underneath the rail.
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",

  // A PHONE gets two rows instead: the page's two controls on the site's own
  // band, and the rail on a line of its own 4px beneath it.
  //
  // Because the row ran out — which the note above measured and found it did
  // not, at 330 of 335px. That was before the rail grew the panel's way back,
  // and before the sheet started life collapsed, which is what puts that button
  // on the band from the first paint rather than only after a dismissal. The
  // three across came to 375px on a 335px row, and what gave was the menu's ⌘K
  // chip, underneath the rail.
  //
  // The menu's row alone on a phone, 8px down from the top of the screen — the
  // same 8px the card keeps from the canvas's edges. The rail is not in this
  // box there; it is under the card, which is what gave the row its width back.
  _bottomSheet: { paddingBlockStart: "md" },
});

// The aspect rail's box: the app's shared toolbar, hugging its contents.
//
// It rides in the GUTTER ROW on a desktop, between the menu and the theme
// toggle. The frame is a property of the page there — there is one preset, and
// this says what shape you are looking at it in — so it belongs with the page's
// other two controls, holding still while the picture changes shape underneath
// it.
//
// On a PHONE it travels with the picture instead, 8px under the card. Not a
// change of mind about what it is: the row simply has no width for it (see
// `canvasChromeStyle`), and of the two places a control can go when its row
// runs out, the thing it acts on is the better one. It is also a seat the app
// already draws — a grid card's rail takes it for its own reasons, belonging to
// one card among many and having to point at it.
//
// A hairline and nothing else. The card's rail buys elevation as well because
// it floats over a picture; this one stands on the page's own ground, where a
// shadow would be an object casting one onto the surface it is lying on.
//
// NOT clipped, which it used to be. The clip guarded a corner the `md` rail's
// own 6px inset already guards — its buttons never reach the rail's edge, so
// there is nothing there to square it off — and it cost the one thing the rail
// now has to let out: the unsaved-framing dots, which hang beneath the buttons
// and outside the rail on purpose. See `AspectRail`'s `markedAspects`.
const aspectRailStyle = css({
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "visible",

  // WHERE it sits, which is two answers now rather than one.
  //
  // A DESKTOP keeps the seat it has always had: the middle of the gutter band,
  // on the canvas's midline. Out of flow and centred on the CANVAS rather than
  // held in the gutter row's middle column, because it is no longer in that box
  // — and it lands on the same pixel either way, since that box is itself
  // centred on the canvas and the rail was centred in the box. Centred in the
  // band's height too, at `(80 - 40) / 2`, read off `--chrome-band` so a band
  // that changes height takes the rail with it.
  position: "absolute",
  insetBlockStart: "calc((var(--chrome-band) - token(spacing.4xl)) / 2)",
  insetInline: 0,
  marginInline: "auto",
  // Shrink to the buttons. An absolutely positioned box with both inline insets
  // at 0 and `width: auto` fills its containing block instead, which would draw
  // the rail's hairline right across the canvas.
  width: "max-content",

  // A PHONE puts it back in flow, under the card — the canvas is a column there
  // and its 8px gap is the standoff. Nothing else to say: the column centres it,
  // and it follows the card's bottom edge as the shape changes.
  _bottomSheet: { position: "static" },
});

// The preset the reference art is drawn on: portrait, generously rounded. The
// shader fills it because Fit opens on `preset` — a ground with margins is just
// a smaller picture — but Fit is a control now, so this is a default and not a
// guarantee.
// The card is as large as its chosen shape fits, and the same shape smaller
// wherever there is not room — a phone under a sheet, a phone on its side, a
// short desktop window. Sized on ONE axis with the ratio doing the rest, so it
// can never come out stretched: the width is the narrowest of four numbers, the
// last two of which read the space that is actually left.
//
// `--preset-w` / `--preset-h` are the chosen frame, written inline by the page
// (see `ASPECT_RATIOS`, the app's one list of shapes). They are the numerator
// and denominator rather than a ready-made `aspect-ratio` string because the
// same pair is needed twice — once as the ratio, once as the multiplier that
// turns a height budget into a width — and a single string could only serve
// the first.
//
// `--preset-max` is the box the card fits INSIDE, on both axes: 680px, the
// height the 380×680 poster this page opened on has always had. Capping the
// long side rather than the width is what keeps a banner from running off the
// screen and a poster from shrinking when it did not have to — at 9:16 the two
// come out at 382×680, which is the card this page has always drawn.
//
// The width term is `100%` — the CANVAS, not the viewport. The viewport is the
// wrong quantity twice over: the properties rail is `fixed` and the body's own
// inset is what makes room for it, and a phone on its side hands the canvas a
// margin of its own. Neither shows up in `dvw`, so a 16:9 card measured that
// way came out wider than the space it was in and was left to flex-shrink into
// it, arriving edge to edge with the page's 20px margins eaten. A percentage
// resolves against the box the card is actually centred in, which is the box
// the margins belong to. The margin itself is `--card-gutter` rather than a
// stated token, so the width and the height budget give up the same number —
// 20px on a desktop, 8px on a phone.
const shaderPresetStyle = css({
  position: "relative",
  isolation: "isolate",
  "--preset-max": "680px",
  aspectRatio: "var(--preset-w) / var(--preset-h)",
  width:
    "min(var(--preset-max), calc(var(--preset-max) * var(--preset-w) / var(--preset-h)), calc(token(spacing.full) - 2 * var(--card-gutter)), calc((100dvh - var(--card-space)) * var(--preset-w) / var(--preset-h)))",
  transition: "width 200ms ease-out",
  borderRadius: "xxl",
  overflow: "hidden",
  // NO ground of its own, deliberately. A preset's own background is a colour it
  // holds — `colorBack`, with its alpha — and taking that to zero has to mean
  // what it says: you are looking THROUGH the preset, at the page. A plate
  // underneath would make the transparency a lie, and a quiet one, since
  // `bg.surface` is close enough to the canvas behind it to read as "the
  // background did not change" rather than as "something else is showing".
  //
  // What is lost is the empty card's outline for the moment before the shader
  // mounts. That is the right thing to lose: the alternative is a control that
  // cannot reach zero.
});

// The gutter row's right-hand end: the theme toggle, answering the menu at the
// other. The panel's way back stood here for a while and has moved into the
// rail's own chrome — it acts on the panel, where these two act on the page,
// and a third control wedged in beside the toggle read as part of that pair.
// Pushed to its own column's far edge — a grid item fills its column by
// default, which would leave the toggle floating at the column's left rather
// than against the showcase's right edge where it belongs.
const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

// The hairline between the shapes and the panel's way back.
//
// The rail's own dividers are `OptionList.Divider`s, which need that list's
// context — and this one is deliberately OUTSIDE it: the shapes are a toolbar
// with a name of its own ("Preview aspect ratio"), and a button that opens the
// properties panel is not one of them. So the chrome box holds two things with
// a rule between, and the rule is drawn to the same recipe's measurements (1px
// of `border.divider`, stretched to the row) so the two read as one strip.
const toolbarSeparatorStyle = css({
  flexShrink: 0,
  width: "token(spacing.xxs)",
  // The BUTTONS' height, not the rail's. Stretched, it would run the full 40px
  // — the `md` toolbar states no block padding, its height alone — and stand 3
  // pixels taller than the divider the rail draws after its flip control, which
  // takes the 28px its own row is laid out on. Two rules in one strip disagreeing
  // by three pixels is the kind of thing you see without being able to say why.
  height: "token(sizes.toolbarButton)",
  backgroundColor: "border.divider",
});

// Which glyph the panel's toggle wears, by the edge it is docked to: a sheet
// rises from the bottom of a phone, a rail comes in from the side of a desktop,
// and a button that pointed at the wrong edge would be describing a panel the
// reader is not about to get. Worn by BOTH ends of the toggle — the control
// that puts the panel away, in its header, and the one that brings it back, on
// the band — because they are one control and the icon names the panel rather
// than the direction of travel. ONE button each way, so the label and the press
// are stated once; the media query only picks the picture.
const sheetOnlyIconStyle = css({
  display: "none",
  _bottomSheet: { display: "block" },
});
const railOnlyIconStyle = css({ _bottomSheet: { display: "none" } });

// The header IS the grip. `touch-action: none` is what makes a downward drag
// belong to the sheet instead of being read as a scroll of the panel under it
// — without it the browser claims the gesture before the first pointermove
// arrives. Scoped to the sheet, so the docked rail's header keeps every gesture
// it has today.
const sheetGripStyle = css({ _bottomSheet: { touchAction: "none" } });

// The header's trailing controls. Two on a phone, one on the rail — the close
// button is the sheet's alone — so they are grouped rather than left to the
// header's own `space-between`, which would push them to opposite ends.
const headerActionsStyle = css({ display: "flex", alignItems: "center", gap: "xs" });

/**
 * The docked panel, borrowed from the collection editor's media inspector —
 * the SAME `propertiesPanel` recipe, applied slot by slot instead of through
 * `<PropertiesPanel>`.
 *
 * The component is not usable here: it is a dismissible dialog (Escape, or a
 * press anywhere outside it) wrapping a `Popover`, and on a page whose entire
 * content is the thing you click, the first click on the preset would slide the
 * panel away with nothing left to bring it back. The recipe is the part worth
 * reusing — flush to the viewport's top, bottom and right edge, its own scroll
 * container, a sticky header over the sections — and taking it directly is what
 * keeps this page's rail from being a second, drifting copy of those values.
 *
 * `data-property-control` on a row is what the recipe's `controlPanel` slot
 * relays into its label ∣ control grid, which is also what makes a
 * SegmentedControl measurable inside a Field.
 */
const panel = propertiesPanel();

/**
 * One titled block of the rail — the recipe's section, its header strip and its
 * control panel. No add/remove button in the strip: every group here describes
 * properties the shader HAS, so there is nothing for adding one to mean (the
 * same call the media panel's always-on section makes, which is why that one
 * draws no header at all — these have headers because there are five of them
 * and they need telling apart).
 */
function Group({
  title,
  actions,
  children,
}: {
  title: string;
  /**
   * Controls that sit AGAINST the heading rather than in the panel below it —
   * the strip's own end, where the recipe already holds a slot open for a
   * section's add/remove button.
   *
   * For a control that acts on what the section NAMES rather than on a property
   * in it: "Preset actions" is a heading with two chips and nothing under it,
   * which is a section whose whole content is its strip.
   */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={panel.section}>
      <div className={panel.sectionHeader}>
        <div className={panel.sectionTitle}>
          <Typography tag="p" type="bodySmall">
            {title}
          </Typography>
        </div>
        {actions && <div className={headerActionsStyle}>{actions}</div>}
      </div>
      {/* Absent rather than empty for a section that is only a heading: the
        control panel carries its own 12px inset, so an empty one would leave a
        strip of nothing under the title and make the chips beside it look like
        a row that had lost its contents. */}
      {children && (
        <div className={panel.controlPanel} role="group" aria-label={title}>
          {children}
        </div>
      )}
    </section>
  );
}

/** A saved preset this page was opened on, if it was opened on one. */
export interface OpenedShaderPreset {
  id: string;
  title: string | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  /** When it went on show, and null while it is the author's alone. */
  publishedAt: Date | null;
}

export function ShaderPlayground({ preset }: { preset?: OpenedShaderPreset }) {
  // ⌘Z / ⌘⇧Z over the draft. Here rather than in the palette, which owns the
  // shortcuts that COMMIT a draft (⌘S) — undo never leaves the page and has no
  // meaning off it, so it belongs to the surface being edited, exactly as the
  // article editor's own history does.
  useDraftHistory();

  // The draft lives in a STORE rather than in this component, because the
  // commands that commit it — "Save changes and exit", ⌘S — are in the command
  // palette, which is mounted in the root layout and knows nothing about the
  // page under it. See `@/store/shader-preset-draft`.
  const shaderId = useShaderPresetDraftStore((draft) => draft.shaderId);
  const state = useShaderPresetDraftStore((draft) => draft.settings);
  const selectShaderInStore = useShaderPresetDraftStore((draft) => draft.selectShader);
  const setParamInStore = useShaderPresetDraftStore((draft) => draft.setParam);
  const setColorsInStore = useShaderPresetDraftStore((draft) => draft.setColors);
  const setColorBackInStore = useShaderPresetDraftStore((draft) => draft.setColorBack);
  const setExtraColorInStore = useShaderPresetDraftStore(
    (draft) => draft.setExtraColor,
  );
  const setFramingInStore = useShaderPresetDraftStore((draft) => draft.setFraming);
  const setAspectInStore = useShaderPresetDraftStore((draft) => draft.setAspect);
  const resetParamsInStore = useShaderPresetDraftStore((draft) => draft.resetParams);
  const setPublishedAtInStore = useShaderPresetDraftStore(
    (draft) => draft.setPublishedAt,
  );
  // Which of the two things the header's publish button is, and whether it has
  // a saved row to act on at all.
  const savedShaderPresetId = useShaderPresetDraftStore((draft) => draft.shaderPresetId);
  const publishedAt = useShaderPresetDraftStore((draft) => draft.publishedAt);
  const isDirty = useShaderPresetDraftStore((draft) => draft.isDirty);
  // Which shapes have been reframed since the preset was opened — the rail marks
  // them for the AUTHOR, so unsaved work in a frame that is not on screen is
  // not invisible. See where it is handed to the rail.
  const editedAspects = useShaderPresetDraftStore((draft) => draft.editedAspects);

  // ---------------------------------------------------------------------
  // Which GROUND the preset is being judged on.
  //
  // A preset holds a colour per theme, so "what does this look like" has two
  // answers and the page has to be standing on one of them. It stands on the
  // site's by default and can be sent to the other without taking the site
  // with it: the rail, the strip and the chrome stay where the visitor put
  // them, and only the picture in the middle changes ground.
  //
  // `null` means FOLLOW THE SITE rather than "light". That is what makes the
  // first paint correct without a second answer to reconcile: `useThemeToggle`
  // reports light for one commit after hydration (it cannot ask `matchMedia`
  // on the server), and a state seeded from it would latch that guess forever.
  //
  // The override is a PEEK at the other ground, and it lasts until the site's
  // theme next moves — at which point the card is re-aimed and `null` is the
  // answer again. It was kept until the author said otherwise, which sounds
  // like the same rule and is not: the site's own toggle IS the author saying
  // otherwise, and it was the one voice being ignored. Latched, it outlived the
  // toggle that should have overruled it — and because the override is set to
  // the ground you are NOT on, the first flip of the site agreed with it by
  // luck and only the flip back showed the fault: a card painted for the theme
  // the page had just left.
  // ---------------------------------------------------------------------
  const { isDark } = useThemeToggle();
  const pageTheme: ShaderPresetTheme = isDark ? "dark" : "light";
  const [groundOverride, setGroundOverride] = useState<ShaderPresetTheme | null>(null);

  // The override is released whenever the SITE's theme moves, which is what
  // makes "follow the site" the standing answer rather than the opening one.
  //
  // Adjusted DURING render, on the pattern `drawn` below uses: the alternative
  // is an effect, which paints the stale ground for a frame before correcting
  // it — a visible flash of the wrong colours on every toggle. Compared against
  // a remembered value rather than watched for as an event, because there is no
  // event to watch: `useThemeToggle` reads a store this page does not own, and
  // the theme can move from the command palette or the OS as easily as from the
  // button in the corner.
  const [lastPageTheme, setLastPageTheme] = useState(pageTheme);
  if (lastPageTheme !== pageTheme) {
    setLastPageTheme(pageTheme);
    setGroundOverride(null);
  }

  const ground = groundOverride ?? pageTheme;

  /**
   * Whether the preset on screen is the one that is going to stay there.
   *
   * A preset opened by ROUTE is settled before this component renders — the
   * server fetched it. The bare route is the one that waits: a visitor arriving
   * there is taken to the newest published preset once the strip has read the
   * library (see `presets-pane`), and until that read lands the draft is
   * holding the control table's first shader — a preset nobody published, shown
   * for as long as a round trip takes and then swapped out underneath them.
   *
   * So the card does not render at all until the answer is in. The preloader
   * stands in, which is the same thing an article's component demos do while
   * their module loads — one way of waiting, across the site.
   *
   * The question is asked of the DRAFT, never of the route, and that is the
   * whole of it: "a preset was handed down" and "the draft is holding it" are
   * different claims, and everything on this page reads the draft.
   *
   * On the bare route the strip answers, once it has adopted (see the pane's
   * `onSettled`, arranged so it cannot fire early). On a routed one the draft
   * answers for itself — it is holding that id, or it is not yet.
   *
   * Asking the route instead is what put another preset's numbers on screen for
   * the length of a hard load: `preset !== undefined` is true during the SERVER
   * render, where the draft has been seeded by nothing at all and is still five
   * colours deep in the control table's first shader. That markup paints before
   * a line of JavaScript runs, so no effect — layout or otherwise — can pull it
   * back. Asked of the draft, the server draws the preloader instead, and the
   * rail arrives once hydration has seeded it.
   *
   * It does not wait for the shader's first frame: the shader library reports
   * nothing when it paints, so anything past this point would be a guess
   * dressed up as an event.
   */
  const [settled, setSettled] = useState(false);
  const [drawn, setDrawn] = useState(false);
  // Latched once true. The author pressing "New preset" on this route empties
  // the draft's id while the route's own `preset` stays what it was — the URL is
  // corrected with `replaceState`, which re-renders no server component — so a
  // live comparison would take the rail away again mid-session.
  if (!drawn && (preset ? savedShaderPresetId === preset.id : settled)) setDrawn(true);
  const ready = drawn;
  const trickle = useTrickleProgress(!ready);

  const spec = SHADER_SPECS[shaderId];

  // What the AUTHOR is shown on top of the playground everybody gets: the
  // shader picker, and the button that puts a preset on show. Both are about
  // authoring a preset rather than looking at one — a visitor takes up a
  // published preset and pushes it around, which needs neither.
  //
  // What to draw, never what may be done: `publishShaderPreset` checks the session
  // again on the server, and this answers false for one render after hydration
  // by design — see `useIsAdmin`.
  const isAdmin = useIsAdmin();

  /**
   * Whether the header's shared slot is offering to DELETE rather than to
   * reset — which it does exactly when there is nothing left to reset.
   *
   * `!isDirty` is that condition: the draft goes clean only on a load or a
   * save, so a clean draft IS the saved preset and Reset would put back what
   * is already there. Reading the store's own flag rather than comparing the
   * two states keeps one answer to "has this been touched" — the same one the
   * palette asks before offering to discard work.
   *
   * A never-saved draft keeps Reset: there is no row for a Delete to name.
   * And the swap is only safe because of the direction it runs in — in every
   * state where Reset would do something, Reset is what is in the slot, so a
   * press aimed at Reset can never land on Delete.
   */
  const canDelete = isAdmin && savedShaderPresetId !== null && !isDirty;
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** Remove the saved preset, and go back to a blank draft. */
  async function deletePreset() {
    if (!savedShaderPresetId || deleting) return;
    setDeleting(true);
    try {
      await deleteShaderPreset(savedShaderPresetId);
      // The preset does NOT stay on screen: deleting is a deliberate "I do not
      // want this", and leaving it in the panel would invite re-saving the
      // thing just thrown away. The URL stops naming a row that no longer
      // exists — replaced rather than pushed, since the deleted preset is not
      // somewhere to go back to.
      useShaderPresetDraftStore.getState().reset();
      window.history.replaceState(null, "", "/playground/shader");
    } catch (err) {
      // A failed delete must not look like a successful one: the row is still
      // there, so the playground must still be holding it.
      console.error("Failed to delete the preset:", err);
    } finally {
      setDeleting(false);
    }
  }

  /** Put the saved preset on show, or take it back off. */
  const [publishing, setPublishing] = useState(false);
  async function togglePublished() {
    if (!savedShaderPresetId || publishing) return;
    setPublishing(true);
    try {
      // The row is the authority on its own state: what comes back is what is
      // recorded, rather than a date this button made up and hoped matched.
      const saved = publishedAt
        ? await unpublishShaderPreset(savedShaderPresetId)
        : await publishShaderPreset(savedShaderPresetId);
      setPublishedAtInStore(saved.publishedAt);
    } catch (err) {
      // Leaves the button saying what is still true. A failed publish that
      // flipped the icon anyway would be the worse outcome by far: the strip
      // would go on showing the preset to nobody while the panel claimed it was
      // out.
      console.error("Failed to change the preset's publication:", err);
    } finally {
      setPublishing(false);
    }
  }

  // The frame, and the two numbers the card is drawn from. Looked up in the
  // app's one table of shapes rather than split off the key, so a ratio that is
  // not in it cannot reach the CSS.
  const aspect = useShaderPresetDraftStore((draft) => draft.aspect);
  const [ratioWidth, ratioHeight] = ASPECT_RATIOS[aspect];

  // Whether the panel has been sent away — the sheet on a phone, the docked
  // rail on a desktop, one state for both. It was the sheet's alone, read only
  // inside that media query so that turning the phone brought the rail back;
  // the rail collapses now, and the way back is on the band in either layout,
  // so the state can outlive the turn and mean what it says.
  const [dismissed, setDismissed] = useState(false);

  // Down to start with on a phone held upright, and up everywhere else. The
  // sheet takes half the viewport — that is the point of it, the other half is
  // where the picture stays visible — and half a phone is not enough to judge
  // one in, so on that layout the panel is something you reach for rather than
  // something you dismiss. The way back is on the band from the first paint.
  //
  // In an EFFECT rather than in the initial state, and that is the whole of it:
  // the answer comes from `matchMedia`, which the server cannot ask, so a state
  // seeded from it would render `data-sheet-dismissed` on a `main` the server
  // sent without it — a hydration mismatch. The panel is behind this page's
  // `ready` gate and does not exist yet when this runs, so nothing is ever seen
  // sliding away.
  //
  // Once only. Turning the phone does not re-seed it: the state outlives the
  // turn by design (see above), and re-asking on every rotation would take a
  // panel away from somebody who had just opened it.
  useEffect(() => {
    // Syncing to the DEVICE, which is not a render-derived value — the same
    // one-commit-later correction `useHasCursor` makes, and for the same
    // reason: the server has no viewport to ask.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isBottomSheetLayout()) setDismissed(true);
  }, []);

  // This page's rail is the propertiesPanel RECIPE rather than the component —
  // the component is a dismissible dialog, and a playground whose whole content
  // is the thing you click would close it on the first press. So the inset the
  // component arranges for itself is asked for here directly.
  //
  // Given up while the panel is away, which is the point of collapsing it: the
  // rail is `position: fixed` and takes no width of its own, so the 360px it
  // stands in is the page's to reserve — and a collapsed rail that kept it
  // would leave a column of nothing beside a picture that could have grown into
  // it. The body's own 200ms matches the panel's slide (see globals.css), so
  // the picture and the rail move as one thing. Below `md` the inset rule does
  // not apply at all, so on a phone this is the mark being kept tidy and
  // nothing more.
  usePropertiesPanelInset(!dismissed);
  const panelRef = useRef<HTMLElement>(null);
  const { offset, dragHandlers } = useSheetDrag({
    sheetRef: panelRef,
    onDismiss: () => setDismissed(true),
    // Asked at press time rather than watched: a docked rail's header is
    // dragged by nobody, and the answer cannot change mid-gesture.
    enabled: isBottomSheetLayout,
  });

  // Adopt the preset this route was opened on — and RESET when there is none, so
  // arriving at the bare route after editing a saved one starts blank rather
  // than silently continuing to edit the last preset under a URL that claims to
  // be a new one. Keyed on the id, so re-renders do not re-seed over live edits.
  const shaderPresetId = preset?.id;
  useEffect(() => {
    const store = useShaderPresetDraftStore.getState();
    if (preset) {
      // Already holding this one — do NOT re-seed. ⌘S on a never-saved preset
      // creates the row and then replaces the URL with its id, so this route
      // mounts a moment later carrying a preset the draft is already editing.
      // Loading it again would throw away anything tuned during that gap, which
      // is exactly the window the author is most likely to still be working in.
      if (store.shaderPresetId === preset.id) return;
      store.load(preset);
    } else {
      // The never-saved draft, taken up rather than blanked: arriving at the
      // bare route must not throw away work tuned before the first save. If
      // nothing is held it opens blank, exactly as `reset` used to leave it —
      // and `reset` is now the discard alone.
      store.openNewDraft();
    }
    // Keyed on the ID, not the object: a server component hands down a fresh
    // prop object on every render, and depending on that identity would re-seed
    // the draft over whatever was being edited each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderPresetId]);

  /** Switching shader re-seeds from that shader's defaults — its control table is a different shape. */
  function selectShader(next: ShaderId) {
    selectShaderInStore(next);
  }

  /** The shared blocks, in the order they are grouped — and what is left is the shader's own. */
  const byKey = (keys: string[]) =>
    keys
      .map((key) => spec.controls.find((control) => control.key === key))
      .filter((control) => control !== undefined);
  const shared = new Set([...FRAMING_CONTROL_KEYS, ...MOTION_CONTROL_KEYS]);
  // A control can name a group of its own, and one that does is drawn there
  // instead — see `ControlGroup`. Filtered out here rather than merely repeated
  // below, or it would render twice.
  const ditherControls = spec.controls.filter(
    (control) => control.group === "dither",
  );
  const edgeControls = spec.controls.filter(
    (control) => control.group === "edge",
  );
  const rampControls = spec.controls.filter(
    (control) => control.group === "ramp",
  );
  const gridControls = spec.controls.filter(
    (control) => control.group === "grid",
  );
  const glowControls = spec.controls.filter(
    (control) => control.group === "glow",
  );
  const ownControls = spec.controls.filter(
    (control) => !shared.has(control.key) && control.group === undefined,
  );
  const framingControls = byKey(FRAMING_CONTROL_KEYS);
  // The shared Speed first, then whatever timing the shader owns itself. Speed
  // leads because it is the gate: at 0 the mount cancels the frame loop and
  // nothing below it can be seen doing anything.
  const motionControls = [
    ...byKey(MOTION_CONTROL_KEYS),
    ...spec.controls.filter((control) => control.group === "motion"),
  ];

  // The placement controls are stored per SHAPE and the rest per preset, so the
  // panel has to know which of the two a row is writing to. Read and write are
  // one pair rather than a second copy of `renderControl` — the switch over
  // control kinds is the thing that must not be duplicated (see there), and
  // where a value lives is orthogonal to what kind of control shows it.
  const isFramingControl = (key: string) => FRAMING_CONTROL_KEYS.includes(key);
  const framing = framingFor(state, aspect);
  const valueOf = (key: string) =>
    isFramingControl(key) ? framing[key] : state.params[key];

  function setParam(key: string, value: ParamValue) {
    if (isFramingControl(key)) {
      // Every framing control is a slider, so this cast down to a number is
      // safe by construction — see `FRAMING_CONTROLS`.
      setFramingInStore(key, Number(value));
      return;
    }
    setParamInStore(key, value);
  }

  // -------------------------------------------------------------------------
  // The colours. Every one of them is a PAIR, and the swatches show one half —
  // whichever ground the preview is standing on. An edit therefore writes that
  // half and leaves the other exactly as it was: switching ground, tuning, and
  // switching back must not have quietly retuned the theme you were not
  // looking at.
  // -------------------------------------------------------------------------
  const onGround = (color: ThemedColor, value: string): ThemedColor => ({
    ...color,
    [ground]: value,
  });

  const setRampColor = (index: number, value: string) =>
    setColorsInStore(
      state.colors.map((color, i) =>
        i === index ? onGround(color, value) : color,
      ),
    );

  /**
   * A new stop copies the LAST one — BOTH halves of it.
   *
   * A colour the same as its neighbour is invisible until you edit it, where a
   * black one drops a hole into the gradient you were tuning. Copying the pair
   * rather than the half on screen is the same rule one level up: the ground
   * you are not looking at gets a stop that matches its own neighbour, not one
   * borrowed from the other theme.
   */
  const addRampColor = () =>
    setColorsInStore([
      ...state.colors,
      state.colors[state.colors.length - 1] ?? {
        light: "#FFFFFFFF",
        dark: "#FFFFFFFF",
      },
    ]);

  const removeRampColor = (index: number) =>
    setColorsInStore(state.colors.filter((_, i) => i !== index));

  /** What the card is painted with: every pair resolved onto `ground`. */
  const palette = paletteFor(state, ground);

  /**
   * One control, whatever kind it is. Lifted out of the JSX because the sidebar
   * renders the list TWICE — a shader's own parameters and the shared framing —
   * and a second copy of this switch is a second place for a control kind to go
   * missing.
   */
  function renderControl(control: ControlSpec) {
    if (control.kind === "toggle") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Switch
            checked={Boolean(valueOf(control.key))}
            onCheckedChange={(checked) => setParam(control.key, checked)}
          />
          <Field.Label>{control.label}</Field.Label>
        </Field>
      );
    }

    if (control.kind === "toggles") {
      const chosen = valueOf(control.key);
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Field.Label>{control.label}</Field.Label>
          {/* The same rail the segmented control draws in, because it is the
            same kind of row — a short list with every choice on show. What
            differs is that these are INDEPENDENT, so the bar reports the whole
            set rather than one value. Its last toggle does not release: none of
            them is the control switched off, not a setting. */}
          <ToggleBar
            ariaLabel={control.label}
            options={control.options}
            value={Array.isArray(chosen) ? chosen : control.value}
            onValueChange={(value) => setParam(control.key, value)}
          />
        </Field>
      );
    }

    if (control.kind === "select") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Field.Label>{control.label}</Field.Label>
          <SegmentedControl
            options={control.options}
            value={String(valueOf(control.key))}
            onValueChange={(value) => setParam(control.key, value)}
          />
        </Field>
      );
    }

    return (
      <Field size="sm" key={control.key} data-property-control>
        <Field.Label>{control.label}</Field.Label>
        <Slider
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(valueOf(control.key))}
          onValueChange={(value) => setParam(control.key, value)}
        />
      </Field>
    );
  }

  return (
    <main className={pageStyle} data-sheet-dismissed={dismissed || undefined}>
      <div className={canvasStyle}>
        {ready ? (
          <div
            className={shaderPresetStyle}
            data-preset-stage
            style={
              {
                "--preset-w": ratioWidth,
                "--preset-h": ratioHeight,
              } as CSSProperties
            }
          >
            <ShaderStage
              spec={spec}
              // Both halves, put back together — the shader's own uniforms with
              // the current shape's placement over them. See `shaderParamsFor`.
              params={shaderParamsFor(state, aspect)}
              // Resolved onto the ground the CARD is standing on, which is the
              // site's until the author sends it to the other one. Only this
              // picture moves: the rail beside it and the strip below stay in
              // the theme the visitor chose. See `ground`.
              colors={palette.colors}
              colorBack={palette.colorBack}
              extraColors={palette.extraColors}
            />
          </div>
        ) : (
          // Capped at 99, as the demos' own is: the last percent belongs to the
          // thing actually appearing, not to the wait for it.
          <DemoPreloader value={Math.min(99, trickle * 100)} />
        )}

        {/* The site's own two gutter controls, exactly as an article carries
            them — same button, same chip, same store. The playground has no
            intro row to hang them off, so the band is measured from the canvas
            instead. */}
        <div className={canvasChromeStyle}>
          <MenuButton />

          <div className={chromeEndStyle}>
            <ThemeToggleButton />
          </div>
        </div>

        {/* The frame the preset is being designed against.

            It shapes the PREVIEW and nothing else: a preset is shapeless, and
            every surface that embeds one gives it that surface's own shape.
            What it is for is judging — the same fan of light reads as a
            poster and as a banner differently, and this is how you look at
            both — and the shape is kept on the draft so that reopening the
            preset reopens the frame it was judged in. See `@/domain/shader-preset`.

            A child of the CANVAS rather than of the gutter row, which is
            where it used to live. It has two seats now and only one of them is
            in that row — see `aspectRailStyle`. Out here it can take either:
            absolute into the band on a desktop, and in the canvas's own column
            under the card on a phone, where a rail wedged between the menu and
            the theme toggle ran the row out of width.

            After the gutter row and before the strip, which is the order a
            keyboard walks it in: the page's two controls, then the thing's,
            then the library. On a phone that is also the order they are read
            in down the screen. */}
        <div className={cx(toolbar({ size: "md" }), aspectRailStyle)}>
          <AspectRail
            ariaLabel="Preview aspect ratio"
            aspect={aspect}
            onPick={setAspectInStore}
            // The author's alone. A visitor moves these controls too — the
            // preset is theirs to play with — so their draft goes dirty just
            // the same, but the mark means "work you have not written" and
            // there is nothing here for them to write it to. Unmarked rather
            // than marked-and-inert, because a dot that appears and never
            // resolves is a dot pointing at a save they cannot reach.
            markedAspects={isAdmin ? editedAspects : undefined}
          />

          {/* The panel's way back, in the rail's chrome behind a rule.
            
            Here rather than beside the theme toggle, where it used to stand:
            this band carries the page's two controls at its ends and the
            controls for the THING at its middle, and the panel is part of
            the thing. Behind a separator because it is not one of the shapes
            — the rule is what says the toolbar is two groups rather than
            seven buttons, and it is why this sits outside the rail's own
            named toolbar rather than being appended to it.

            Mounted only while the panel is away. A button that offered to
            open what is already open would be inert half the time, and the
            rail would hold a permanent gap for it. */}
          {dismissed && (
            <>
              <span aria-hidden className={toolbarSeparatorStyle} />
              <Button
                variant="icon"
                aria-label="Preset properties"
                onClick={() => setDismissed(false)}
              >
                <RightSidebarIcon className={railOnlyIconStyle} />
                <BottomSheetIcon className={sheetOnlyIconStyle} />
                <Button.Tooltip>
                  <Tooltip.Text>Preset properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </>
          )}
        </div>

        {/* The saved presets, along the foot of the canvas. Inside it rather
            than fixed to the viewport, so the strip gives the properties rail
            the same room the rest of this page does — see `presets-pane`.

            Mounted for everybody: the pane decides what is in it and whether
            there is anything to draw at all, and the page reserves its band off
            whether it drew one. */}
        <PresetsPane onSettled={() => setSettled(true)} />
      </div>

      {/* The rail, and the same panel along the bottom edge on a phone held
          upright — one element either way, because it is one panel: the shape
          is the recipe's media query, and the only thing this page adds is
          whether the sheet has been sent away.

          On the SAME answer the preset waits for, and it has to be: every
          control here reads the draft, and until the library lands the draft is
          holding the control table's first shader. A rail drawn before then is
          a column of numbers describing a preset nobody published, swapped out
          underneath the reader a round trip later — and a reader who started
          pushing those sliders would lose the edit. Mounting it late is also
          what plays its slide-in (`propertiesPanelIn`, on the recipe's root),
          so it arrives WITH the preset it describes rather than sitting there
          through the wait. The page keeps the rail's width reserved throughout
          (see `usePropertiesPanelInset`), so nothing under it moves when it
          lands — the preloader stands exactly where the preset will.

          `translate` inline for the length of a drag and nothing after it: the
          finger places the sheet while it is on it, and lets CSS have it back
          at the end so the dismissed state (or the slide home) is not outranked
          by a stale transform. */}
      {ready && (
        <aside
          ref={panelRef}
          className={panel.root}
          // The landmark's name is the heading it carries: a rail announced as
          // one thing and titled as another is two names for one panel.
          aria-label="Preset properties"
          data-dismissed={dismissed || undefined}
          data-dragging={offset !== null || undefined}
          style={offset !== null ? { translate: `0 ${offset}px` } : undefined}
        >
          <div className={cx(panel.header, sheetGripStyle)} {...dragHandlers}>
            <Typography tag="p" type="bodyLarge" className={panel.title}>
              Preset properties
            </Typography>
            <div className={headerActionsStyle}>
              {/* The panel's own control, and the only one left in its header:
                everything else here acts on the PRESET and has moved to the
                section that names it. Closes the panel in both layouts — the
                sheet on a phone, the docked rail on a desktop. It was
                sheet-only while the sheet was the only thing you could send
                away; the rail is collapsible too, and one control that closes
                whatever shape the panel is in beats two that each know about
                one.

                The SAME glyph the way back wears, for the same reason it wears
                it: this is one toggle with an end in each place, and what the
                icon names is the panel — the rail from the side, the sheet from
                the bottom. A cross stood here first and named the gesture
                instead, which read as "get rid of this" rather than "put the
                rail away", and left the two halves of one control looking like
                two unrelated buttons. */}
              <Button
                variant="icon"
                aria-label="Close properties"
                onClick={() => setDismissed(true)}
              >
                <RightSidebarIcon className={railOnlyIconStyle} />
                <BottomSheetIcon className={sheetOnlyIconStyle} />
                <Button.Tooltip>
                  <Tooltip.Text>Close properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </div>
          </div>

          {/* The two controls that act on the PRESET — the saved row behind the
            panel and the draft in front of it — against a heading that says so.
            First, because they are what you do TO the thing the rest of the
            panel describes.

            A heading with chips rather than a row of buttons under one: they
            are the section, not properties of it, and a control panel beneath
            would put them on a line of their own with an empty strip above.

            They stood in the panel's header until now, which is the wrong strip
            for them: that one names the panel and carries the control that
            sends it away. */}
          <Group
            title="Preset actions"
            actions={
              <>
                {/* "Reset", flat. WHERE it resets to (the preset you opened, or
                  the shader's defaults where there is no preset) is the store's
                  to decide; spelling that out would make the shortest control
                  here the wordiest thing in it.

                  Its slot turns into Delete once there is a saved preset and
                  nothing left to reset — see `canDelete`. */}
                {canDelete ? (
                  <Button
                    variant="icon"
                    aria-label="Delete preset"
                    disabled={deleting}
                    onClick={() => setPendingDelete(true)}
                  >
                    <TrashIcon />
                    <Button.Tooltip>
                      <Tooltip.Text>Delete preset</Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                ) : (
                  <Button
                    variant="icon"
                    aria-label="Reset"
                    onClick={resetParamsInStore}
                  >
                    <ResetIcon />
                    <Button.Tooltip>
                      <Tooltip.Text>Reset</Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                )}

                {/* Whether this preset is on show — one button, because it is
                  one fact with two settings, and a pair sitting side by side
                  would always have one of them inert.

                  Here rather than in the command palette, which is where an
                  article's Publish lives. The difference is what the control
                  acts on: a post's publish acts on the page you are looking at,
                  where this acts on the SAVED ROW — the same thing Reset
                  restores from — which is exactly what this section names.

                  It publishes what was last SAVED, not what is in the panel: ⌘S
                  is the one press that decides between creating a row and
                  updating one, and a second control making that decision would
                  be two doors to one room. Which is also why it is disabled
                  until there is a row — there is nothing yet for "publish this"
                  to name.

                  The author's alone, and nothing here is what enforces that:
                  `publishShaderPreset` asks the server. */}
                {isAdmin && (
                  <Button
                    variant="icon"
                    aria-label={publishedAt ? "Unpublish" : "Publish"}
                    disabled={!savedShaderPresetId || publishing}
                    onClick={() => void togglePublished()}
                  >
                    {publishedAt ? <UnpublishIcon /> : <PublishIcon />}
                    <Button.Tooltip>
                      <Tooltip.Text>
                        {publishedAt ? "Unpublish" : "Publish"}
                      </Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                )}
              </>
            }
          />

          {/* The shader itself is the AUTHOR's choice, so a visitor is not shown
            this group. What they came for is the preset in front of them — the
            preset they opened, with its own controls under it — and a picker
            that swapped it for a bare, untuned shader would throw that preset
            away with nothing to get it back. The panel below still gives them
            every control the mounted shader has. */}
          {isAdmin && (
            <Group title="Shader">
              {/* A list rather than a row of chips: names read as a set to pick ONE
              of, and the selected row says which is mounted without the reader
              having to compare button emphases. `sm` because the panel's own
              rows are 24px — a 32px-pitch list inside it would be the loudest
              thing in the rail.

              It stood at one entry for a year and was still a list, which is
              why Pixel Comets arriving cost it nothing: what it draws comes from the
              table, so the row saying which shader you are on is the same
              control that offers the other one. */}
              <OptionList
                size="sm"
                // The recipe's own width is the 208px popover pitch it shares
                // with the calendar. In here the panel is the frame, so the
                // list takes the column it was given — and stops where every
                // other row does, leaving the reserved action column open (see
                // `controlPanel`'s `data-property-block`).
                data-property-block
                value={shaderId}
                onValueChange={(value) => selectShader(value as ShaderId)}
              >
                <Field.Search placeholder="Search…" />
                <OptionList.Listbox aria-label="Shader">
                  {SHADER_IDS.map((id) => (
                    <OptionList.Option key={id} value={id}>
                      {SHADER_SPECS[id].label}
                    </OptionList.Option>
                  ))}
                </OptionList.Listbox>
              </OptionList>
            </Group>
          )}

          {/* The shader's own colours, then its extras, then the background —
            front to back. The first row is what the picture IS, whatever is
            drawn on it comes next, and the ground is what shows through where
            neither reaches. The count slider that used to open this group is
            gone: the grid says how many colours there are by showing them, and
            how much room is left by not. */}
          <Group title="Colours">
            {/* Two rows of swatches, so the label and the toggle sit on the
              FIRST of them rather than floating between the two. See the
              `controlPanel` slot. */}
            <Field size="sm" data-property-control data-control-align="start">
              {/* The shader's word for them, not the panel's — see
                `colorsLabel`. It read "Ramp" for both while the table held one
                shader that had one, and named a gradient the other never
                draws. */}
              <Field.Label>{spec.colorsLabel}</Field.Label>
              <ColorSwatchGrid
                ariaLabel={`${spec.colorsLabel} colours`}
                capacity={spec.maxColors}
                values={palette.colors}
                onValueChange={setRampColor}
                onAdd={addRampColor}
                onRemove={removeRampColor}
              />
              {/* The row's ACTION cell — the column every control row keeps
                open. It carries the glyph of the ground you are NOT on, which
                is where pressing it goes, and it moves the card alone. */}
              <Button
                variant="icon"
                aria-label={
                  ground === "dark"
                    ? "Show the light colours"
                    : "Show the dark colours"
                }
                onClick={() =>
                  setGroundOverride(ground === "dark" ? "light" : "dark")
                }
              >
                {ground === "dark" ? <LightIcon /> : <DarkIcon />}
                <Button.Tooltip>
                  <Tooltip.Text>
                    {ground === "dark" ? "Light colours" : "Dark colours"}
                  </Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </Field>

            {/* One row per GROUP of extra colours rather than one per colour —
              see `extraColorRows`. Colours that are one decision in two parts
              (the lattice's minor and major ink) sit side by side under a
              single label, where a row each would have said they were
              unrelated and spent a line of the panel saying it. */}
            {extraColorRows(spec).map((row) => (
              <Field size="sm" key={row.label} data-property-control>
                <Field.Label>{row.label}</Field.Label>
                {/* Fixed cells. An extra colour is a PROPERTY of the shader,
                  not a stop that can be added or dropped — so the grid is
                  handed neither `onAdd` nor `onRemove` and draws no affordance
                  for either, and its capacity is exactly what the table names.
                  `labels` because these cells differ by role, not position. */}
                <ColorSwatchGrid
                  ariaLabel={`${row.label} colours`}
                  capacity={row.colors.length}
                  labels={row.colors.map((extra) => `${extra.label} colour`)}
                  values={row.colors.map(
                    (extra) => palette.extraColors[extra.key],
                  )}
                  onValueChange={(index, value) => {
                    const { key } = row.colors[index];
                    setExtraColorInStore(
                      key,
                      onGround(state.extraColors[key], value),
                    );
                  }}
                />
              </Field>
            ))}

            {spec.hasColorBack && state.colorBack && (
              <Field size="sm" data-property-control>
                <Field.Label>Background</Field.Label>
                <ColorSwatchGrid
                  ariaLabel="Background colour"
                  capacity={1}
                  values={[palette.colorBack ?? "#000000FF"]}
                  onValueChange={(_, value) =>
                    setColorBackInStore(
                      onGround(state.colorBack ?? { light: value, dark: value }, value),
                    )
                  }
                />
              </Field>
            )}
          </Group>

          {/* The shader itself, then what is drawn ON it: Cosmic Track's ramp is
            laid along its track and its rails trace the bands the ramp fills;
            Pixel Comets run the lanes of a lattice. Reading order follows
            that dependency rather than the control table's own — and the
            heading is the shader's, since the group has no name that fits
            both. See `ownLabel`. */}
          <Group title={spec.ownLabel}>{ownControls.map(renderControl)}</Group>

          {/* Each absent entirely for a shader with none, rather than an empty
            strip — the same rule Motion follows below. */}
          {gridControls.length > 0 && (
            <Group title="Grid">{gridControls.map(renderControl)}</Group>
          )}

          {glowControls.length > 0 && (
            <Group title="Glow">{glowControls.map(renderControl)}</Group>
          )}

          {rampControls.length > 0 && (
            <Group title="Ramp">{rampControls.map(renderControl)}</Group>
          )}

          {edgeControls.length > 0 && (
            <Group title="Edge">{edgeControls.map(renderControl)}</Group>
          )}

          {ditherControls.length > 0 && (
            <Group title="Dither">{ditherControls.map(renderControl)}</Group>
          )}

          {/* Named for the SHAPE it applies to, because it applies to one: these
            four are kept per aspect ratio, and a heading reading plain
            "Framing" beside ten other framings you cannot see would be the
            panel's only lie. The rest of the panel has no such suffix because
            the rest of it is the preset's, whatever shape you are in. */}
          <Group title={`Framing ${aspect.replace("/", ":")}`}>
            {framingControls.map(renderControl)}
          </Group>

          {/* Absent entirely for a shader that never samples time, rather than
            present and inert — see `MOTION_CONTROLS`. */}
          {motionControls.length > 0 && (
            <Group title="Motion">{motionControls.map(renderControl)}</Group>
          )}
        </aside>
      )}

      {/* Deleting a preset is the one act here that cannot be undone with a
          second press — unlike unpublishing, which puts it straight back — so
          it is the one that asks. */}
      <ConfirmDialog
        open={pendingDelete}
        title="Delete Preset"
        message="You are about to delete this preset. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void deletePreset()}
        onClose={() => setPendingDelete(false)}
      />
    </main>
  );
}
