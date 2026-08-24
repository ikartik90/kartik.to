import { create } from "zustand";
import {
  SHADER_IDS,
  SHADER_SPECS,
  defaultState,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import type { CoverContent, CoverSettings } from "@/domain/cover";

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

interface CoverDraftStore {
  /** The saved cover being edited, or null for one that has never been saved. */
  coverId: string | null;
  title: string | null;
  shaderId: ShaderId;
  settings: CoverSettings;
  /**
   * Whether anything has moved since the draft was opened or last saved.
   *
   * The palette reads it to decide whether "Discard changes and exit" is
   * offering to throw away anything at all — and a cover just loaded has to
   * read clean, or the command would claim work that does not exist.
   */
  isDirty: boolean;

  selectShader: (shaderId: ShaderId) => void;
  setParam: (key: string, value: ParamValue) => void;
  setColors: (colors: string[]) => void;
  setColorBack: (colorBack: string) => void;
  setExtraColor: (key: string, value: string) => void;
  setTitle: (title: string | null) => void;
  /** The shader's uniforms back to their defaults, leaving the colours alone. */
  resetParams: () => void;
  /** Adopt a saved cover — opens clean, because nothing has been changed yet. */
  load: (cover: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: CoverSettings;
  }) => void;
  /** Back to a blank draft on the first shader. */
  reset: () => void;
  /** Exactly what `CoverContentSchema` validates — see there. */
  toContent: () => CoverContent;
}

const blank = (shaderId: ShaderId) => ({
  shaderId,
  settings: defaultState(SHADER_SPECS[shaderId]) as CoverSettings,
  isDirty: false,
});

export const useCoverDraftStore = create<CoverDraftStore>((set, get) => ({
  coverId: null,
  title: null,
  ...blank(INITIAL_SHADER),

  // A switch RE-SEEDS rather than merging: a shader's control table is a
  // different shape, so carrying the old params across would carry keys the new
  // shader has never heard of — which the schema would then strip on save,
  // silently losing whatever the panel was still showing.
  selectShader: (shaderId) => set({ ...blank(shaderId), isDirty: true }),

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

  setTitle: (title) => set({ title, isDirty: true }),

  // Params only. The colours are the part you spent the time on and the part a
  // shader switch would take away anyway, so "Reset params" that also dropped
  // the ramp would be the destructive reading of a button that does not warn.
  resetParams: () =>
    set((state) => ({
      settings: {
        ...state.settings,
        params: defaultState(SHADER_SPECS[state.shaderId]).params,
      },
      isDirty: true,
    })),

  load: ({ id, title, shaderId, settings }) =>
    set({ coverId: id, title, shaderId, settings, isDirty: false }),

  reset: () => set({ coverId: null, title: null, ...blank(INITIAL_SHADER) }),

  toContent: () => {
    const { shaderId, settings } = get();
    return { shaderId, settings };
  },
}));
