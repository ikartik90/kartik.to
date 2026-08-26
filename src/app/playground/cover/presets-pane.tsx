"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { menuIcon } from "../../../../styled-system/recipes";
import { createCover, getCovers } from "@/app/actions/cover";
import { UnsavedDot } from "@/components/unsaved-dot";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  NEW_COVER_KEY,
  unsavedCoverKeys,
  useCoverDraftStore,
} from "@/store/cover-draft";
import { coverSwatch } from "@/utils/cover-swatch";
import type { Cover, CoverContent } from "@/domain/cover";
import {
  CoverThumbnails,
  thumbnailKey,
  thumbnailSnapshot,
} from "./cover-thumbnails";
import AddIcon from "@/assets/icons/add.svg";

// ---------------------------------------------------------------------------
// The saved covers, as a strip along the foot of the playground (Figma
// 1043:2313).
//
// A LIBRARY, not a picker: the point of it is that the covers you have already
// made are on screen while you tune the next one, so "make another like that
// one" is a glance rather than a trip through the palette. Which is also why it
// is a strip rather than a dialog — a dialog would put the saved work and the
// work in progress in different places, and comparing them is the whole use.
//
// PUBLIC, and the strip is not the same strip for everybody: `getCovers` hands
// a visitor the covers that have been PUBLISHED and hands the author every one
// of them, so what a visitor sees is a finished library rather than a bench
// with half-tuned experiments on it. Opening one is the same act either way —
// it lands in the draft and can be pushed around freely — and nothing a visitor
// does reaches the database, because every write here asks the server again.
//
// Which is why the ADD tile is the author's alone. It is the one control that
// would answer a visitor with an error, and the whole of what signing in adds
// to this strip.
//
// And it is why a visitor ARRIVES on the newest published cover rather than on
// a blank draft. A blank draft is a starting point only if you can do something
// with it: the author picks a shader and saves one, where a visitor has neither
// control — so the bare route opening on the control table's first shader shows
// them a cover nobody published, above a strip whose one tile reads as
// unselected. See `openOnArrival`.
//
// The pane draws NOTHING at all rather than an empty bar: a visitor arriving
// before anything has been published has no library, and a lone rounded strip
// with nothing in it is chrome describing an absence. It is also what the page
// reads to decide whether to reserve the band the strip stands in — see
// `data-presets` below.
//
// Local to this route, per the two-page rule. Nothing else has a preset strip
// yet; if a second surface grows one, this moves to `src/components`.
// ---------------------------------------------------------------------------

/** A saved cover as the action hands it over: the row, with its blob parsed. */
type Preset = Cover & CoverContent;

// The pane: fixed to the foot of the canvas, four pixels off the bottom edge.
//
// ABSOLUTE against the canvas rather than fixed to the viewport, which is what
// makes it agree with the properties rail for free. That rail is `position:
// fixed` and the room for it is made by an inset on the body, so a pane fixed
// to the viewport would be centred on a width that includes the rail and sit
// partly underneath it — the same trap the cursor tooltip fell into (see
// `.cursor/rules`). The canvas is already the box that has given the rail its
// width, and on a phone on its side it is the box that has given up the margin
// too.
//
// `--sheet-space` in the offset is the same variable the canvas uses: on a
// phone under a bottom sheet the pane rides four pixels above the SHEET rather
// than four above a viewport edge it cannot be seen at. Zero everywhere else,
// so this is one expression and not a media query.
const paneStyle = css({
  position: "absolute",
  insetBlockEnd: "calc(var(--sheet-space) + token(spacing.sm))",
  insetInline: 0,
  marginInline: "auto",
  zIndex: 1,

  // Hugs its tiles until it runs out of room, then holds still and scrolls.
  // `max-content` is what keeps a library of two from drawing a 960px bar with
  // 800px of nothing in it.
  width: "max-content",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",

  // The band the unsaved marks hang in, ABOVE the surface below and outside it.
  //
  // It is padding on the SCROLLER rather than space above it, and that is the
  // whole reason this element and the surface are two elements now. A scroll
  // container clips on both axes whatever the block axis asks for, so a mark
  // drawn outside a scrolling strip is cut off the moment the library is long
  // enough to scroll. Inside the scroller's own padding it is not clipped —
  // the clip region is the padding box — and it is still outside the bordered
  // surface, which is what the eye reads as the strip.
  paddingBlockStart: "xl",
  overflowX: "auto",
  // A trackpad swipe that runs off the end of the strip must not be handed to
  // the browser as a back gesture — the page behind it is an editor with
  // unsaved work in it.
  overscrollBehaviorInline: "contain",
});

// The strip as it is SEEN: the rounded plate the tiles sit on. Split from the
// scroller above so the marks have somewhere outside it to hang — it owns the
// look and the row, and nothing about scrolling or where the pane sits.
const surfaceStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "md",
  padding: "lg",
  width: "max-content",

  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  borderRadius: "xxl",
  backgroundColor: "bg.surface",
});

