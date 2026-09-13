"use client";

import { useMemo, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { hotkey, menuIcon } from "../../../../styled-system/recipes";
import InfoIcon from "@/assets/icons/info.svg";
import { useTrickleProgress } from "@/hooks/use-demo-loader";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlaygroundChrome } from "@/components/playground-chrome";
import { ScrimBlur } from "@/components/scrim-blur";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { PANEL_RESERVED_ATTR } from "@/hooks/use-properties-panel-inset";
import { Tooltip } from "@/components/ui/tooltip";
import { Typography } from "@/components/ui/typography";
import {
  DEFAULT_ICON_SETTINGS,
  matchesIcon,
  type IconViewSettings,
} from "@/domain/icon";
import {
  archiveNameFor,
  downloadPlanFor,
  iconFilesFor,
  saveDownload,
} from "./icon-download";
import { IconGrid, MarqueeBand } from "./icon-grid";
import { preloaderPercent } from "./icon-progress";
import { IconsPanel } from "./icons-panel";
import { useIconLibrary } from "./use-icon-library";
import { useIconMarquee } from "./use-icon-marquee";

// ---------------------------------------------------------------------------
// Icons Playground — the set, drawn at whatever size and weight you want to
// see it at, and taken away at the same.
//
// The problem it exists for: the set is authored on two grids. A 16 drawn at
// 1px and a 20 drawn at 1.25px are the SAME optical weight, so they belong in
// one set — but they are not the same file, and until they are side by side at
// one size nobody can tell whether they are the same drawing. So every icon
// here is scaled to the chosen box and re-weighted to the chosen line, and
// what leaves in a download is exactly what is on screen (`icon-download`).
//
// Public, on the same grounds as the two playgrounds beside it: the sliders
// write nothing, and the grid is a set of icons anybody may look at. Uploading
// to it, publishing a held icon and deleting one are the author's, and are
// gated on the server rather than here — see `actions/icon-set`.
//
// Layout is the shader playground's, because it is the same kind of page: the
// main area is the thing being judged, the sidebar is every control that acts
// on it, and the page's own two chrome buttons sit in the band across the top.
// The panel is the real `PropertiesPanel` rather than the hand-rolled rail the
// shader page needs for its drag-to-dismiss sheet.
// ---------------------------------------------------------------------------

// The search bar's box, and the room it takes at the foot of the page. The
// calchemy playground's numbers, because it is that playground's bar: 32px off
// the bottom edge, a 40px row, and another 32 of frosting fading out above it.
//
// The hint is a 28px LEDGE standing on top of the pill rather than a row
// inside it (Figma 1222:1901), tucked a pixel under so its own bottom corners
// disappear behind the box. All three numbers meet here because the frosted
// band and the sheet's foot padding are both derived from this one: get it
// wrong and the last row of icons comes to rest behind the bar.
const BAR_INSET = "token(spacing.3xl)";
const BAR_ROW = "token(spacing.4xl)";
const BAR_LEDGE = "token(sizes.toolbarButton)";
/** How far the ledge tucks under the pill, hiding its square bottom corners. */
const BAR_LEDGE_OVERLAP = "token(spacing.xxs)";
const BAR_HEIGHT = `calc(${BAR_LEDGE} + ${BAR_ROW} - ${BAR_LEDGE_OVERLAP})`;
const BAR_WIDTH = "min(480px, calc(100dvw - 2 * token(spacing.3xl)))";
const SCRIM_CLEARANCE = "token(spacing.3xl)";
const BAR_SPACE = `calc(${BAR_INSET} + ${BAR_HEIGHT} + ${SCRIM_CLEARANCE})`;

// The viewport, with the grid in the middle of what the docked panel leaves of
// it: `usePropertiesPanelInset` insets the body while the panel is open, so
// nothing here reserves the panel's width a second time.
//
// `padding: none` is stated rather than omitted because `main` carries the
// site's own (globals.css), which would inset the scroller from the edges it
// is meant to reach.
const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  padding: "none",
  position: "relative",
  // How tall the gutter controls' box is — `PlaygroundChrome` draws it and the
  // sheet below reserves it, so the number is the PAGE's to say or the two
  // would disagree. The site's 80px band on a desktop; on a phone the menu's
  // own 40px row plus the 8px standoff, which is what the other playgrounds
  // use and for their reason: 80 fills a gap an article already opens above
  // its first row, and there is no such gap here.
  "--chrome-band": "token(spacing.5xl)",
  _bottomSheet: {
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
  },
  // A band pinned over the top of the page is a band anything scrolled to by
  // anchor has to clear.
  scrollPaddingTop: `calc(var(--chrome-band) + ${SCRIM_CLEARANCE})`,
});

