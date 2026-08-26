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
import { useCoverDraftStore } from "@/store/cover-draft";
import { AspectRail } from "@/components/aspect-rail";
import { deleteCover, publishCover, unpublishCover } from "@/app/actions/cover";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PresetsPane } from "./presets-pane";
import { ShaderStage } from "./shader-stage";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { ColorInput } from "@/components/ui/input/color-input";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { OptionList } from "@/components/ui/input/option-list";
import { Typography } from "@/components/ui/typography";
import { Tooltip } from "@/components/ui/tooltip";
import BottomSheetIcon from "@/assets/icons/bottom-sheet.svg";
import CrossIcon from "@/assets/icons/cross.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import {
  SHADER_IDS,
  SHADER_SPECS,
  FRAMING_CONTROL_KEYS,
  MOTION_CONTROL_KEYS,
  type ControlSpec,
  type ShaderId,
} from "@/data/shader-specs";
import { framingFor, shaderParamsFor, type CoverSettings } from "@/domain/cover";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// Cover Playground — where a cover's background is tuned, on its way to being
// published as a component. The art it is aimed at is the fanned light blades
// and soft colour washes of the reference covers.
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
//   --presets-space what the saved-covers strip is holding at the foot of the
//                  canvas: nothing at all when there is no strip. Its own tiles
//                  and padding (80 + 2×12) plus the four pixels it stands off
//                  the bottom edge — the same tokens the pane itself is built
//                  from, so the two cannot drift.
//   --card-space   everything the cover may NOT have: the sheet, the gutter
//                  controls' band, the presets strip, and the page's own
//                  margins.
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
  "--card-space":
    "calc(var(--sheet-space) + var(--presets-space) + token(spacing.5xl) + 2 * token(spacing.xxl))",
  _bottomSheet: {
    "--sheet-space": "50dvh",
  },
  // A strip is on screen, so the picture gives up its band. Asked of the PANE
  // rather than of the session, because "is there a strip" is no longer the
  // same question as "is the author signed in": a visitor is shown the
  // published covers, and gets no strip only when there are none. The pane is
  // the one thing that knows, and `:has()` is what lets it say so without the
  // page holding a second copy of the list to count.
  //
  // The arithmetic stays here, which is the half that was always right: the
  // page owns the division of the viewport and every part reads it off one
  // variable — the same call the dismissed sheet's attribute makes below.
  "&:has([data-presets])": {
    "--presets-space":
      "calc(token(spacing.5xl) + 2 * token(spacing.lg) + token(spacing.sm))",
  },
  // The sheet is gone, so the canvas has the whole screen back. An attribute
  // rather than a second media query: it outranks the one above wherever it is
  // set, and means nothing at all in the orientations that have no sheet.
  "&[data-sheet-dismissed]": { "--sheet-space": "0px" },
});

