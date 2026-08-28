import { create } from "zustand";
import {
  SHADER_IDS,
  SHADER_SPECS,
  defaultState,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import {
  DEFAULT_COVER_ASPECT,
  FRAMING_DEFAULTS,
  coverContentFor,
  framingFor,
  type CoverContent,
  type CoverSettings,
  type ThemedColor,
  type Framing,
} from "@/domain/cover";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// The cover being tuned, as global state rather than the playground's own.
//
// Global for one reason, and it is the reason `useEditorStore` and
// `useGridDraftStore` are: the COMMANDS that save and discard it live in the
// palette, which is mounted in the root layout and knows nothing about the page
// under it. A draft edited in one tree and committed from another has to be
// reachable from both, and this is the seam the other two editors already use.
//
// Everything else stays local to the playground — which control is open, what
// the copy button last said — because none of it is another tree's business.
// ---------------------------------------------------------------------------

/** Where the playground opens: the first shader in the table. */
const INITIAL_SHADER: ShaderId = SHADER_IDS[0];

/**
 * What the never-saved draft is buffered under.
 *
 * A cover's own id is a cuid, so this cannot collide with one — and it has to
 * BE a key rather than `null`, because the buffers are an object and the new
 * draft is as bufferable as any preset. The strip gives it a tile of its own
 * for exactly as long as it is holding unsaved work.
 */
export const NEW_COVER_KEY = "new";

/**
 * A draft set aside while another one is being edited.
 *
 * Everything that makes the draft EXCEPT which cover it is — that is the key it
 * is filed under. `savedParams` travels with it because Reset's baseline
 * belongs to the cover rather than to the session, and `editedAspects` because
 * the rail's marks have to come back saying what they said when you left.
 */
interface DraftBuffer {
  title: string | null;
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: CoverSettings;
  /**
   * The shape you were looking at. Restored on the way back in, unlike a fresh
   * load which always opens square — the buffer's job is handing the draft back
   * as you left it, and the frame you were mid-comparison in is part of that.
   */
  aspect: DemoFrameAspectRatio;
  editedAspects: DemoFrameAspectRatio[];
  savedParams: {
    shaderId: ShaderId;
    params: CoverSettings["params"];
    framing: CoverSettings["framing"];
  } | null;
}

interface CoverDraftStore {
  /** The saved cover being edited, or null for one that has never been saved. */
  coverId: string | null;
  title: string | null;
  /**
   * When the saved cover went on show, and null while it is the author's alone
   * — or while there is no saved cover at all.
   *
   * A fact about the ROW rather than about the picture, which is why it sits
   * beside `coverId` and outside `settings`: nothing in the blob changes when a
   * cover is published, and putting it in there would make publishing look like
   * an edit to every consumer that diffs settings.
   */
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: CoverSettings;
  /**
   * The shape the cover is being looked at in.
   *
   * The PLAYGROUND's state, not the cover's — a cover is framed for every shape
   * and records none of them as its own (see `@/domain/cover`). Every fresh
   * load opens square; only a draft handed back from a buffer keeps the frame
   * it was left in.
   */
  aspect: DemoFrameAspectRatio;
  /**
   * Whether anything has moved since the draft was opened or last saved.
   *
   * The palette reads it to decide whether "Discard changes and exit" is
   * offering to throw away anything at all — and a cover just loaded has to
   * read clean, or the command would claim work that does not exist.
   */
  isDirty: boolean;
  /**
   * The params the draft was last LOADED OR SAVED with, and the shader they
   * belong to. Null for a draft that has never been written.
   *
   * Carries its shader because a saved cover's params only make sense over the
   * control table they were authored against — see `resetParams`.
   */
  savedParams: {
    shaderId: ShaderId;
    params: CoverSettings["params"];
    /** Every shape that was framed at the time, so Reset can restore the one on screen. */
    framing: CoverSettings["framing"];
  } | null;
  /**
   * The shapes whose framing has been MOVED since the cover was opened — what
   * the rail marks, so unsaved work in a frame you are not looking at is not
   * invisible.
   *
   * Edited, not merely visited, and that distinction is the whole reason this
   * is state rather than a comparison: `setAspect` writes framing on the way
   * into a shape and on the way out of one, so a rule that diffed against the
   * saved cover would mark every shape you clicked through and mean nothing.
   *
   * An array rather than a Set because it is read straight out of the store by
   * a component: a selector returning a fresh Set on every call would re-render
   * the rail on every unrelated change.
   */
  editedAspects: DemoFrameAspectRatio[];
  /**
   * Unsaved edits to covers OTHER than the one on screen, keyed by cover id
   * (and by `NEW_COVER_KEY` for the one that has never been saved).
   *
   * What lets the strip be walked freely while work is in progress: switching
   * preset sets the current draft aside rather than asking whether to throw it
   * away, so a preset can be opened to look at and the one you were tuning is
   * still there when you come back. The tiles mark which ones are holding
   * something.
   *
   * The ACTIVE draft is never in here — it is the fields above, and `isDirty`
   * says whether it has anything unsaved. A buffer is written on the way out
   * and consumed on the way back in, so nothing is ever counted twice.
   *
   * In memory only. A refresh is a clean slate, exactly as it was when there
   * was one draft; the palette's exit question is what catches a deliberate
   * departure.
   */
  buffers: Record<string, DraftBuffer>;

  selectShader: (shaderId: ShaderId) => void;
  setParam: (key: string, value: ParamValue) => void;
  /**
   * The ramp, as PAIRS. The panel edits one ground at a time and rebuilds the
   * array around the stop it touched — which keeps this action the same shape
   * it always was, and keeps the store from having to know which theme the
   * preview card happens to be standing in. See `@/domain/cover`.
   */
  setColors: (colors: ThemedColor[]) => void;
  setColorBack: (colorBack: ThemedColor) => void;
  setExtraColor: (key: string, value: ThemedColor) => void;
  /**
   * One placement control, on the shape currently on screen and on no other.
   *
   * Separate from `setParam` because the two write to different places — the
   * shader's uniforms are one set per cover, the placement is one set per shape
   * — and a single action branching on the key would hide that split inside
   * itself. See `@/domain/cover`.
   */
  setFraming: (key: string, value: number) => void;
  /**
   * The shape the cover is being designed against.
   *
   * A note on the cover rather than a frame it imposes — see `@/domain/cover`.
   * It sits in `settings` because that is the blob the whole authored state
   * travels in, and it is the one part of that blob no shader ever reads.
   */
  setAspect: (aspect: DemoFrameAspectRatio) => void;
  setTitle: (title: string | null) => void;
  /**
   * Record that the saved cover has gone on show, or come back off it.
   *
   * Does NOT dirty the draft: publishing writes the row's own column and leaves
   * the picture untouched, so a draft that was clean before the press has still
   * got nothing unsaved in it. Dirtying it here would put a "discard changes?"
   * question in front of an exit that would lose nothing.
   */
  setPublishedAt: (publishedAt: Date | null) => void;
  /**
   * The shader's uniforms back to their baseline, leaving the colours alone.
   *
   * The baseline is the saved preset where there is one — see `savedParams`.
   */
  resetParams: () => void;
  /** Adopt a saved cover — opens clean, because nothing has been changed yet. */
  load: (cover: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: CoverSettings;
    publishedAt: Date | null;
  }) => void;
  /**
   * Take up the never-saved draft — the strip's own tile for it.
   *
   * The counterpart to `load`: the same setting-aside on the way out and the
   * same restoring on the way back in, for the one draft that has no cover id
   * to be keyed by.
   */
  /**
   * Adopt what was just WRITTEN — the save path's counterpart to `load`.
   *
   * Distinct from it because the two differ on the one question that matters
   * here: `load` is a switch, so the draft it leaves behind is set aside, where
   * this is a commit, so the draft it leaves behind has just been persisted and
   * setting it aside would leave a phantom copy of work that is now in the
   * database. Saving a never-saved draft is exactly that case — the id changes,
   * so `load` could not tell it from opening a different cover.
   */
  commit: (cover: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: CoverSettings;
    publishedAt: Date | null;
  }) => void;
  openNewDraft: () => void;
  /** Back to a blank draft, throwing away every buffered edit. The discard. */
  reset: () => void;
  /** Exactly what `CoverContentSchema` validates — see there. */
  toContent: () => CoverContent;
}

