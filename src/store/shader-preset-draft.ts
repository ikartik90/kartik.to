import { create } from "zustand";
import {
  SHADER_IDS,
  SHADER_SPECS,
  defaultState,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import {
  DEFAULT_SHADER_PRESET_ASPECT,
  shaderPresetContentFor,
  framingFor,
  type ShaderPresetContent,
  type ShaderPresetSettings,
  type ThemedColor,
  type Framing,
} from "@/domain/shader-preset";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// The preset being tuned, as global state rather than the playground's own.
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
 * A preset's own id is a cuid, so this cannot collide with one — and it has to
 * BE a key rather than `null`, because the buffers are an object and the new
 * draft is as bufferable as any preset. The strip gives it a tile of its own
 * for exactly as long as it is holding unsaved work.
 */
export const NEW_SHADER_PRESET_KEY = "new";

/**
 * A draft set aside while another one is being edited.
 *
 * Everything that makes the draft EXCEPT which preset it is — that is the key
 * it is filed under. `savedParams` travels with it because Reset's baseline
 * belongs to the preset rather than to the session, and `editedAspects` because
 * the rail's marks have to come back saying what they said when you left.
 */
interface DraftBuffer {
  title: string | null;
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  /**
   * The shape you were looking at. Restored on the way back in, unlike a fresh
   * load which always opens square — the buffer's job is handing the draft back
   * as you left it, and the frame you were mid-comparison in is part of that.
   */
  aspect: DemoFrameAspectRatio;
  editedAspects: DemoFrameAspectRatio[];
  savedParams: {
    shaderId: ShaderId;
    params: ShaderPresetSettings["params"];
    framing: ShaderPresetSettings["framing"];
  } | null;
}

/**
 * One step in the undo stack — the authored PICTURE and nothing else.
 *
 * Narrower than `DraftBuffer` on purpose. That carries `publishedAt` and
 * `savedParams` because setting a draft aside has to hand back everything about
 * it; those are facts the SERVER owns, and an undo that took a preset off show
 * would be undoing something the author never did in this panel.
 *
 * `editedAspects` IS here, because it is what the aspect rail marks: step a
 * framing edit back without it and the rail goes on claiming unsaved work in a
 * shape that no longer has any.
 */
export interface ShaderPresetHistoryStep {
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  editedAspects: DemoFrameAspectRatio[];
}

/** Maximum number of undo steps retained — the article editor's ceiling. */
const MAX_HISTORY = 100;

interface ShaderPresetDraftStore {
  /** The saved preset being edited, or null for one that has never been saved. */
  shaderPresetId: string | null;
  title: string | null;
  /**
   * When the saved preset went on show, and null while it is the author's alone
   * — or while there is no saved preset at all.
   *
   * A fact about the ROW rather than about the picture, which is why it sits
   * beside `shaderPresetId` and outside `settings`: nothing in the blob changes
   * when a preset is published, and putting it in there would make publishing
   * look like an edit to every consumer that diffs settings.
   */
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  /**
   * The shape the preset is being looked at in.
   *
   * The PLAYGROUND's state, not the preset's — a preset is framed for every
   * shape and records none of them as its own (see `@/domain/shader-preset`).
   * Every fresh load opens square; only a draft handed back from a buffer keeps
   * the frame it was left in.
   */
  aspect: DemoFrameAspectRatio;
  /**
   * Whether anything has moved since the draft was opened or last saved.
   *
   * The palette reads it to decide whether "Discard changes and exit" is
   * offering to throw away anything at all — and a preset just loaded has to
   * read clean, or the command would claim work that does not exist.
   */
  isDirty: boolean;
  /**
   * The params the draft was last LOADED OR SAVED with, and the shader they
   * belong to. Null for a draft that has never been written.
   *
   * Carries its shader because a saved preset's params only make sense over the
   * control table they were authored against — see `resetParams`.
   */
  savedParams: {
    shaderId: ShaderId;
    params: ShaderPresetSettings["params"];
    /** Every shape that was framed at the time, so Reset can restore the one on screen. */
    framing: ShaderPresetSettings["framing"];
  } | null;
  /**
   * The shapes whose framing has been MOVED since the preset was opened — what
   * the rail marks, so unsaved work in a frame you are not looking at is not
   * invisible.
   *
   * Edited, not merely visited, and that distinction is the whole reason this
   * is state rather than a comparison: an unframed shape draws the nearest
   * framed one's placement, so a rule that diffed what was on screen against
   * the saved preset would mark every shape you clicked through.
   *
   * An array rather than a Set because it is read straight out of the store by
   * a component: a selector returning a fresh Set on every call would re-render
   * the rail on every unrelated change.
   */
  editedAspects: DemoFrameAspectRatio[];
  /**
   * Unsaved edits to presets OTHER than the one on screen, keyed by preset id
   * (and by `NEW_SHADER_PRESET_KEY` for the one that has never been saved).
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
  /**
   * The undo stack for the draft on screen, oldest first, with the state it
   * OPENED in at the floor — so ⌘Z walks back to where you came in and stops.
   *
   * Per draft, not per session: opening another preset starts a new one (see
   * `load`). Undo crossing that line would pull a different preset's colours
   * into the one in front of you, which is not a step back by any reading.
   */
  history: ShaderPresetHistoryStep[];
  /** Where in `history` the draft currently stands. */
  historyIndex: number;

  selectShader: (shaderId: ShaderId) => void;
  setParam: (key: string, value: ParamValue) => void;
  /**
   * The ramp, as PAIRS. The panel edits one ground at a time and rebuilds the
   * array around the stop it touched — which keeps this action the same shape
   * it always was, and keeps the store from having to know which theme the
   * preview card happens to be standing in. See `@/domain/shader-preset`.
   */
  setColors: (colors: ThemedColor[]) => void;
  setColorBack: (colorBack: ThemedColor) => void;
  setExtraColor: (key: string, value: ThemedColor) => void;
  /**
   * One placement control, on the shape currently on screen and on no other.
   *
   * Separate from `setParam` because the two write to different places — the
   * shader's uniforms are one set per preset, the placement is one set per
   * shape — and a single action branching on the key would hide that split
   * inside itself. See `@/domain/shader-preset`.
   */
  setFraming: (key: string, value: number) => void;
  /**
   * The shape the preset is being designed against.
   *
   * A note on the preset rather than a frame it imposes — see
   * `@/domain/shader-preset`. It sits in `settings` because that is the blob
   * the whole authored state travels in, and it is the one part of that blob no
   * shader ever reads.
   */
  setAspect: (aspect: DemoFrameAspectRatio) => void;
  setTitle: (title: string | null) => void;
  /**
   * Record that the saved preset has gone on show, or come back off it.
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
  /** Adopt a saved preset — opens clean, because nothing has been changed yet. */
  load: (preset: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: ShaderPresetSettings;
    publishedAt: Date | null;
  }) => void;
  /**
   * Take up the never-saved draft — the strip's own tile for it.
   *
   * The counterpart to `load`: the same setting-aside on the way out and the
   * same restoring on the way back in, for the one draft that has no preset id
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
   * so `load` could not tell it from opening a different preset.
   */
  commit: (preset: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: ShaderPresetSettings;
    publishedAt: Date | null;
  }) => void;
  openNewDraft: () => void;
  /** Back to a blank draft, throwing away every buffered edit. The discard. */
  /**
   * Record the current picture as a step, if it differs from the one already at
   * the top.
   *
   * Called on a DEBOUNCE by the playground rather than from each action: a
   * slider drag emits a value per frame, and one step per frame would bury
   * every other edit in the stack. The equality check is what makes that safe
   * to call freely — a settled slider back where it started records nothing,
   * and so does a debounce firing after an undo.
   */
  pushHistory: () => void;
  /** Step back one. A no-op at the floor. */
  undo: () => void;
  /** Step forward one. A no-op at the top. */
  redo: () => void;
  reset: () => void;
  /** Exactly what `ShaderPresetContentSchema` validates — see there. */
  toContent: () => ShaderPresetContent;
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
// Through `shaderPresetContentFor` rather than `defaultState`, which is the
// domain's own answer for "where does this shader open" run through the
// validator. It matters here for one reason: `spec.controls` still lists the
// four placement controls — it is the complete list of what a shader takes — so
// `defaultState` puts them in `params`, where a preset does not keep them.
// Asking the schema is what strips them, and it cannot fall behind the schema
// the way a second filter written here would.
const blank = (
  shaderId: ShaderId,
  framing: ShaderPresetSettings["framing"] = {},
): { shaderId: ShaderId; settings: ShaderPresetSettings; isDirty: boolean } => ({
  shaderId,
  settings: { ...shaderPresetContentFor(shaderId).settings, framing },
  isDirty: false,
});

