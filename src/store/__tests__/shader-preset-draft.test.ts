import { beforeEach, describe, expect, it } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  FRAMING_DEFAULTS,
  shaderPresetContentFor,
  framingFor,
} from "@/domain/shader-preset";
import {
  NEW_SHADER_PRESET_KEY,
  hasUnsavedShaderPresetWork,
  unsavedShaderPresetKeys,
  useShaderPresetDraftStore,
} from "../shader-preset-draft";

// Via `shaderPresetContentFor`, not `defaultState`: presets keep placements out of `params`.
const savedSettings = (spec: (typeof SHADER_SPECS)[keyof typeof SHADER_SPECS]) => ({
  ...shaderPresetContentFor(spec.id).settings,
  framing: {},
});

describe("useShaderPresetDraftStore", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());

  it("opens on the first shader's defaults, with nothing saved behind it", () => {
    const state = useShaderPresetDraftStore.getState();
    expect(state.shaderPresetId).toBeNull();
    expect(state.shaderId).toBe("cosmicTrack");
    expect(state.isDirty).toBe(false);
  });

  // Only one shader exists, so this switches to itself.
  it("re-seeds from the new shader's defaults on a switch", () => {
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    useShaderPresetDraftStore.getState().selectShader("cosmicTrack");
    const state = useShaderPresetDraftStore.getState();

    expect(state.shaderId).toBe("cosmicTrack");
    expect(state.settings.params).toEqual(
      shaderPresetContentFor("cosmicTrack").settings.params,
    );
  });

  it("marks the draft dirty once a param moves", () => {
    useShaderPresetDraftStore.getState().setParam("scale", 2);

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
    expect(useShaderPresetDraftStore.getState().settings.params.scale).toBe(2);
  });

  it("loads a saved preset and opens clean, not dirty", () => {
    useShaderPresetDraftStore.getState().setParam("scale", 2);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: savedSettings(SHADER_SPECS.cosmicTrack),
      publishedAt: null,
    });

    const state = useShaderPresetDraftStore.getState();
    expect(state.shaderPresetId).toBe("preset-1");
    expect(state.title).toBe("Dusk");
    expect(state.shaderId).toBe("cosmicTrack");
    expect(state.isDirty).toBe(false);
  });

  it("reset returns a loaded preset to a blank draft", () => {
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: savedSettings(SHADER_SPECS.cosmicTrack),
      publishedAt: null,
    });
    useShaderPresetDraftStore.getState().reset();

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("cosmicTrack");
  });

  it("hands back content in the shape the domain schema takes", () => {
    const content = useShaderPresetDraftStore.getState().toContent();

    expect(content.shaderId).toBe("cosmicTrack");
    expect(content.settings).toEqual(savedSettings(SHADER_SPECS.cosmicTrack));
  });

  it("opens a switched-to shader square", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().selectShader("cosmicTrack");

    expect(useShaderPresetDraftStore.getState().aspect).toBe("1/1");
  });

  it("leaves the draft clean when only the shape moves", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
  });

  it("writes no placement for a shape that was only looked at", () => {
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setAspect("16/9");

    const { framing } = useShaderPresetDraftStore.getState().settings;
    expect(Object.keys(framing)).toEqual(["1/1"]);
  });

  it("leaves the shape alone when the params are reset", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
  });

  it("resets a loaded preset's params to what was saved, not to the defaults", () => {
    const saved = {
      ...savedSettings(SHADER_SPECS.cosmicTrack),
      params: { ...defaultState(SHADER_SPECS.cosmicTrack).params, travel: 0.9 },
    };
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: saved,
      publishedAt: null,
    });
    useShaderPresetDraftStore.getState().setParam("travel", 0.1);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params).toEqual(saved.params);
  });

  it("follows the latest save rather than the one the draft opened on", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const open = { ...savedSettings(spec), params: { ...defaultState(spec).params, travel: 0.9 } };
    useShaderPresetDraftStore
      .getState()
      .load({ id: "preset-1", title: "Dusk", shaderId: "cosmicTrack", settings: open, publishedAt: null });

    const committed = { ...open, params: { ...open.params, travel: 0.2 } };
    useShaderPresetDraftStore
      .getState()
      .load({ id: "preset-1", title: "Dusk", shaderId: "cosmicTrack", settings: committed, publishedAt: null });
    useShaderPresetDraftStore.getState().setParam("travel", 0.7);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params.travel).toBe(0.2);
  });

  it("resets an unsaved draft to the shader's defaults", () => {
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.cosmicTrack).params,
    );
  });

  // Unreachable while SHADER_SPECS holds one shader; the guard in `savedParamsFor` remains.
  it.todo("resets to the defaults after switching off the saved preset's shader");

  const framing = () => framingFor(useShaderPresetDraftStore.getState().settings, useShaderPresetDraftStore.getState().aspect);

  it("writes a placement onto the shape on screen and no other", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);

    const { settings } = useShaderPresetDraftStore.getState();
    expect(settings.framing["4/3"]?.scale).toBe(2);
    expect(settings.framing["16/9"]).toBeUndefined();
  });

  it("keeps a placement out of the shader's own params", () => {
    useShaderPresetDraftStore.getState().setFraming("scale", 2);

    expect("scale" in useShaderPresetDraftStore.getState().settings.params).toBe(false);
  });

  it("gives each shape back its own placement", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);

    useShaderPresetDraftStore.getState().setAspect("4/3");
    expect(framing().scale).toBe(2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    expect(framing().scale).toBe(3);
  });

  it("carries the placement into a shape of the same orientation", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  it("carries the placement across an orientation change, unchanged", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("3/4");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  it("lets the two sides of an orientation pair be framed apart", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setAspect("3/4");
    useShaderPresetDraftStore.getState().setFraming("rotation", -90);

    expect(framing().rotation).toBe(-90);
    useShaderPresetDraftStore.getState().setAspect("4/3");
    expect(framing().rotation).toBe(30);
  });

  it("keeps an unframed shape following the shape it inherits from", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("2/1");
    expect(framing().scale).toBe(2);

    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 4);
    useShaderPresetDraftStore.getState().setAspect("2/1");

    expect(framing().scale).toBe(4);
  });

  it("keeps the placements across a shader switch", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().selectShader("cosmicTrack");
    // The switch opens square, so go back to the shape the work was done in.
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(framing().scale).toBe(2);
  });

  it("resets the placement of the shape on screen, and only that one", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);
    useShaderPresetDraftStore.getState().resetParams();

    expect(
      useShaderPresetDraftStore.getState().settings.framing["16/9"],
    ).toBeUndefined();
    expect(framing().scale).toBe(2);
    expect(useShaderPresetDraftStore.getState().settings.framing["4/3"]?.scale).toBe(2);
  });

  it("resets to the saved placement where the preset has one", () => {
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: {
        ...savedSettings(SHADER_SPECS.cosmicTrack),
        framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 2 } },
      },
      publishedAt: null,
    });
    // A load opens square, so the shape under test must be put on screen first.
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 3.5);
    useShaderPresetDraftStore.getState().resetParams();

    expect(framing().scale).toBe(2);
  });

  const edited = () => useShaderPresetDraftStore.getState().editedAspects;

  it("opens with no shape marked", () => {
    expect(edited()).toEqual([]);
  });

  it("marks a shape when its framing is moved", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);

    expect(edited()).toEqual(["4/3"]);
  });

  it("marks nothing for a shape that was only looked at", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setAspect("9/16");

    expect(edited()).toEqual([]);
  });

  it("marks each edited shape once, however many sliders move", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setFraming("rotation", 15);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);

    expect(edited()).toEqual(["4/3", "16/9"]);
  });

  it("unmarks the shape Reset puts back, and no other", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);
    useShaderPresetDraftStore.getState().resetParams();

    expect(edited()).toEqual(["4/3"]);
  });

  it("clears the marks when a preset is loaded", () => {
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: savedSettings(SHADER_SPECS.cosmicTrack),
      publishedAt: null,
    });

    expect(edited()).toEqual([]);
  });

  it("opens a draft with nothing published behind it", () => {
    expect(useShaderPresetDraftStore.getState().publishedAt).toBeNull();
  });

  it("adopts a loaded preset's publication date", () => {
    const at = new Date("2026-01-01");
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: savedSettings(SHADER_SPECS.cosmicTrack),
      publishedAt: at,
    });

    expect(useShaderPresetDraftStore.getState().publishedAt).toEqual(at);
  });

  it("records a publish without dirtying the draft", () => {
    const at = new Date("2026-01-01");
    useShaderPresetDraftStore.getState().setPublishedAt(at);

    expect(useShaderPresetDraftStore.getState().publishedAt).toEqual(at);
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  it("forgets the publication when the draft goes back to blank", () => {
    useShaderPresetDraftStore.getState().setPublishedAt(new Date("2026-01-01"));
    useShaderPresetDraftStore.getState().reset();

    expect(useShaderPresetDraftStore.getState().publishedAt).toBeNull();
  });

  // The literal, not the constant the code reads, so a changed default fails here.
  it("opens a new draft square", () => {
    expect(useShaderPresetDraftStore.getState().aspect).toBe("1/1");
  });

  const preset = (id: string, travel = 0.5) => ({
    id,
    title: id,
    shaderId: "cosmicTrack" as const,
    settings: {
      ...savedSettings(SHADER_SPECS.cosmicTrack),
      params: { ...defaultState(SHADER_SPECS.cosmicTrack).params, travel },
    },
    publishedAt: null,
  });

  it("keeps a dirty draft when another preset is opened", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("b");
    expect(Object.keys(useShaderPresetDraftStore.getState().buffers)).toEqual(["a"]);
  });

  it("gives the work back on the way in, dirty as it was left", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().load(preset("a"));

    const state = useShaderPresetDraftStore.getState();
    expect(state.settings.params.travel).toBe(0.9);
    expect(state.isDirty).toBe(true);
    expect(state.buffers.a).toBeUndefined();
  });

  it("opens a clean preset from the database, not from a stale buffer", () => {
    useShaderPresetDraftStore.getState().load(preset("a", 0.2));
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().settings.params.travel).toBe(0.5);
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  it("brings a preset's reframed shapes back with it", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().load(preset("a"));

    expect(useShaderPresetDraftStore.getState().editedAspects).toEqual(["16/9"]);
    expect(useShaderPresetDraftStore.getState().aspect).toBe("16/9");
  });

  it("does not buffer a draft against itself when a save re-adopts it", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("a", 0.9));

    const state = useShaderPresetDraftStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.buffers.a).toBeUndefined();
    expect(state.settings.params.travel).toBe(0.9);
  });

  it("keeps an unsaved new draft when a preset is opened", () => {
    useShaderPresetDraftStore.getState().setParam("scale", 2);
    useShaderPresetDraftStore.getState().load(preset("a"));

    expect(Object.keys(useShaderPresetDraftStore.getState().buffers)).toEqual([
      NEW_SHADER_PRESET_KEY,
    ]);
  });

  it("gives the new draft back when it is taken up again", () => {
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().openNewDraft();

    const state = useShaderPresetDraftStore.getState();
    expect(state.shaderPresetId).toBeNull();
    expect(state.settings.params.rampLength).toBe(4);
    expect(state.isDirty).toBe(true);
  });

  it("opens a blank new draft when nothing was left in it", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().openNewDraft();

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  it("reports nothing unsaved on a freshly loaded preset", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));

    expect(unsavedShaderPresetKeys(useShaderPresetDraftStore.getState())).toEqual([]);
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(false);
  });

  it("counts the draft on screen as well as the ones set aside", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.8);

    expect(unsavedShaderPresetKeys(useShaderPresetDraftStore.getState()).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("still reports unsaved work left in a preset you are not looking at", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(true);
  });

  it("throws away every buffered edit on a reset", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("travel", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().reset();

    expect(useShaderPresetDraftStore.getState().buffers).toEqual({});
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(false);
  });
});