// The framings are carried IN rather than defaulted, because the two callers
// want different things from them: a new draft opens blank, and a shader switch
// keeps what the author has already framed.
//
// The FRAMINGS survive a switch, and the reason is a good one: the four
// placement controls are the same four on every shader, spread from one array,
// so unlike the params there is no key here the next shader has never heard of.
// Wiping them would be throwing away work for a reason that does not apply.
//
// Through `coverContentFor` rather than `defaultState`, which is the domain's
// own answer for "where does this shader open" run through the validator. It
// matters here for one reason: `spec.controls` still lists the four placement
// controls — it is the complete list of what a shader takes — so `defaultState`
// puts them in `params`, where a cover does not keep them. Asking the schema is
// what strips them, and it cannot fall behind the schema the way a second
// filter written here would.
const blank = (
  shaderId: ShaderId,
  framing: CoverSettings["framing"] = {},
): { shaderId: ShaderId; settings: CoverSettings; isDirty: boolean } => ({
  shaderId,
  settings: { ...coverContentFor(shaderId).settings, framing },
  isDirty: false,
});

/**
 * The params "Reset params" would put back — the SAVED preset's, or null where
 * there is no save to go back to.
 *
 * Null covers two cases on purpose: a draft that has never been written, and
 * one whose shader has been switched away from the saved cover's. A preset's
 * params belong to the control table they were authored against, so restoring
 * them over a different shader would write keys it has never heard of — the
 * same silent loss `selectShader` re-seeds to avoid. Switching BACK finds the
 * baseline still there and usable.
 *
 */