/**
 * The params "Reset params" would put back — the SAVED preset's, or null where
 * there is no save to go back to.
 *
 * Null presets two cases on purpose: a draft that has never been written, and
 * one whose shader has been switched away from the saved preset's. A preset's
 * params belong to the control table they were authored against, so restoring
 * them over a different shader would write keys it has never heard of — the
 * same silent loss `selectShader` re-seeds to avoid. Switching BACK finds the
 * baseline still there and usable.
 *
 */
const savedParamsFor = (
  state: Pick<ShaderPresetDraftStore, "savedParams" | "shaderId">,
): ShaderPresetSettings["params"] | null =>
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
  state: Pick<ShaderPresetDraftStore, "savedParams" | "aspect">,
): Framing | null => state.savedParams?.framing[state.aspect] ?? null;

/**
 * The framing map with the shape on screen put back to what the SAVE says about
 * it — the placement it was saved with, or no entry at all where it was never
 * framed. See `resetParams`.
 */
const framingWithout = (
  state: Pick<ShaderPresetDraftStore, "settings" | "aspect">,
  savedFraming: Framing | null,
): ShaderPresetSettings["framing"] => {
  const framing = { ...state.settings.framing };
  if (savedFraming) framing[state.aspect] = { ...savedFraming };
  else delete framing[state.aspect];
  return framing;
};