// One tile. 80px square — `spacing.5xl`, the same 80 the gutter band is — with
// the corner the pane's own radius implies: 20px outside, 12px of padding, so 8
// inside. The frame draws 10 there; 8 is what concentric compliance and the
// radius scale both say, and a corner that disagreed with every other nested
// box in the app to match one frame is the wrong way round.
const tileStyle = css({
  flexShrink: 0,
  width: "token(spacing.5xl)",
  height: "token(spacing.5xl)",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "hidden",
  cursor: "pointer",
  // The tile IS the picture, so the ring goes outside it rather than over it.
  focusVisibleRing: "outside",
  // The one currently open is stated, not just implied by the URL — a strip of
  // near-identical swatches is exactly where you lose track of which is which.
  //
  // The brand hue, which is the token the focus ring already uses — selection
  // is the app's one branded state, and a strip of covers is the last place a
  // neutral ring would survive: it has to read as chrome against pictures that
  // are themselves every colour.
  "&[aria-current='true']": {
    cursor: "default",
    outlineWidth: "token(spacing.xs)",
    outlineStyle: "solid",
    outlineColor: "border.focusRing",
    outlineOffset: "token(spacing.xs)",
  },
});

// The add tile, which is the same square wearing the secondary button's clothes
// — it is a control rather than a picture, and that is the fill the app already
// uses for "a chip you press".
const addTileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "text.body",
  backgroundColor: "bg.button.secondary.default",
  _hover: { backgroundColor: "bg.button.secondary.hover" },
  _disabled: { cursor: "progress", opacity: 0.5 },
});

// A tile and the mark that hangs over it. The mark cannot be a child of the
// tile: the tile clips its own box so the cover's picture fills the corner, and
// a dot inside it would be cut off — the same trap the rail's dot fell into.
const tileSlotStyle = css({ position: "relative", display: "flex" });

// ABOVE the tile and OUTSIDE the surface, where the rail's sits below its
// button and outside the rail — the two marks read as one idea seen twice.
//
// 20px from the tile's top edge clears the surface's own 12px padding and its
// hairline, leaving the dot about 7px clear of the plate — the same air the
// rail's has under it. It lands in the scroller's block-start padding, which is
// inside the clip region and outside the plate; see `paneStyle`.
//
// 4px rather than the rail's 2.5px. The rail hangs its mark under a 28px chip
// in a 40px band, where this one sits over an 80px tile and would read as dirt
// on the screen at that size.
const tileMarkStyle = css({
  insetBlockEnd: "calc(token(spacing.full) + token(spacing.xxl))",
  "--unsaved-dot-size": "4px",
});

const addIconStyle = menuIcon();

/** What a preset is called — the same naming an untitled draft gets in the palette. */
function presetName(preset: Preset): string {
  return preset.title?.trim() || `Untitled ${preset.untitledIndex ?? ""}`.trim();
}

/**
 * Take up a saved cover: put it in the draft, and say so in the URL.
 *
 * NOT a navigation, which is the whole of the difference between this and what
 * it replaced. `router.push` to the cover's own route asks the server for a
 * page whose only job is to fetch the cover and hand it down — a cover this
 * strip is already holding, in full, settings and all. What arrived back was
 * the same picture and a remounted playground: the shader torn down and rebuilt
 * (a fresh webgl2 context, a fresh compile), the panel rebuilt, the strip
 * re-read. That is the reload you could see.
 *
 * `history.replaceState` is Next's own supported escape hatch for this — it
 * updates the URL and the router's idea of it without a request or a re-render
 * (Next 16 docs, "Shallow routing on the client"). REPLACE rather than push:
 * the playground is one page holding one cover at a time, and which cover that
 * is is editor state, not a place you travelled to — clicking through six
 * presets should not leave six entries to walk back out through.
 */
function adoptPreset(preset: Preset, committed = false) {
  const draft = useCoverDraftStore.getState();
  // A cover that was just WRITTEN is committed rather than loaded: loading it
  // would set the draft it came from aside as unsaved work that is now in the
  // database. See the store's `commit`.
  (committed ? draft.commit : draft.load)({
    id: preset.id,
    title: preset.title ?? null,
    shaderId: preset.shaderId,
    settings: preset.settings,
    publishedAt: preset.publishedAt,
  });
  window.history.replaceState(null, "", `/playground/cover/${preset.id}`);
}