describe("useShaderPresetDraftStore history", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());

  const paramKey = "u_colorEdgeStrength";
  const setAndPush = (value: number) => {
    useShaderPresetDraftStore.getState().setParam(paramKey, value);
    useShaderPresetDraftStore.getState().pushHistory();
  };
  const paramNow = () =>
    useShaderPresetDraftStore.getState().settings.params[paramKey];

  it("opens with the draft's own state as the floor", () => {
    const state = useShaderPresetDraftStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.historyIndex).toBe(0);
  });

  it("steps back to the value before the edit", () => {
    const before = paramNow();
    setAndPush(0.25);
    expect(paramNow()).toBe(0.25);

    useShaderPresetDraftStore.getState().undo();
    expect(paramNow()).toBe(before);
  });

  it("steps forward again", () => {
    setAndPush(0.25);
    useShaderPresetDraftStore.getState().undo();
    useShaderPresetDraftStore.getState().redo();
    expect(paramNow()).toBe(0.25);
  });

  it("does not step back past the state it opened in", () => {
    const opened = paramNow();
    setAndPush(0.25);
    const store = useShaderPresetDraftStore.getState();
    store.undo();
    store.undo();
    store.undo();
    expect(paramNow()).toBe(opened);
    expect(useShaderPresetDraftStore.getState().historyIndex).toBe(0);
  });

  it("drops the redo stack once a fresh edit lands", () => {
    setAndPush(0.25);
    setAndPush(0.5);
    useShaderPresetDraftStore.getState().undo();
    setAndPush(0.75);

    useShaderPresetDraftStore.getState().redo();
    expect(paramNow()).toBe(0.75);
  });

  it("ignores a push that changes nothing", () => {
    setAndPush(0.25);
    const depth = useShaderPresetDraftStore.getState().history.length;
    useShaderPresetDraftStore.getState().pushHistory();
    expect(useShaderPresetDraftStore.getState().history).toHaveLength(depth);
  });

  it("starts a new history when another preset is opened", () => {
    setAndPush(0.25);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: savedSettings(SHADER_SPECS.cosmicTrack),
      publishedAt: null,
    });

    const state = useShaderPresetDraftStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.historyIndex).toBe(0);

    state.undo();
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("cosmicTrack");
  });

  it("leaves the draft dirty", () => {
    setAndPush(0.25);
    useShaderPresetDraftStore.getState().undo();
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
  });
});