const savedParamsFor = (
  state: Pick<CoverDraftStore, "savedParams" | "shaderId">,
): CoverSettings["params"] | null =>
  state.savedParams && state.savedParams.shaderId === state.shaderId
    ? state.savedParams.params
    : null;

/**
 * The placement "Reset" would put back for the shape ON SCREEN — the saved
 * one, or null where that shape was never framed at the last save.
 *
 * Not guarded by the shader, unlike the params above: the four placement
 * controls are the same four whatever is mounted, so a saved placement is
 * restorable over any shader. And only the shape on screen, because that is
 * what the panel is showing — putting all eleven back would be a button
 * quietly undoing work in ten frames you cannot see.
 */
const savedFramingFor = (
  state: Pick<CoverDraftStore, "savedParams" | "aspect">,
): Framing | null => state.savedParams?.framing[state.aspect] ?? null;

/** The active draft, as it would be set aside — everything but which cover it is. */
const snapshot = (state: CoverDraftStore): DraftBuffer => ({
  title: state.title,
  publishedAt: state.publishedAt,
  shaderId: state.shaderId,
  settings: state.settings,
  aspect: state.aspect,
  editedAspects: state.editedAspects,
  savedParams: state.savedParams,
});

/** What the active draft is buffered under while another is being edited. */
const keyOf = (coverId: string | null) => coverId ?? NEW_COVER_KEY;

/**
 * Every cover holding unsaved work: the ones set aside, plus the one on screen
 * if it has been touched.
 *
 * The strip marks its tiles off this, and the palette asks it before letting
 * you leave — one answer, so the dot and the question cannot disagree about
 * whether there is anything to lose.
 */
export const unsavedCoverKeys = (
  state: Pick<CoverDraftStore, "buffers" | "isDirty" | "coverId">,
): string[] => {
  const keys = Object.keys(state.buffers);
  return state.isDirty ? [...keys, keyOf(state.coverId)] : keys;
};

/** Whether anything anywhere in this session is unsaved. */
export const hasUnsavedCoverWork = (
  state: Pick<CoverDraftStore, "buffers" | "isDirty" | "coverId">,
): boolean => state.isDirty || Object.keys(state.buffers).length > 0;

