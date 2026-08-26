"use client";

import { useEffect, useState } from "react";
import { css } from "../../../../styled-system/css";
import { menuIcon } from "../../../../styled-system/recipes";
import { createCover, getCovers } from "@/app/actions/cover";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCoverDraftStore } from "@/store/cover-draft";
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
// Signed-in only, and the caller is what enforces that (see the playground):
// saving reads and writes the database, so a visitor would be shown a row of
// controls that answer with an error. `getCovers` refuses them a second time on
// the server, which is the check that actually protects anything.
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

  display: "flex",
  alignItems: "flex-start",
  gap: "md",
  padding: "lg",

  // Hugs its tiles until it runs out of room, then holds still and scrolls.
  // `max-content` is what keeps a library of two from drawing a 960px bar with
  // 800px of nothing in it.
  width: "max-content",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  overflowX: "auto",
  // A trackpad swipe that runs off the end of the strip must not be handed to
  // the browser as a back gesture — the page behind it is an editor with
  // unsaved work in it.
  overscrollBehaviorInline: "contain",

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
function adoptPreset(preset: Preset) {
  useCoverDraftStore.getState().load({
    id: preset.id,
    title: preset.title ?? null,
    shaderId: preset.shaderId,
    settings: preset.settings,
  });
  window.history.replaceState(null, "", `/playground/cover/${preset.id}`);
}

export function PresetsPane() {
  const coverId = useCoverDraftStore((draft) => draft.coverId);
  const isDirty = useCoverDraftStore((draft) => draft.isDirty);

  const [presets, setPresets] = useState<Preset[]>([]);
  // The pictures, keyed by preset-and-edit. Seeded from what has already been
  // drawn this session, so navigating between presets does not blank the strip
  // and redraw it. See `cover-thumbnails`.
  const [thumbnails, setThumbnails] = useState<Record<string, string>>(
    thumbnailSnapshot,
  );
  const [saving, setSaving] = useState(false);
  /** The preset a confirmed answer would open — set only while the question is up. */
  const [pendingOpen, setPendingOpen] = useState<Preset | null>(null);

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
      // A visitor who reaches this component gets an Unauthorized throw rather
      // than a list. Nothing to show and nothing to say — the strip is not
      // theirs — so it stays empty rather than reporting a failure.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [coverId, tracked.commits]);

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
      adoptPreset(saved as Preset);
    } catch (err) {
      // Leaves the draft exactly as it was: a failed write must not look like a
      // successful one, and the work is still in the panel to try again with.
      console.error("Failed to save the preset:", err);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Open a preset — after asking, if that would throw work away.
   *
   * Two answers rather than the palette's three. "Save changes" is a command
   * that already exists twice over (⌘S, and the palette's own), and a third
   * copy of the create-or-update decision living in a strip of thumbnails is
   * the duplication that decision's own brief warns about. Cancel, save, come
   * back.
   */
  function openPreset(preset: Preset) {
    if (preset.id === coverId) return;
    if (useCoverDraftStore.getState().isDirty) {
      setPendingOpen(preset);
      return;
    }
    adoptPreset(preset);
  }

  return (
    <>
      <div className={paneStyle} role="group" aria-label="Presets">
        {/* First, and fixed there: it is the only tile that is not one of the
            saved covers, and a control that moved as the library grew would be
            somewhere different every time you reached for it. */}
        <button
          type="button"
          className={`${tileStyle} ${addTileStyle}`}
          aria-label="New preset"
          disabled={saving}
          onClick={() => void addPreset()}
        >
          <AddIcon className={addIconStyle} />
        </button>

        {/* Newest first — the order `getCovers` hands them over in, kept rather
            than re-derived here. See that action for why it is by creation and
            not by last edit. */}
        {presets.map((preset) => {
          const picture = thumbnails[thumbnailKey(preset)];
          return (
            <button
              key={preset.id}
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
          );
        })}
      </div>

      {/* Draws the ones that have no picture yet, one at a time, and unmounts
          itself the moment there are none. */}
      <CoverThumbnails
        presets={presets}
        onCaptured={(key, url) =>
          setThumbnails((was) => ({ ...was, [key]: url }))
        }
      />

      <ConfirmDialog
        open={pendingOpen !== null}
        title="Unsaved Changes"
        message="You have unsaved changes to this cover. Opening a preset will discard them."
        confirmLabel="Discard changes and open"
        onConfirm={() => {
          if (pendingOpen) adoptPreset(pendingOpen);
        }}
        onClose={() => setPendingOpen(null)}
      />
    </>
  );
}