/** The active draft, as it would be set aside — everything but which preset it is. */
const snapshot = (state: ShaderPresetDraftStore): DraftBuffer => ({
  title: state.title,
  publishedAt: state.publishedAt,
  shaderId: state.shaderId,
  settings: state.settings,
  aspect: state.aspect,
  editedAspects: state.editedAspects,
  savedParams: state.savedParams,
});

/** The authored picture, as one undo step. */
const step = (
  state: Pick<ShaderPresetDraftStore, "shaderId" | "settings" | "editedAspects">,
): ShaderPresetHistoryStep => ({
  shaderId: state.shaderId,
  settings: state.settings,
  editedAspects: state.editedAspects,
});

/**
 * Whether two steps are the same picture.
 *
 * By serialisation rather than by reference: every action rebuilds `settings`
 * around the key it touched, so a slider dragged out and back lands on an
 * equal-but-fresh object every time. `settings` is the blob that goes to the
 * database as JSON, so it is serialisable by construction.
 */
const sameStep = (a: ShaderPresetHistoryStep, b: ShaderPresetHistoryStep) =>
  JSON.stringify(a) === JSON.stringify(b);

/** A history holding one step: the state a draft opens in, and its floor. */
const historyFrom = (
  state: Pick<ShaderPresetDraftStore, "shaderId" | "settings" | "editedAspects">,
) => ({ history: [step(state)], historyIndex: 0 });

/** What the active draft is buffered under while another is being edited. */
const keyOf = (shaderPresetId: string | null) => shaderPresetId ?? NEW_SHADER_PRESET_KEY;

/**
 * Every preset holding unsaved work: the ones set aside, plus the one on screen
 * if it has been touched.
 *
 * The strip marks its tiles off this, and the palette asks it before letting
 * you leave — one answer, so the dot and the question cannot disagree about
 * whether there is anything to lose.
 */
