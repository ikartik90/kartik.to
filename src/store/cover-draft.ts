import { create } from "zustand";
import {
  SHADER_IDS,
  SHADER_SPECS,
  defaultState,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import { DEFAULT_COVER_ASPECT, type CoverContent, type CoverSettings } from "@/domain/cover";
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
  /**
   * The shape the cover is being designed against.
   *
   * A note on the cover rather than a frame it imposes — see `@/domain/cover`.
   * It sits in `settings` because that is the blob the whole authored state
   * travels in, and it is the one part of that blob no shader ever reads.
   */
  setAspect: (aspect: DemoFrameAspectRatio) => void;
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

// The frame is carried IN rather than defaulted, because the two callers want
// different things from it: a new draft opens on the default, and a shader
// switch keeps whatever the author was designing against — the shape is a fact
// about the cover, not about the shader mounted in it.
const blank = (
  shaderId: ShaderId,
  aspect: DemoFrameAspectRatio = DEFAULT_COVER_ASPECT,
): { shaderId: ShaderId; settings: CoverSettings; isDirty: boolean } => ({
  shaderId,
  settings: { ...defaultState(SHADER_SPECS[shaderId]), aspect },
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
  selectShader: (shaderId) =>
    set((state) => ({
      ...blank(shaderId, state.settings.aspect),
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

  setAspect: (aspect) =>
    set((state) => ({
      settings: { ...state.settings, aspect },
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