export function PresetsPane() {
  const coverId = useCoverDraftStore((draft) => draft.coverId);
  const isDirty = useCoverDraftStore((draft) => draft.isDirty);
  const buffers = useCoverDraftStore((draft) => draft.buffers);
  const openNewDraft = useCoverDraftStore((draft) => draft.openNewDraft);
  // Which covers are holding unsaved work — the ones set aside, plus the one on
  // screen if it has been touched. One answer, shared with the palette's exit
  // question, so a marked tile and a "you have unsaved changes" cannot disagree.
  const unsaved = new Set(unsavedCoverKeys({ buffers, isDirty, coverId }));
  // What to DRAW, never what may be done: the add tile's write is checked again
  // on the server, and this answers false for one render after hydration by
  // design — see `useIsAdmin`.
  const isAdmin = useIsAdmin();

  const [presets, setPresets] = useState<Preset[]>([]);
  // The pictures, keyed by preset-and-edit. Seeded from what has already been
  // drawn this session, so navigating between presets does not blank the strip
  // and redraw it. See `cover-thumbnails`.
  const [thumbnails, setThumbnails] = useState<Record<string, string>>(
    thumbnailSnapshot,
  );
  const [saving, setSaving] = useState(false);
  /**
   * Whether the arrival choice has been made. ONCE per mount, and a ref rather
   * than state because nothing renders from it: re-running it later would take
   * a visitor off a preset they had chosen and put them back on the newest.
   */
  const opened = useRef(false);

  // Commits, counted. What the re-read below wants is the EVENT — work was
  // written — and not the state: keyed on `isDirty` itself it would re-run the
  // moment you touched a slider, and its cleanup would cancel a list still on
  // its way in, leaving the strip empty until something else asked for it.
  //
  // Counted DURING RENDER rather than in an effect, which is the documented
  // adjust-state-while-rendering pattern (and the one `cover-thumbnails` uses
  // for its queue). React finishes the adjustment before running any effect, so
  // a save that both mints an id and commits — ⌘S on a cover that has never
  // been saved — settles into one re-read instead of two.
  const [tracked, setTracked] = useState({ dirty: false, commits: 0 });
  if (tracked.dirty !== isDirty) {
    setTracked({
      dirty: isDirty,
      commits: tracked.commits + (tracked.dirty && !isDirty ? 1 : 0),
    });
  }

  // Re-read on the two things that can change what is in the library, and on
  // nothing else. A row is ADDED when the draft takes up a different cover (the
  // add tile, or ⌘S on one that has never been saved), and a row CHANGES when
  // work is committed. Missing that second one would leave the tile of the
  // cover you just saved showing the picture it had before you edited it.
  //
  // Cheaper than a second list kept in step by hand, and it cannot disagree
  // with the database about what is in there.
  useEffect(() => {
    let live = true;
    getCovers()
      .then((rows) => {
        if (live) setPresets(rows);
      })
      // A library that cannot be read is a strip with nothing in it, which for
      // a visitor is no strip at all. Nothing to show and nothing worth saying
      // about it, so it fails quietly rather than reporting into the page.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [coverId, tracked.commits]);

  /**
   * What a visitor opens on: the newest published cover.
   *
   * Adopted through the same path a press on its tile takes, which is what
   * makes the tile read as the one open — the strip marks `aria-current` off
   * the draft's id, so loading the cover any other way would show the right
   * picture above a strip that looked untouched.
   *
   * The author is left alone. Their blank draft is a starting point they can
   * actually use, and `useIsAdmin` has settled by the time this can run: it
   * flips on the first commit after mount, which is before any `getCovers`
   * promise can resolve.
   *
   * Skipped entirely when the draft is already holding something — the `[id]`
   * route hands the playground a cover before this mounts, and a visitor who
   * asked for one cover must not be moved to another.
   */
  useEffect(() => {
    if (isAdmin || opened.current || presets.length === 0) return;
    const draft = useCoverDraftStore.getState();
    if (draft.coverId !== null || draft.isDirty) return;
    opened.current = true;
    // Newest first, as `getCovers` hands them over — not re-derived here.
    adoptPreset(presets[0]);
  }, [isAdmin, presets]);

  /**
   * Add the cover being tuned to the library.
   *
   * Always a CREATE, which is what the tile says it is: "New preset" that
   * quietly overwrote the preset you opened would be the same button doing two
   * different things depending on where you had been. ⌘S is the one that
   * updates in place.
   *
   * Then adopts what was stored, exactly as ⌘S does when it mints an id: the
   * draft becomes that preset, the URL catches up by `replace` (the blank route
   * is where you were, not a place to go back to), and the strip re-reads
   * itself off the `coverId` change.
   */
  async function addPreset() {
    if (saving) return;
    setSaving(true);
    try {
      const { title, shaderId, settings } = useCoverDraftStore.getState();
      const saved = await createCover({ title, shaderId, settings });

      // Adopted from what was STORED rather than from what was sent: the schema
      // normalises on the way in, so this is what makes the panel read the same
      // as the row. Same shallow URL correction as opening one — the draft is
      // already the cover that was just written, and asking the server for it
      // would only tear the playground down and rebuild it around the answer.
      adoptPreset(saved as Preset, true);
    } catch (err) {
      // Leaves the draft exactly as it was: a failed write must not look like a
      // successful one, and the work is still in the panel to try again with.
      console.error("Failed to save the preset:", err);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Open a preset. No question, and that is the point of the strip now.
   *
   * It used to ask whether to throw the current draft away, which made the
   * library unusable for the thing a library is for: you could not open one
   * cover to look at while tuning another. The draft is SET ASIDE instead (see
   * the store's `buffers`) and handed back untouched when you return, so
   * moving between presets costs nothing and there is nothing to warn about.
   *
   * The question survives where it is still true — on the way OUT of the
   * editor, which is where work actually goes missing, and where the palette
   * asks it about every cover holding something rather than only this one.
   */
  function openPreset(preset: Preset) {
    if (preset.id === coverId) return;
    adoptPreset(preset);
  }

  /** Take up the never-saved draft, which the strip gives a tile of its own. */
  function openNew() {
    if (coverId === null) return;
    openNewDraft();
    window.history.replaceState(null, "", "/playground/cover");
  }

  // Nothing to show: a visitor before anything has been published. The author
  // always has at least the add tile, so this is never their case.
  if (!isAdmin && presets.length === 0) return null;

  return (
    <>
      {/* `data-presets` is what the page reserves the strip's band off — the
          pane is the one thing that knows whether there is a strip, and the
          page owns the arithmetic. See `pageStyle`. */}
      <div className={paneStyle} data-presets>
        <div className={surfaceStyle} role="group" aria-label="Presets">
        {/* First, and fixed there: it is the only tile that is not one of the
            saved covers, and a control that moved as the library grew would be
            somewhere different every time you reached for it.

            The author's alone — it is the one control in the strip that writes,
            and a visitor pressing it would get an error back from the server. */}
        {isAdmin && (
          <button
            type="button"
            className={`${tileStyle} ${addTileStyle}`}
            aria-label="New preset"
            disabled={saving}
            onClick={() => void addPreset()}
          >
            <AddIcon className={addIconStyle} />
          </button>
        )}

        {/* The never-saved draft, for exactly as long as it is holding
            something. It has no row and so no id, but it is as openable as any
            preset — and without a tile, work tuned before the first save would
            be the one thing the strip could not give back.

            Its own tile rather than the add tile's dot, because the add tile
            already means something else: it duplicates whatever is on screen
            into a NEW preset, and a control that sometimes did that and
            sometimes navigated would be the same button doing two things. */}
        {isAdmin && unsaved.has(NEW_COVER_KEY) && (
          <div className={tileSlotStyle}>
            <button
              type="button"
              className={tileStyle}
              aria-label="Unsaved draft"
              aria-current={coverId === null ? "true" : undefined}
              // Painted from its own ramp. There is no photograph of it — the
              // thumbnailer works off saved rows — and the ramp is what a tile
              // shows until one has been taken anyway.
              style={{
                background: coverSwatch(
                  (buffers[NEW_COVER_KEY]?.settings ??
                    useCoverDraftStore.getState().settings) as Preset["settings"],
                ),
              }}
              onClick={openNew}
            />
            <UnsavedDot className={tileMarkStyle} />
          </div>
        )}

        {/* Newest first — the order `getCovers` hands them over in, kept rather
            than re-derived here. See that action for why it is by creation and
            not by last edit. */}
        {presets.map((preset) => {
          const picture = thumbnails[thumbnailKey(preset)];
          return (
            <div className={tileSlotStyle} key={preset.id}>
              <button
                type="button"
                className={tileStyle}
                aria-label={presetName(preset)}
                aria-current={preset.id === coverId ? "true" : undefined}
                // The cover itself, photographed once off-screen — the tile
                // cannot MOUNT one, because a context per tile is a strip that
                // goes blank at around sixteen presets. Its ramp stands in until
                // the picture has been taken: a colour that is already right
                // beats an empty square that resolves into the same thing.
                style={
                  picture
                    ? { backgroundImage: `url(${picture})`, backgroundSize: "cover" }
                    : { background: coverSwatch(preset.settings) }
                }
                onClick={() => openPreset(preset)}
              />
              {/* Held work, on a cover you may not be looking at. The picture
                  below is the one that was SAVED, so without this the tile
                  would show a cover that is not what taking it up would give
                  you back. */}
              {unsaved.has(preset.id) && <UnsavedDot className={tileMarkStyle} />}
            </div>
          );
        })}
        </div>
      </div>

      {/* Draws the ones that have no picture yet, one at a time, and unmounts
          itself the moment there are none. */}
      <CoverThumbnails
        presets={presets}
        onCaptured={(key, url) =>
          setThumbnails((was) => ({ ...was, [key]: url }))
        }
      />
    </>
  );
}