export const useCoverDraftStore = create<CoverDraftStore>((set, get) => ({
  coverId: null,
  title: null,
  publishedAt: null,
  savedParams: null,
  aspect: DEFAULT_COVER_ASPECT,
  editedAspects: [],
  buffers: {},
  ...blank(INITIAL_SHADER),

  // A switch RE-SEEDS rather than merging: a shader's control table is a
  // different shape, so carrying the old params across would carry keys the new
  // shader has never heard of — which the schema would then strip on save,
  // silently losing whatever the panel was still showing.
  //
  // A switch is a fresh load, so it opens SQUARE — the frame you were in
  // belonged to the shader you were looking at, and carrying it over would
  // start the new one on a crop chosen for the old one. The framings survive,
  // so returning to a shape you have already framed finds your work there.
  selectShader: (shaderId) =>
    set((state) => ({
      ...blank(shaderId, state.settings.framing),
      aspect: DEFAULT_COVER_ASPECT,
      isDirty: true,
    })),

  setParam: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        params: { ...state.settings.params, [key]: value },
      },
      isDirty: true,
    })),

  setColors: (colors) =>
    set((state) => ({
      settings: { ...state.settings, colors },
      isDirty: true,
    })),

  setColorBack: (colorBack) =>
    set((state) => ({
      settings: { ...state.settings, colorBack },
      isDirty: true,
    })),

  setExtraColor: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        extraColors: { ...state.settings.extraColors, [key]: value },
      },
      isDirty: true,
    })),

  // Writes onto the shape ON SCREEN, seeding it from the placement in force if
  // it has never been framed — which is what turns "the shape inherits" into
  // "the shape is its own" at the first nudge, with no separate flag saying
  // which it is.
  setFraming: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        framing: {
          ...state.settings.framing,
          [state.aspect]: {
            ...framingFor(state.settings, state.aspect),
            [key]: value,
          },
        },
      },
      // Marked once, on the first slider that moves. The array is left ALONE
      // when the shape is already in it, so the rail's prop keeps its identity
      // and a drag does not re-render it on every frame.
      editedAspects: state.editedAspects.includes(state.aspect)
        ? state.editedAspects
        : [...state.editedAspects, state.aspect],
      isDirty: true,
    })),

  // Changing shape SEEDS the new one where it has never been framed, with the
  // placement you arrived with — unchanged, whichever way round the new shape
  // is. Inheriting beats opening on the defaults because judging is the whole
  // point of the picker: you tune a fan on a poster, press the banner, and want
  // to see THAT fan in a banner rather than an untouched shader. From the first
  // nudge the shape is its own and inherits nothing again.
  //
  // NO automatic quarter turn on an orientation change. Turning the frame over
  // is not a special case: 3:4 is a shape you have not framed yet, exactly like
  // 2:1, and it is yours to reframe. A turn here would make this the one shape
  // change that also edited a control.
  //
  // Written on arrival rather than derived on every read, so the answer is
  // fixed the moment you first look at a shape. Derived lazily it would keep
  // following whatever you had been on last, and the same shape would frame
  // itself differently depending on the route you took to it.
  setAspect: (aspect) =>
    set((state) => {
      if (aspect === state.aspect) return state;
      const current = framingFor(state.settings, state.aspect);
      const framing = { ...state.settings.framing };
      // The shape being LEFT is pinned on the way out, if it was never framed —
      // so that what you come back to is what you left rather than a fresh
      // derivation from wherever you have been since.
      framing[state.aspect] ??= current;
      framing[aspect] ??= { ...current };
      return {
        settings: { ...state.settings, framing },
        aspect,
        isDirty: true,
      };
    }),

  setTitle: (title) => set({ title, isDirty: true }),

  setPublishedAt: (publishedAt) => set({ publishedAt }),

  // Params only. The colours are the part you spent the time on and the part a
  // shader switch would take away anyway, so "Reset params" that also dropped
  // the ramp would be the destructive reading of a button that does not warn.
  //
  // Back to the SAVED preset where there is one, and only to the factory
  // defaults where there is not: once a cover has been written, the thing an
  // experiment wants undoing against is your own last save, not the table's
  // starting point — which on a tuned preset is somewhere you have never been.
  //
  // Which baseline applies is `savedParamsFor`'s to answer — see there.
  resetParams: () =>
    set((state) => {
      const saved = savedParamsFor(state);
      const savedFraming = savedFramingFor(state);
      return {
        settings: {
          ...state.settings,
          params: saved
            ? { ...saved }
            : defaultState(SHADER_SPECS[state.shaderId]).params,
          // The placement goes back too — it is in the panel this acts on, and
          // leaving it behind would make Reset put half the sliders back. The
          // shape on screen only; the other ten are not what you are looking
          // at. Same baseline rule as the params: your own last save where
          // there is one, and the table's starting point where there is not.
          framing: {
            ...state.settings.framing,
            [state.aspect]: savedFraming
              ? { ...savedFraming }
              : { ...FRAMING_DEFAULTS },
          },
        },
        // The shape on screen is back at its baseline, so there is nothing left
        // on it to mark — and only that shape, exactly as the reset above
        // reaches only that shape.
        editedAspects: state.editedAspects.filter(
          (aspect) => aspect !== state.aspect,
        ),
        isDirty: true,
      };
    }),

  load: ({ id, title, shaderId, settings, publishedAt }) =>
    set((state) => {
      const from = keyOf(state.coverId);
      const buffers = { ...state.buffers };

      // The SAME cover, which is a commit re-adopting what was stored rather
      // than a switch to somewhere else — see `persistCover`. Setting it aside
      // here would buffer the pre-save edits and then restore them over the
      // save a line later, quietly undoing the write.
      if (from !== id) {
        // Set the current draft aside rather than asking whether to throw it
        // away. This is the whole of what lets the strip be walked while work
        // is in progress: you can open a preset to look at it and the one you
        // were tuning is waiting where you left it.
        if (state.isDirty) buffers[from] = snapshot(state);

        const buffered = buffers[id];
        if (buffered) {
          // Consumed on the way in — the active draft is never also a buffer,
          // so nothing counts as unsaved twice.
          delete buffers[id];
          return { ...buffered, coverId: id, buffers, isDirty: true };
        }
      } else {
        delete buffers[id];
      }

      return {
        buffers,
        coverId: id,
        title,
        publishedAt,
        shaderId,
        settings,
        // SQUARE, every time. A cover records no shape of its own any more — it
        // is framed for all of them — so there is nothing to reopen in, and the
        // neutral frame is the one that shows the composition rather than a
        // crop of it. A draft handed back from a buffer keeps what it was left
        // in; that is the branch above.
        aspect: DEFAULT_COVER_ASPECT,
        isDirty: false,
        // What "last saved" means, kept in one place: a commit adopts what was
        // STORED through this same action, so writing the cover re-baselines it
        // exactly the way opening one does — which includes forgetting which
        // shapes had been reframed, since "since it was opened" starts here.
        savedParams: { shaderId, params: settings.params, framing: settings.framing },
        editedAspects: [],
      };
    }),

  commit: ({ id, title, shaderId, settings, publishedAt }) =>
    set((state) => {
      const buffers = { ...state.buffers };
      // The draft that was written, under whichever key it was living — and any
      // stale buffer for the row it became.
      delete buffers[keyOf(state.coverId)];
      delete buffers[id];
      return {
        buffers,
        coverId: id,
        title,
        publishedAt,
        shaderId,
        settings,
        isDirty: false,
        savedParams: { shaderId, params: settings.params, framing: settings.framing },
        editedAspects: [],
      };
    }),

  openNewDraft: () =>
    set((state) => {
      if (state.coverId === null) return state;
      const buffers = { ...state.buffers };
      if (state.isDirty) buffers[keyOf(state.coverId)] = snapshot(state);

      const buffered = buffers[NEW_COVER_KEY];
      if (buffered) {
        delete buffers[NEW_COVER_KEY];
        return { ...buffered, coverId: null, buffers, isDirty: true };
      }
      return {
        buffers,
        coverId: null,
        title: null,
        publishedAt: null,
        savedParams: null,
        aspect: DEFAULT_COVER_ASPECT,
        editedAspects: [],
        ...blank(INITIAL_SHADER),
      };
    }),

  // Throws away EVERY buffered edit, not just the one on screen. This is the
  // palette's "Discard changes and exit", and a discard that left other covers'
  // unsaved work behind would be a discard you had to press more than once.
  reset: () =>
    set({
      coverId: null,
      title: null,
      publishedAt: null,
      savedParams: null,
      aspect: DEFAULT_COVER_ASPECT,
      editedAspects: [],
      buffers: {},
      ...blank(INITIAL_SHADER),
    }),

  toContent: () => {
    const { shaderId, settings } = get();
    return { shaderId, settings };
  },
}));
