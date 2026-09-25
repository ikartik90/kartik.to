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

const INITIAL_SHADER: ShaderId = SHADER_IDS[0];

/** Buffer key for the never-saved draft; preset ids are cuids, so it cannot collide. */
export const NEW_SHADER_PRESET_KEY = "new";

interface DraftBuffer {
  title: string | null;
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  aspect: DemoFrameAspectRatio;
  editedAspects: DemoFrameAspectRatio[];
  savedParams: {
    shaderId: ShaderId;
    params: ShaderPresetSettings["params"];
    framing: ShaderPresetSettings["framing"];
  } | null;
}

/** One undo step: the authored picture only, never server-owned fields like `publishedAt`. */
export interface ShaderPresetHistoryStep {
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  editedAspects: DemoFrameAspectRatio[];
}

const MAX_HISTORY = 100;

interface ShaderPresetDraftStore {
  shaderPresetId: string | null;
  title: string | null;
  /** Kept outside `settings` so publishing never reads as an edit. */
  publishedAt: Date | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  /** The playground's view shape, never saved with the preset. */
  aspect: DemoFrameAspectRatio;
  isDirty: boolean;
  /** Reset's baseline: the params as last loaded or saved, with the shader they belong to. */
  savedParams: {
    shaderId: ShaderId;
    params: ShaderPresetSettings["params"];
    framing: ShaderPresetSettings["framing"];
  } | null;
  /**
   * Shapes whose framing was edited, not merely viewed, since opening.
   * An array, not a Set: a fresh Set from a selector re-renders the rail on every change.
   */
  editedAspects: DemoFrameAspectRatio[];
  /** Set-aside drafts of other presets, keyed by id or `NEW_SHADER_PRESET_KEY`; never the active one. */
  buffers: Record<string, DraftBuffer>;
  /** Undo stack for the draft on screen; restarts on every load so undo never crosses presets. */
  history: ShaderPresetHistoryStep[];
  historyIndex: number;

  selectShader: (shaderId: ShaderId) => void;
  setParam: (key: string, value: ParamValue) => void;
  setColors: (colors: ThemedColor[]) => void;
  setColorBack: (colorBack: ThemedColor) => void;
  setExtraColor: (key: string, value: ThemedColor) => void;
  /** Sets one placement control on the shape on screen only. */
  setFraming: (key: string, value: number) => void;
  setAspect: (aspect: DemoFrameAspectRatio) => void;
  setTitle: (title: string | null) => void;
  /** Does not dirty the draft: publishing leaves the picture untouched. */
  setPublishedAt: (publishedAt: Date | null) => void;
  /** Params and the on-screen shape's framing back to the last save (or defaults); colours untouched. */
  resetParams: () => void;
  load: (preset: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: ShaderPresetSettings;
    publishedAt: Date | null;
  }) => void;
  /** Adopts what was just saved; unlike `load`, never buffers the draft it replaces. */
  commit: (preset: {
    id: string;
    title: string | null;
    shaderId: ShaderId;
    settings: ShaderPresetSettings;
    publishedAt: Date | null;
  }) => void;
  openNewDraft: () => void;
  /** Records the picture unless it equals the top step; the playground calls it on a debounce. */
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  toContent: () => ShaderPresetContent;
}

// Via `shaderPresetContentFor`, not `defaultState`, so the schema strips placement controls from params.
const blank = (
  shaderId: ShaderId,
  framing: ShaderPresetSettings["framing"] = {},
): { shaderId: ShaderId; settings: ShaderPresetSettings; isDirty: boolean } => ({
  shaderId,
  settings: { ...shaderPresetContentFor(shaderId).settings, framing },
  isDirty: false,
});

const savedParamsFor = (
  state: Pick<ShaderPresetDraftStore, "savedParams" | "shaderId">,
): ShaderPresetSettings["params"] | null =>
  state.savedParams && state.savedParams.shaderId === state.shaderId
    ? state.savedParams.params
    : null;