// The canvas: everything the panel leaves, with the cover in the middle of
// THAT rather than of the viewport, so the panel never covers the thing being
// judged. Positioned because the theme control sits in its corner. It takes no
// ground of its own — the page's `bg.canvas` is already the right one, in
// whichever theme is in force.
const canvasStyle = css({
  position: "relative",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // The gutter band is RESERVED — the cover centres in what is left under it,
  // not in the whole canvas. It used to be reserved only under a sheet, where
  // the menu and the theme toggle would otherwise sit on the picture; the
  // aspect rail is what makes it a rule everywhere, because that one is in the
  // middle of the band and would lie across the top of any cover wide enough to
  // reach it. Chrome must not cover the thing being judged.
  paddingBlockStart: "token(spacing.5xl)",
  // And the foot of it is the presets strip's, on the same grounds. Under a
  // sheet the canvas is only the top half as well, and the cover centres in
  // what is left of THAT — otherwise it would centre on the whole screen and
  // sit half behind the panel. Both lengths in one declaration, because
  // `--sheet-space` is 0px wherever there is no sheet.
  paddingBlockEnd: "calc(var(--sheet-space) + var(--presets-space))",
  transition: "padding-block-end 200ms ease-out",
  // The same phone on its side: a rail again, on a viewport globals.css does
  // not inset for (that starts at 820px). MARGIN rather than padding, because
  // what has to move is not just the picture — the gutter controls are
  // absolutely positioned against this box, and an absolute child is laid out
  // against the PADDING box, so padding would leave the theme toggle sitting
  // underneath the rail.
  _narrowRail: { marginInlineEnd: "token(sizes.propertiesPanelWidth)" },
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
  height: "token(spacing.5xl)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

// The aspect rail's box: the app's shared toolbar, hugging its contents.
//
// It rides in the GUTTER ROW, between the menu and the theme toggle, rather
// than travelling with the picture. The frame is a property of the page here —
// there is one cover, and this says what shape you are looking at it in — so it
// belongs with the page's other two controls, holding still while the picture
// changes shape underneath it. (A grid card's rail is the opposite case: it
// belongs to one card among many and has to point at it, which is why that one
// floats over its card's edge.)
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
});

// The cover the reference art is drawn on: portrait, generously rounded. The
// shader fills it because Fit opens on `cover` — a ground with margins is just
// a smaller picture — but Fit is a control now, so this is a default and not a
// guarantee.
// The card is as large as its chosen shape fits, and the same shape smaller
// wherever there is not room — a phone under a sheet, a phone on its side, a
// short desktop window. Sized on ONE axis with the ratio doing the rest, so it
// can never come out stretched: the width is the narrowest of four numbers, the
// last two of which read the space that is actually left.
//
// `--cover-w` / `--cover-h` are the chosen frame, written inline by the page
// (see `ASPECT_RATIOS`, the app's one list of shapes). They are the numerator
// and denominator rather than a ready-made `aspect-ratio` string because the
// same pair is needed twice — once as the ratio, once as the multiplier that
// turns a height budget into a width — and a single string could only serve
// the first.
//
// `--cover-max` is the box the card fits INSIDE, on both axes: 680px, the
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
// the margins belong to.
const coverStyle = css({
  position: "relative",
  isolation: "isolate",
  "--cover-max": "680px",
  aspectRatio: "var(--cover-w) / var(--cover-h)",
  width:
    "min(var(--cover-max), calc(var(--cover-max) * var(--cover-w) / var(--cover-h)), calc(token(spacing.full) - 2 * token(spacing.xxl)), calc((100dvh - var(--card-space)) * var(--cover-w) / var(--cover-h)))",
  transition: "width 200ms ease-out",
  borderRadius: "xxl",
  overflow: "hidden",
  // NO ground of its own, deliberately. A cover's own background is a colour it
  // holds — `colorBack`, with its alpha — and taking that to zero has to mean
  // what it says: you are looking THROUGH the cover, at the page. A plate
  // underneath would make the transparency a lie, and a quiet one, since
  // `bg.surface` is close enough to the canvas behind it to read as "the
  // background did not change" rather than as "something else is showing".
  //
  // What is lost is the empty card's outline for the moment before the shader
  // mounts. That is the right thing to lose: the alternative is a control that
  // cannot reach zero.
});

// The gutter row's right-hand end. The theme toggle used to answer the menu on
// its own; the sheet's way back stands beside it, so the pair reads as one
// group rather than a third control drifting somewhere else on the band.
const chromeEndStyle = css({ display: "flex", alignItems: "center", gap: "md" });

// Controls that only exist while the panel is a sheet: its close button, and
// the button that brings it back. Both are meaningless against a docked rail —
// there is nothing to close and nothing to reopen — so the media query is what
// mounts them, and a phone turned on its side is back to the rail with neither
// in sight and no state to put right.
const sheetOnlyStyle = css({ display: "none", _bottomSheet: { display: "flex" } });

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
 * content is the thing you click, the first click on the cover would slide the
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
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panel.section}>
      <div className={panel.sectionHeader}>
        <div className={panel.sectionTitle}>
          <Typography tag="p" type="bodySmall">
            {title}
          </Typography>
        </div>
      </div>
      <div className={panel.controlPanel} role="group" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