// The CANVAS: everything under the chrome band that is not the docked panel,
// and the surface a sweep is drawn on.
//
// Edge to edge on purpose. The icons themselves keep to a 960px column (see
// `columnStyle` in `icon-grid`), but the band is a gesture of the page: a
// hand that starts in the room beside the set is still reaching for the set,
// and a surface stopping at the column's edge would answer that with nothing.
// The panel needs no exclusion of its own — the body is padded by the rail's
// width, so this box already ends where the rail begins.
//
// `relative` so the band can be placed in its coordinates, and unselectable
// because a drag across it would otherwise highlight the tiles' hidden names.
const canvasStyle = css({
  position: "relative",
  userSelect: "none",
  // Clear of the frosted band pinned over the top — its height plus the same
  // clearance the foot keeps, so the first row of icons is never under it.
  paddingBlockStart: `calc(var(--chrome-band) + ${SCRIM_CLEARANCE})`,
  // Room at the foot for the bar that floats over it, so the last row never
  // comes to rest behind the frosting.
  paddingBlockEnd: BAR_SPACE,
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

// Nothing to draw yet, or nothing to draw at all. One box for both, because
// the difference is only which sentence is in it.
const emptyStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: `calc(100dvh - var(--chrome-band) - ${SCRIM_CLEARANCE} - ${BAR_SPACE})`,
  color: "text.body",
  textAlign: "center",
});

// The band the bar floats in, frosted so the bar is not sitting crisply on a
// field of marks. Fixed, and inset from the right by whatever the docked panel
// is holding: a fixed element is measured against the viewport rather than the
// padded body, so without `--page-inset-end` (which globals.css publishes for
// exactly this, and which is 0 with no panel docked) the band would run on
// underneath the rail. Transitioned to match the 200ms the page slides by,
// since a custom property flips instantly and the band would otherwise jump.
const barScrimStyle = css({
  position: "fixed",
  insetInlineStart: 0,
  insetBlockEnd: 0,
  right: "var(--page-inset-end, 0px)",
  height: BAR_SPACE,
  backgroundImage:
    "linear-gradient(to top, token(colors.bg.canvas), transparent)",
  pointerEvents: "none",
  zIndex: 1,
  transition: "right 200ms ease-out",
});

// Where the bar stands. Centred in what is LEFT of the page once the panel is
// docked — see the scrim above, including why this is transitioned. It paints
// nothing itself: the ledge and the pill under it are two surfaces, and the
// page shows between them either side of the ledge.
const barStyle = css({
  position: "fixed",
  insetBlockEnd: BAR_INSET,
  left: "calc(50% - var(--page-inset-end, 0px) / 2)",
  translate: "-50% 0",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  width: BAR_WIDTH,
  transition: "left 200ms ease-out",
});

// The pill the phrase is typed into.
const barFieldStyle = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  // The elevation every other floating surface here carries. Not in the
  // design's own frame, which is the component on its own rather than a bar
  // floating over a scrolling sheet.
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  // The glyph is `currentColor`, so the pill owns its hue.
  color: "field.text.default",
});

// The ledge the hint stands on, and the slot it stands in.
//
// The two gestures are invisible until you know them, and a sheet of two
// hundred marks is where that matters most. It is a TAB on top of the pill
// rather than a row inside it (Figma 1222:1901): inset from the pill's ends,
// a step lighter than it, and tucked a pixel under so its own square bottom
// corners vanish behind the box. Read once and stop seeing — where a row
// inside the pill was one more thing the field had to be looked past.
const barLedgeSlotStyle = css({
  display: "flex",
  justifyContent: "center",
  paddingInline: "lg",
  // Under the pill, which paints over it: later siblings in normal flow paint
  // their backgrounds last, so the tuck needs no z-index of its own.
  marginBlockEnd: `calc(-1 * ${BAR_LEDGE_OVERLAP})`,
});

const barLedgeStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "sm",
  flex: "1 1 0",
  minWidth: 0,
  height: BAR_LEDGE,
  paddingInline: "md",
  // The one corner in the box, on the two ends that show.
  borderTopRadius: "sm",
  // OPAQUE, and that is the whole reason this token is flattened: the ledge
  // stands beside the pill rather than on it, so it has nothing to take the
  // surface half of the colour from and the grid would read through it.
  backgroundColor: "bg.surfaceRaised",
  // An inset ring rather than a border, exactly as a field frame draws its
  // own edge — a real border would eat into the 28px.
  boxShadow:
    "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  // Its square bottom is behind the pill; the corners above it are its own.
  overflow: "hidden",
  // Quiet: it is an aside about the grid, not a label for the box under it.
  // The value at HALF, which is what a field's hint is — as an alpha rather
  // than `field.text.muted`, whose 50% is pre-mixed into `bg.surface` and
  // would be mixing against the wrong ground on a ledge a step lighter.
  color: "field.text.default/50",
  textStyle: "caption",
  whiteSpace: "nowrap",
});