const savedFramingFor = (
  state: Pick<ShaderPresetDraftStore, "savedParams" | "aspect">,
): Framing | null => state.savedParams?.framing[state.aspect] ?? null;

const framingWithout = (
  state: Pick<ShaderPresetDraftStore, "settings" | "aspect">,
  savedFraming: Framing | null,
): ShaderPresetSettings["framing"] => {
  const framing = { ...state.settings.framing };
  if (savedFraming) framing[state.aspect] = { ...savedFraming };
  else delete framing[state.aspect];
  return framing;
};

const snapshot = (state: ShaderPresetDraftStore): DraftBuffer => ({
  title: state.title,
  publishedAt: state.publishedAt,
  shaderId: state.shaderId,
  settings: state.settings,
  aspect: state.aspect,
  editedAspects: state.editedAspects,
  savedParams: state.savedParams,
});

const step = (
  state: Pick<ShaderPresetDraftStore, "shaderId" | "settings" | "editedAspects">,
): ShaderPresetHistoryStep => ({
  shaderId: state.shaderId,
  settings: state.settings,
  editedAspects: state.editedAspects,
});

// By value: every action rebuilds `settings`, so references never match.
const sameStep = (a: ShaderPresetHistoryStep, b: ShaderPresetHistoryStep) =>
  JSON.stringify(a) === JSON.stringify(b);

const historyFrom = (
  state: Pick<ShaderPresetDraftStore, "shaderId" | "settings" | "editedAspects">,
) => ({ history: [step(state)], historyIndex: 0 });

const keyOf = (shaderPresetId: string | null) => shaderPresetId ?? NEW_SHADER_PRESET_KEY;

export const unsavedShaderPresetKeys = (
  state: Pick<ShaderPresetDraftStore, "buffers" | "isDirty" | "shaderPresetId">,
): string[] => {
  const keys = Object.keys(state.buffers);
  return state.isDirty ? [...keys, keyOf(state.shaderPresetId)] : keys;
};

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

  // Re-seeds params: another shader's keys would be stripped on save. Framings carry over.
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
      // Same array when already marked, so a drag doesn't re-render the rail every frame.
      editedAspects: state.editedAspects.includes(state.aspect)
        ? state.editedAspects
        : [...state.editedAspects, state.aspect],
      isDirty: true,
    })),

  // Not an edit: the preset is framed for every shape, so a shape change doesn't dirty it.
  setAspect: (aspect) => set({ aspect }),

  setTitle: (title) => set({ title, isDirty: true }),

  setPublishedAt: (publishedAt) => set({ publishedAt }),

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
          // With no save, the shape goes back to unframed rather than framed at defaults.
          framing: framingWithout(state, savedFraming),
        },
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

      // Same id is a re-adopt after a save; buffering here would restore pre-save edits over it.
      if (from !== id) {
        if (state.isDirty) buffers[from] = snapshot(state);

        const buffered = buffers[id];
        if (buffered) {
          delete buffers[id];
          return {
            ...buffered,
            shaderPresetId: id,
            buffers,
            isDirty: true,
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
        aspect: DEFAULT_SHADER_PRESET_ASPECT,
        isDirty: false,
        savedParams: { shaderId, params: settings.params, framing: settings.framing },
        editedAspects: [],
        ...historyFrom({ shaderId, settings, editedAspects: [] }),
      };
    }),

  commit: ({ id, title, shaderId, settings, publishedAt }) =>
    set((state) => {
      const buffers = { ...state.buffers };
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

  pushHistory: () => {
    const state = get();
    const next = step(state);
    const top = state.history[state.historyIndex];
    if (top && sameStep(top, next)) return;
    const trimmed = state.history.slice(0, state.historyIndex + 1);
    const history = [...trimmed, next].slice(-MAX_HISTORY);
    set({ history, historyIndex: history.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
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