/** A saved cover this page was opened on, if it was opened on one. */
export interface OpenedCover {
  id: string;
  title: string | null;
  shaderId: ShaderId;
  settings: CoverSettings;
  /** When it went on show, and null while it is the author's alone. */
  publishedAt: Date | null;
}

export function CoverPlayground({ cover }: { cover?: OpenedCover }) {
  // The draft lives in a STORE rather than in this component, because the
  // commands that commit it — "Save changes and exit", ⌘S — are in the command
  // palette, which is mounted in the root layout and knows nothing about the
  // page under it. See `@/store/cover-draft`.
  const shaderId = useCoverDraftStore((draft) => draft.shaderId);
  const state = useCoverDraftStore((draft) => draft.settings);
  const selectShaderInStore = useCoverDraftStore((draft) => draft.selectShader);
  const setParamInStore = useCoverDraftStore((draft) => draft.setParam);
  const setColorsInStore = useCoverDraftStore((draft) => draft.setColors);
  const setColorBackInStore = useCoverDraftStore((draft) => draft.setColorBack);
  const setExtraColorInStore = useCoverDraftStore(
    (draft) => draft.setExtraColor,
  );
  const setFramingInStore = useCoverDraftStore((draft) => draft.setFraming);
  const setAspectInStore = useCoverDraftStore((draft) => draft.setAspect);
  const resetParamsInStore = useCoverDraftStore((draft) => draft.resetParams);
  const setPublishedAtInStore = useCoverDraftStore(
    (draft) => draft.setPublishedAt,
  );
  // Which of the two things the header's publish button is, and whether it has
  // a saved row to act on at all.
  const savedCoverId = useCoverDraftStore((draft) => draft.coverId);
  const publishedAt = useCoverDraftStore((draft) => draft.publishedAt);
  const isDirty = useCoverDraftStore((draft) => draft.isDirty);
  // Which shapes have been reframed since the cover was opened — the rail marks
  // them, so unsaved work in a frame that is not on screen is not invisible.
  const editedAspects = useCoverDraftStore((draft) => draft.editedAspects);

  // This page's rail is the propertiesPanel RECIPE rather than the component —
  // the component is a dismissible dialog, and a playground whose whole content
  // is the thing you click would close it on the first press with nothing left
  // to bring it back. So the inset the component arranges for itself is asked
  // for here directly, and permanently: this rail never leaves.
  usePropertiesPanelInset(true);
  const spec = SHADER_SPECS[shaderId];

  // What the AUTHOR is shown on top of the playground everybody gets: the
  // shader picker, and the button that puts a cover on show. Both are about
  // authoring a cover rather than looking at one — a visitor takes up a
  // published preset and pushes it around, which needs neither.
  //
  // What to draw, never what may be done: `publishCover` checks the session
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
  const canDelete = isAdmin && savedCoverId !== null && !isDirty;
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** Remove the saved preset, and go back to a blank draft. */
  async function deletePreset() {
    if (!savedCoverId || deleting) return;
    setDeleting(true);
    try {
      await deleteCover(savedCoverId);
      // The cover does NOT stay on screen: deleting is a deliberate "I do not
      // want this", and leaving it in the panel would invite re-saving the
      // thing just thrown away. The URL stops naming a row that no longer
      // exists — replaced rather than pushed, since the deleted cover is not
      // somewhere to go back to.
      useCoverDraftStore.getState().reset();
      window.history.replaceState(null, "", "/playground/cover");
    } catch (err) {
      // A failed delete must not look like a successful one: the row is still
      // there, so the playground must still be holding it.
      console.error("Failed to delete the preset:", err);
    } finally {
      setDeleting(false);
    }
  }

  /** Put the saved cover on show, or take it back off. */
  const [publishing, setPublishing] = useState(false);
  async function togglePublished() {
    if (!savedCoverId || publishing) return;
    setPublishing(true);
    try {
      // The row is the authority on its own state: what comes back is what is
      // recorded, rather than a date this button made up and hoped matched.
      const saved = publishedAt
        ? await unpublishCover(savedCoverId)
        : await publishCover(savedCoverId);
      setPublishedAtInStore(saved.publishedAt);
    } catch (err) {
      // Leaves the button saying what is still true. A failed publish that
      // flipped the icon anyway would be the worse outcome by far: the strip
      // would go on showing the cover to nobody while the panel claimed it was
      // out.
      console.error("Failed to change the cover's publication:", err);
    } finally {
      setPublishing(false);
    }
  }

  // The frame, and the two numbers the card is drawn from. Looked up in the
  // app's one table of shapes rather than split off the key, so a ratio that is
  // not in it cannot reach the CSS.
  const aspect = state.aspect;
  const [ratioWidth, ratioHeight] = ASPECT_RATIOS[aspect];

  // Whether the sheet has been sent away. Read ONLY inside the bottom-sheet
  // media query (see `panda.config.ts`), which is what makes rotating the phone
  // the whole of the repair: in landscape the rail is back whatever this says.
  const [dismissed, setDismissed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const { offset, dragHandlers } = useSheetDrag({
    sheetRef: panelRef,
    onDismiss: () => setDismissed(true),
    // Asked at press time rather than watched: a docked rail's header is
    // dragged by nobody, and the answer cannot change mid-gesture.
    enabled: isBottomSheetLayout,
  });

  // Adopt the cover this route was opened on — and RESET when there is none, so
  // arriving at the bare route after editing a saved one starts blank rather
  // than silently continuing to edit the last cover under a URL that claims to
  // be a new one. Keyed on the id, so re-renders do not re-seed over live edits.
  const coverId = cover?.id;
  useEffect(() => {
    const store = useCoverDraftStore.getState();
    if (cover) {
      // Already holding this one — do NOT re-seed. ⌘S on a never-saved cover
      // creates the row and then replaces the URL with its id, so this route
      // mounts a moment later carrying a cover the draft is already editing.
      // Loading it again would throw away anything tuned during that gap, which
      // is exactly the window the author is most likely to still be working in.
      if (store.coverId === cover.id) return;
      store.load(cover);
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
  }, [coverId]);

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

  // The placement controls are stored per SHAPE and the rest per cover, so the
  // panel has to know which of the two a row is writing to. Read and write are
  // one pair rather than a second copy of `renderControl` — the switch over
  // control kinds is the thing that must not be duplicated (see there), and
  // where a value lives is orthogonal to what kind of control shows it.
  const isFramingControl = (key: string) => FRAMING_CONTROL_KEYS.includes(key);
  const framing = framingFor(state);
  const valueOf = (key: string) =>
    isFramingControl(key) ? framing[key] : state.params[key];

  function setParam(key: string, value: number | boolean | string) {
    if (isFramingControl(key)) {
      setFramingInStore(key, Number(value));
      return;
    }
    setParamInStore(key, value);
  }

  /**
   * Growing the colour list copies the LAST colour rather than inserting a
   * default: a new stop the same as its neighbour is invisible until you edit
   * it, whereas a black one drops a hole into the gradient you were tuning.
   * (Same reasoning as the media properties panel.)
   */
  function setColorCount(count: number) {
    const colors = state.colors.slice(0, count);
    while (colors.length < count) {
      colors.push(colors[colors.length - 1] ?? "#FFFFFFFF");
    }
    setColorsInStore(colors);
  }

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
        <div
          className={coverStyle}
          data-cover-stage
          style={
            {
              "--cover-w": ratioWidth,
              "--cover-h": ratioHeight,
            } as CSSProperties
          }
        >
          <ShaderStage
            spec={spec}
            // Both halves, put back together — the shader's own uniforms with
            // the current shape's placement over them. See `shaderParamsFor`.
            params={shaderParamsFor(state)}
            colors={state.colors}
            colorBack={state.colorBack}
            extraColors={state.extraColors}
          />
        </div>

        {/* The site's own two gutter controls, exactly as an article carries
            them — same button, same chip, same store. The playground has no
            intro row to hang them off, so the band is measured from the canvas
            instead. */}
        <div className={canvasChromeStyle}>
          <MenuButton />

          {/* The frame the cover is being designed against.

              It shapes the PREVIEW and nothing else: a cover is shapeless, and
              every surface that embeds one gives it that surface's own shape.
              What it is for is judging — the same fan of light reads as a
              poster and as a banner differently, and this is how you look at
              both — and the shape is kept on the draft so that reopening the
              cover reopens the frame it was judged in. See `@/domain/cover`.

              A third item in a `space-between` row, which is what centres it
              BETWEEN the two ends rather than on the band's own midline. The
              difference only shows when the ends are uneven — a phone with the
              sheet dismissed grows a second button on the right — and there the
              flex reading is the safe one: it slides the rail over instead of
              letting it collide with the button. */}
          <div className={cx(toolbar({ size: "md" }), aspectRailStyle)}>
            <AspectRail
              ariaLabel="Preview aspect ratio"
              aspect={aspect}
              onPick={setAspectInStore}
              markedAspects={editedAspects}
            />
          </div>

          <div className={chromeEndStyle}>
            {dismissed && (
              <Button
                variant="icon"
                className={sheetOnlyStyle}
                aria-label="Properties"
                onClick={() => setDismissed(false)}
              >
                <BottomSheetIcon />
                <Button.Tooltip>
                  <Tooltip.Text>Properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}
            <ThemeToggleButton />
          </div>
        </div>

        {/* The saved covers, along the foot of the canvas. Inside it rather
            than fixed to the viewport, so the strip gives the properties rail
            the same room the rest of this page does — see `presets-pane`.

            Mounted for everybody: the pane decides what is in it and whether
            there is anything to draw at all, and the page reserves its band off
            whether it drew one. */}
        <PresetsPane />
      </div>

      {/* The rail, and the same panel along the bottom edge on a phone held
          upright — one element either way, because it is one panel: the shape
          is the recipe's media query, and the only thing this page adds is
          whether the sheet has been sent away.

          `translate` inline for the length of a drag and nothing after it: the
          finger places the sheet while it is on it, and lets CSS have it back
          at the end so the dismissed state (or the slide home) is not outranked
          by a stale transform. */}
      <aside
        ref={panelRef}
        className={panel.root}
        aria-label="Properties"
        data-dismissed={dismissed || undefined}
        data-dragging={offset !== null || undefined}
        style={offset !== null ? { translate: `0 ${offset}px` } : undefined}
      >
        <div className={cx(panel.header, sheetGripStyle)} {...dragHandlers}>
          <Typography tag="p" type="bodyLarge" className={panel.title}>
            Properties
          </Typography>
          <div className={headerActionsStyle}>
            {/* "Reset", flat — the panel is what it acts on and the header is
                where it says so. WHERE it resets to (the preset you opened, or
                the shader's defaults where there is no preset) is the store's
                to decide; spelling that out in the label would make the shortest
                control in the header the wordiest thing in it. */}
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

            {/* Whether this cover is on show — one button, because it is one
                fact with two settings, and a pair sitting side by side would
                always have one of them inert.

                Beside Reset rather than in the command palette, which is where
                an article's Publish lives. The difference is what the control
                acts on: a post's publish acts on the page you are looking at,
                where this acts on the SAVED ROW behind the panel — the same
                thing Reset restores from — so it belongs in the panel's own
                header with it.

                It publishes what was last SAVED, not what is in the panel: ⌘S
                is the one press that decides between creating a row and
                updating one, and a second control making that decision would be
                two doors to one room. Which is also why it is disabled until
                there is a row — there is nothing yet for "publish this" to
                name.

                The author's alone, and nothing here is what enforces that:
                `publishCover` asks the server. */}
            {isAdmin && (
              <Button
                variant="icon"
                aria-label={publishedAt ? "Unpublish" : "Publish"}
                disabled={!savedCoverId || publishing}
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
            <Button
              variant="icon"
              className={sheetOnlyStyle}
              aria-label="Close properties"
              onClick={() => setDismissed(true)}
            >
              <CrossIcon />
              <Button.Tooltip>
                <Tooltip.Text>Close properties</Tooltip.Text>
              </Button.Tooltip>
            </Button>
          </div>
        </div>

        {/* The shader itself is the AUTHOR's choice, so a visitor is not shown
            this group. What they came for is the cover in front of them — the
            preset they opened, with its own controls under it — and a picker
            that swapped it for a bare `godRays` would throw that cover away
            with nothing to get it back. The panel below still gives them every
            control the mounted shader has. */}
        {isAdmin && (
          <Group title="Shader">
            {/* A list rather than a row of chips: six names read as a set to pick
              ONE of, and the selected row says which is mounted without the
              reader having to compare button emphases. `sm` because the panel's
              own rows are 24px — a 32px-pitch list inside it would be the
              loudest thing in the rail. */}
            <OptionList
              size="sm"
              // The recipe's own width is the 208px popover pitch it shares with
              // the calendar. In here the panel is the frame, so the list takes
              // the column it was given — `utilities` outranks `recipes`, which
              // is what lets a consumer widen it without a variant.
              className={css({ width: "token(spacing.full)" })}
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

        <Group title="Colours">
          <Field size="sm" data-property-control>
            <Field.Label>Count</Field.Label>
            <Slider
              min={1}
              max={spec.maxColors}
              step={1}
              value={state.colors.length}
              onValueChange={setColorCount}
            />
          </Field>

          {state.colors.map((color, index) => (
            <Field size="sm" key={index} data-property-control>
              <Field.Label>{`Colour ${index + 1}`}</Field.Label>
              <ColorInput
                value={color}
                onValueChange={(value) =>
                  setColorsInStore(
                    state.colors.map((existing, i) =>
                      i === index ? value : existing,
                    ),
                  )
                }
              />
            </Field>
          ))}

          {spec.hasColorBack && state.colorBack && (
            <Field size="sm" data-property-control>
              <Field.Label>Background</Field.Label>
              <ColorInput
                value={state.colorBack}
                onValueChange={(value) => setColorBackInStore(value)}
              />
            </Field>
          )}

          {spec.extraColors.map((extra) => (
            <Field size="sm" key={extra.key} data-property-control>
              <Field.Label>{extra.label}</Field.Label>
              <ColorInput
                value={state.extraColors[extra.key]}
                onValueChange={(value) => setExtraColorInStore(extra.key, value)}
              />
            </Field>
          ))}
        </Group>

        {/* The fan itself, then what is drawn ON it: the ramp is laid along the
            track, and the rails trace the bands the ramp fills. Reading order
            follows that dependency rather than the control table's own. */}
        <Group title="Track">{ownControls.map(renderControl)}</Group>

        {/* Each absent entirely for a shader with none, rather than an empty
            strip — the same rule Motion follows below. */}
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
            the rest of it is the cover's, whatever shape you are in. */}
        <Group title={`Framing ${aspect.replace("/", ":")}`}>
          {framingControls.map(renderControl)}
        </Group>

        {/* Absent entirely for a shader that never samples time, rather than
            present and inert — see `MOTION_CONTROLS`. */}
        {motionControls.length > 0 && (
          <Group title="Motion">{motionControls.map(renderControl)}</Group>
        )}
      </aside>

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