// The sentence, laid out as a ROW so the key chip can sit in it upright. A
// `hotkey` is a 20px flex box, which inline text has no good way to hold — as
// a flex item it simply centres against the words either side of it.
//
// The spaces stay in the strings even though the gap is what you see: a flex
// item drops its own leading and trailing whitespace, so the gap does the
// spacing while `textContent` still reads as one sentence for anything that
// hears the row rather than looks at it.
const barHintTextStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  minWidth: 0,
});

const barLedgeIconStyle = menuIcon();

// The key drawn as the key — the same chip the palette's `Esc` wears and the
// calchemy bar's `⏎`, on the `menu` fill because this stands among field
// furniture rather than out on the page.
const barHintKeyStyle = hotkey({ surface: "menu" });

// The preloader's box — the shared progress bar centred in the sheet, at the
// width the media dialog gives it. The bar itself is the one the upload dialog
// fills and the component demos wait behind; this is only where it stands.
const preloaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "min(token(sizes.imagePreviewMax), token(spacing.full))",
  marginInline: "auto",
});

const triggerStyle = css({
  position: "fixed",
  insetBlockStart: "xxl",
  insetInlineEnd: "xxl",
  zIndex: 2,
});

export function IconsPlayground() {
  const isAdmin = useIsAdmin();
  const library = useIconLibrary();

  const [settings, setSettings] = useState<IconViewSettings>(DEFAULT_ICON_SETTINGS);
  const [open, setOpen] = useState(true);
  const [selection, setSelection] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [query, setQuery] = useState("");

  // The sweep is the canvas's, not the grid's — see `use-icon-marquee`. The
  // ref is made HERE and handed down rather than taken off the hook's result:
  // anything off a hook result that reaches a `ref` attribute makes the React
  // Compiler read the whole object as a ref, and every other property of it
  // read during render then fails.
  const canvasRef = useRef<HTMLDivElement>(null);
  const marquee = useIconMarquee({
    surfaceRef: canvasRef,
    selection,
    onSelectionChange: setSelection,
  });

  const { entries } = library;

  // The bar's value, over a load that happens in two acts: a listing nobody
  // can count, then the files, counted. Each act gets its own slice of the
  // one scale — see `icon-progress`. Read off two scales (a trickle to 40%,
  // then a real fraction starting at zero of two hundred) the bar climbed,
  // fell back to nothing, and climbed again.
  const trickle = useTrickleProgress(library.loading);
  const loadingPercent = preloaderPercent({
    loading: library.loading,
    trickle,
    progress: library.progress,
  });

  // What the search leaves on screen. The SELECTION is not filtered with it —
  // see `chosen` below: searching narrows what you are looking at, and an icon
  // you have already taken does not stop being taken because you went looking
  // for another one.
  const shown = useMemo(
    () => entries.filter((entry) => matchesIcon(entry.icon, query)),
    [entries, query],
  );

  // The selection as the set sees it: keys that are still in the listing, in
  // the listing's own order. Filtering here rather than pruning on every
  // refresh is what keeps a deleted icon from lingering in the count — the
  // listing is the truth about what exists, and this reads it.
  //
  // Read against the WHOLE listing rather than what the search leaves, which
  // is what lets a selection be gathered across several searches: type
  // "chevron", take four, type "arrow", take three, download seven.
  const chosen = useMemo(
    () => entries.filter((entry) => selection.includes(entry.icon.key)),
    [entries, selection],
  );

  const held = entries.filter((entry) => entry.icon.review === "held").length;
  const selectedHeld = chosen.filter(
    (entry) => entry.icon.review === "held",
  ).length;

  // Nothing chosen means everything ON SCREEN, which with an empty box is the
  // whole set — the one place the selection model decides something other
  // than "these". Filtered, it is the matches: a button that said "all" over
  // a searched grid and then handed back the icons you had just filtered out
  // would be answering a question nobody asked.
  const download = () => {
    const taking = chosen.length > 0 ? chosen : shown;
    const plan = downloadPlanFor(
      iconFilesFor(taking, settings),
      archiveNameFor(settings),
    );
    if (plan) saveDownload(plan);
  };

  const publish = () => {
    void library.approve(
      chosen
        .filter((entry) => entry.icon.review === "held")
        .map((entry) => entry.icon.key),
    );
  };

  const remove = () => {
    setPendingDelete(false);
    const keys = chosen.map((entry) => entry.icon.key);
    setSelection([]);
    void library.remove(keys);
  };

  return (
    <main
      className={pageStyle}
      // The page opens WITH its panel up, so the width it takes is reserved
      // here — in the server's HTML — rather than waiting on the effect that
      // marks the body, which cannot run until React has hydrated and so lands
      // a whole paint too late. See `PANEL_RESERVED_ATTR`.
      {...{ [PANEL_RESERVED_ATTR]: open || undefined }}
    >
      <PlaygroundChrome />

      <div
        ref={canvasRef}
        data-icon-sheet
        className={canvasStyle}
        {...marquee.surfaceProps}
      >
        {library.preloading ? (
          <div className={emptyStyle}>
            {/* The site's own preloader — the bar the upload dialog fills and
                the component demos wait behind — rather than anything this
                page invents. Determinate as soon as there is a total to count
                against, which is the moment the listing lands; before that
                there is nothing to be honest about and it trickles through the
                listing's own slice, so the handover is a step forwards. */}
            <div className={preloaderStyle}>
              <ProgressBar value={loadingPercent} label="Loading icons" />
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className={emptyStyle}>
            <Typography tag="p" type="bodyLarge">
              {/* Two nothings, and they are different: the set is empty, or
                  the search found none of it. "No icons" over a set of two
                  hundred is a bug report waiting to be filed. */}
              {entries.length > 0
                ? `Nothing matches “${query.trim()}”.`
                : isAdmin
                  ? "Nothing here yet. Add icons from the sidebar."
                  : "There are no icons here yet."}
            </Typography>
          </div>
        ) : (
          <IconGrid
            entries={shown}
            settings={settings}
            selection={selection}
            onSelectionChange={setSelection}
            showsReview={isAdmin}
            consumeSweep={marquee.consumeSweep}
            sweeping={marquee.sweeping}
          />
        )}

        {marquee.band && <MarqueeBand rect={marquee.band} />}
      </div>

      {/* The band the bar floats in, and the bar. The calchemy playground's
          arrangement, because it is the same instrument doing the same job:
          the thing being looked at fills the page, and what you talk to it
          through floats at the foot rather than taking a strip off the top.

          Mounted whatever the set holds — including while it is empty, since
          a search box that vanished when its query matched nothing would take
          away the only control that could undo the query. */}
      <div className={barScrimStyle} aria-hidden>
        <ScrimBlur towards="top" />
      </div>
      <div className={barStyle}>
        <div className={barLedgeSlotStyle}>
          <div className={barLedgeStyle}>
            <InfoIcon className={barLedgeIconStyle} aria-hidden />
            <span className={barHintTextStyle}>
              {"Hold "}
              <kbd className={barHintKeyStyle}>Shift</kbd>
              {" or drag to select multiple icons"}
            </span>
          </div>
        </div>
        <div className={barFieldStyle}>
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="Search icons…"
            ariaLabel="Search icons by name"
          />
        </div>
      </div>

      {/* The panel's way back, mounted only while it is away — a button
          offering to open what is already open would be inert half the time. */}
      {!open && (
        <Button
          variant="icon"
          aria-label="Icon properties"
          className={triggerStyle}
          onClick={() => setOpen(true)}
        >
          <PropertiesPanel.DockIcon />
          <Button.Tooltip>
            <Tooltip.Text>Icon properties</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      )}

      {open && (
        <IconsPanel
          settings={settings}
          onChange={setSettings}
          total={entries.length}
          shown={shown.length}
          held={held}
          selected={chosen.length}
          selectedHeld={selectedHeld}
          onDownload={download}
          isAdmin={isAdmin}
          busy={library.busy}
          problem={library.problem}
          onUpload={(files) => void library.upload(files)}
          onPublish={publish}
          onDelete={() => setPendingDelete(true)}
          // Whatever is taken, and mine to name. One icon gets a name field
          // too; several share only their aliases — see `IconLabelsGroup`.
          named={isAdmin ? chosen.map((entry) => entry.icon) : []}
          onRename={(edits) => void library.rename(edits)}
          onDismiss={() => setOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete}
        title={chosen.length === 1 ? "Delete Icon" : "Delete Icons"}
        message={
          chosen.length === 1
            ? `Delete ${chosen[0]?.icon.name}? This cannot be undone.`
            : `Delete ${chosen.length} icons? This cannot be undone.`
        }
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setPendingDelete(false)}
      />
    </main>
  );
}