export const unsavedShaderPresetKeys = (
  state: Pick<ShaderPresetDraftStore, "buffers" | "isDirty" | "shaderPresetId">,
): string[] => {
  const keys = Object.keys(state.buffers);
  return state.isDirty ? [...keys, keyOf(state.shaderPresetId)] : keys;
};

/** Whether anything anywhere in this session is unsaved. */
export const hasUnsavedShaderPresetWork = (
  state: Pick<ShaderPresetDraftStore, "buffers" | "isDirty" | "shaderPresetId">,
): boolean => state.isDirty || Object.keys(state.buffers).length > 0;

export const useShaderPresetDraftStore = create<ShaderPresetDraftStore>((set, get) => ({
  shaderPresetId: null,
  title: null,
  publishedAt: null,
  savedParams: null,
  aspect: DEFAULT_SHADER_PRESET_ASPECT,
  editedAspects: [],
  buffers: {},
  ...blank(INITIAL_SHADER),
  ...historyFrom({ ...blank(INITIAL_SHADER), editedAspects: [] }),

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
      aspect: DEFAULT_SHADER_PRESET_ASPECT,
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

  // Writes onto the shape ON SCREEN, seeding it from whatever that shape is
  // currently drawn with — its own placement, or the nearest framed shape's
  // where it has none. That is what turns "this shape follows another" into
  // "this shape is its own" at the first nudge, with no separate flag saying
  // which it is, and it is the ONLY way a shape gets an entry of its own: a
  // preset holds a placement for a shape exactly when somebody framed it.
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

  // Nothing but the frame you are looking through. A shape change writes no
  // placement and does not dirty the draft, because it is not an edit: the
  // preset is authored for every shape at once, and which of them is on screen
  // is a question about the playground rather than about the preset. Marking it
  // unsaved put a dot over the strip and a "discard changes?" question in front
  // of an exit that would have lost nothing.
  //
  // A shape nobody has framed still shows the nearest framed one — that is
  // `framingFor`'s answer now, given on every read rather than pinned here on
  // the way past. So the picker still does what it is for (tune a fan as a
  // poster, press the banner, see THAT fan in a banner) and, unlike a pin, what
  // you see in an unframed shape is exactly what a container of that shape will
  // draw. From the first nudge the shape is its own and follows nothing again.
  //
  // NO automatic quarter turn on an orientation change. Turning the frame over
  // is not a special case: 3:4 is a shape nobody has framed, exactly like 2:1,
  // and it is yours to reframe. A turn here would make this the one shape
  // change that also edited a control.
  setAspect: (aspect) => set({ aspect }),

  setTitle: (title) => set({ title, isDirty: true }),

  setPublishedAt: (publishedAt) => set({ publishedAt }),

  // Params only. The colours are the part you spent the time on and the part a
  // shader switch would take away anyway, so "Reset params" that also dropped
  // the ramp would be the destructive reading of a button that does not warn.
  //
  // Back to the SAVED preset where there is one, and only to the factory
  // defaults where there is not: once a preset has been written, the thing an
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
          // there is one.
          //
          // Where there is not, the shape goes back to being UNFRAMED rather
          // than framed at the defaults — the preset says nothing about this
          // shape, and saying nothing is what putting it back means. Written
          // out as defaults it would be a placement nobody chose, pinned into
          // the preset by a button whose whole job is to remove what you did
          // not mean to do. Unframed it follows the nearest shape you framed,
          // which is what it would have drawn had you never touched it.
          framing: framingWithout(state, savedFraming),
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
      const from = keyOf(state.shaderPresetId);
      const buffers = { ...state.buffers };

      // The SAME preset, which is a commit re-adopting what was stored rather
      // than a switch to somewhere else — see `persistShaderPreset`. Setting it
      // aside here would buffer the pre-save edits and then restore them over
      // the save a line later, quietly undoing the write.
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
          return {
            ...buffered,
            shaderPresetId: id,
            buffers,
            isDirty: true,
            // A draft handed back from a buffer comes back as it was LEFT, and
            // that is where its history starts again: the steps that made it
            // belong to a visit that has ended.
            ...historyFrom(buffered),
          };
        }
      } else {
        delete buffers[id];
      }

      return {
        buffers,
        shaderPresetId: id,
        title,
        publishedAt,
        shaderId,
        settings,
        // SQUARE, every time. A preset records no shape of its own any more —
        // it is framed for all of them — so there is nothing to reopen in, and
        // the neutral frame is the one that shows the composition rather than a
        // crop of it. A draft handed back from a buffer keeps what it was left
        // in; that is the branch above.
        aspect: DEFAULT_SHADER_PRESET_ASPECT,
        isDirty: false,
        // What "last saved" means, kept in one place: a commit adopts what was
        // STORED through this same action, so writing the preset re-baselines
        // it exactly the way opening one does — which includes forgetting which
        // shapes had been reframed, since "since it was opened" starts here.
        savedParams: { shaderId, params: settings.params, framing: settings.framing },
        editedAspects: [],
        // A new draft, so a new stack with this preset at the floor. Undo must
        // not cross from one preset into another: stepping back into the
        // colours of the one you were looking at before is not a step back.
        ...historyFrom({ shaderId, settings, editedAspects: [] }),
      };
    }),

  commit: ({ id, title, shaderId, settings, publishedAt }) =>
    set((state) => {
      const buffers = { ...state.buffers };
      // The draft that was written, under whichever key it was living — and any
      // stale buffer for the row it became.
      delete buffers[keyOf(state.shaderPresetId)];
      delete buffers[id];
      return {
        buffers,
        shaderPresetId: id,
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
      if (state.shaderPresetId === null) return state;
      const buffers = { ...state.buffers };
      if (state.isDirty) buffers[keyOf(state.shaderPresetId)] = snapshot(state);

      const buffered = buffers[NEW_SHADER_PRESET_KEY];
      if (buffered) {
        delete buffers[NEW_SHADER_PRESET_KEY];
        return {
          ...buffered,
          shaderPresetId: null,
          buffers,
          isDirty: true,
          ...historyFrom(buffered),
        };
      }
      return {
        buffers,
        shaderPresetId: null,
        title: null,
        publishedAt: null,
        savedParams: null,
        aspect: DEFAULT_SHADER_PRESET_ASPECT,
        editedAspects: [],
        ...blank(INITIAL_SHADER),
        ...historyFrom({ ...blank(INITIAL_SHADER), editedAspects: [] }),
      };
    }),

  // Throws away EVERY buffered edit, not just the one on screen. This is the
  // palette's "Discard changes and exit", and a discard that left other
  // presets' unsaved work behind would be a discard you had to press more than
  // once.
  pushHistory: () => {
    const state = get();
    const next = step(state);
    const top = state.history[state.historyIndex];
    if (top && sameStep(top, next)) return;
    // Everything ahead of where we stand is a branch the author has left: a
    // fresh edit after an undo drops it, which is what stops redo restoring a
    // value that was moved away from.
    const trimmed = state.history.slice(0, state.historyIndex + 1);
    const history = [...trimmed, next].slice(-MAX_HISTORY);
    set({ history, historyIndex: history.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    // Dirty either way: stepping back to where you came in still leaves a draft
    // that differs from the row behind it until it is written.
    set({ ...history[index], historyIndex: index, isDirty: true });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    set({ ...history[index], historyIndex: index, isDirty: true });
  },

  reset: () =>
    set({
      shaderPresetId: null,
      title: null,
      publishedAt: null,
      savedParams: null,
      aspect: DEFAULT_SHADER_PRESET_ASPECT,
      editedAspects: [],
      buffers: {},
      ...blank(INITIAL_SHADER),
      ...historyFrom({ ...blank(INITIAL_SHADER), editedAspects: [] }),
    }),

  toContent: () => {
    const { shaderId, settings } = get();
    return { shaderId, settings };
  },
}));
