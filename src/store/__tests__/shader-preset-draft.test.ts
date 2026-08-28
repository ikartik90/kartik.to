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

/**
 * A saved preset's settings — the shader's own state, the frame it is judged
 * in, and the placements it has been given in each.
 *
 * Through `shaderPresetContentFor` rather than `defaultState`, because a preset
 * does not keep the four placement controls in `params`: `spec.controls` lists
 * them (it is the complete list of what a shader takes) and the schema is what
 * moves them out. See `@/domain/shader-preset`.
 */
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

  // Switching shader re-seeds: a different shader has a different control
  // table, so carrying the old params over would be carrying keys it has never
  // heard of.
  it("re-seeds from the new shader's defaults on a switch", () => {
    useShaderPresetDraftStore.getState().selectShader("godRays");
    const state = useShaderPresetDraftStore.getState();

    expect(state.shaderId).toBe("godRays");
    expect(state.settings.params).toEqual(
      shaderPresetContentFor("godRays").settings.params,
    );
  });

  it("marks the draft dirty once a param moves", () => {
    useShaderPresetDraftStore.getState().setParam("scale", 2);

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
    expect(useShaderPresetDraftStore.getState().settings.params.scale).toBe(2);
  });

  // What "Save changes and exit" writes, and what a saved preset reopens into.
  it("loads a saved preset and opens clean, not dirty", () => {
    useShaderPresetDraftStore.getState().setParam("scale", 2);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: null,
    });

    const state = useShaderPresetDraftStore.getState();
    expect(state.shaderPresetId).toBe("preset-1");
    expect(state.title).toBe("Dusk");
    expect(state.shaderId).toBe("swirl");
    // A preset just opened has no unsaved work in it, so the palette must not
    // offer to discard changes that do not exist.
    expect(state.isDirty).toBe(false);
  });

  it("reset returns a loaded preset to a blank draft", () => {
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: null,
    });
    useShaderPresetDraftStore.getState().reset();

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("cosmicTrack");
  });

  // The store hands the action layer exactly what the schema validates, so the
  // two cannot drift into disagreeing about the stored shape.
  it("hands back content in the shape the domain schema takes", () => {
    useShaderPresetDraftStore.getState().selectShader("warp");
    const content = useShaderPresetDraftStore.getState().toContent();

    expect(content.shaderId).toBe("warp");
    expect(content.settings).toEqual(savedSettings(SHADER_SPECS.warp));
  });

  // A switch is a fresh load, so it opens SQUARE. The frame you were in
  // belonged to the shader you were looking at, and carrying it over would
  // start the new one on a crop chosen for the old one.
  it("opens a switched-to shader square", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().selectShader("godRays");

    expect(useShaderPresetDraftStore.getState().aspect).toBe("1/1");
  });

  it("marks the draft dirty once the shape moves", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
  });

  // "Reset params" is about the shader's uniforms. The frame you chose to
  // design in is not one of them.
  it("leaves the shape alone when the params are reset", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
  });

  // "Reset params" on a saved preset means BACK TO THE PRESET, not back to the
  // shader's factory defaults: once a preset has been written, the thing you
  // want to undo an experiment against is your own last save.
  it("resets a loaded preset's params to what was saved, not to the defaults", () => {
    const saved = {
      ...savedSettings(SHADER_SPECS.swirl),
      params: { ...defaultState(SHADER_SPECS.swirl).params, twist: 0.9 },
    };
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: saved,
      publishedAt: null,
    });
    useShaderPresetDraftStore.getState().setParam("twist", 0.1);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params).toEqual(saved.params);
  });

  // Every save re-baselines, because a save is what "last saved" MEANS — and
  // the save path adopts what was stored through `load`, so this is the seam.
  it("follows the latest save rather than the one the draft opened on", () => {
    const spec = SHADER_SPECS.swirl;
    const open = { ...savedSettings(spec), params: { ...defaultState(spec).params, twist: 0.9 } };
    useShaderPresetDraftStore
      .getState()
      .load({ id: "preset-1", title: "Dusk", shaderId: "swirl", settings: open, publishedAt: null });

    const committed = { ...open, params: { ...open.params, twist: 0.2 } };
    useShaderPresetDraftStore
      .getState()
      .load({ id: "preset-1", title: "Dusk", shaderId: "swirl", settings: committed, publishedAt: null });
    useShaderPresetDraftStore.getState().setParam("twist", 0.7);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params.twist).toBe(0.2);
  });

  // Nothing has been saved to go back to, so the defaults are the only baseline
  // there is.
  it("resets an unsaved draft to the shader's defaults", () => {
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.cosmicTrack).params,
    );
  });

  // A saved preset's params belong to the shader it was saved on. Restoring
  // them over a different shader's control table would write keys it has never
  // heard of, so the baseline only applies where it fits.
  it("resets to the defaults after switching off the saved preset's shader", () => {
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: { ...savedSettings(SHADER_SPECS.swirl), params: { ...defaultState(SHADER_SPECS.swirl).params, twist: 0.9 } },
      publishedAt: null,
    });
    useShaderPresetDraftStore.getState().selectShader("godRays");
    useShaderPresetDraftStore.getState().resetParams();

    expect(useShaderPresetDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.godRays).params,
    );
  });

  // --- Framing, per shape ---------------------------------------------------
  //
  // The four placement controls are kept one set per aspect ratio, so that a
  // preset can be framed one way as a poster and another as a banner. The store
  // is where "which set am I writing to" is decided; the rules for what a shape
  // inherits live in `@/domain/shader-preset`.
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

  // Each shape holds its own, which is the whole feature: go back and the
  // placement you left there is still there.
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

  // Changing shape within one orientation is a different crop of the same
  // composition, so the placement carries straight over.
  it("carries the placement into a shape of the same orientation", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  // Turning the frame over is NOT a special case: the other side is a shape you
  // have not framed yet, and it opens on what you arrived with — untouched, so
  // that reframing it is yours to do rather than yours to undo.
  it("carries the placement across an orientation change, unchanged", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("3/4");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  // And the other side is then its OWN, which is the whole point of the
  // per-shape split: reframing the portrait must not reach back into the
  // landscape it was seeded from.
  it("lets the two sides of an orientation pair be framed apart", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("rotation", 30);
    useShaderPresetDraftStore.getState().setAspect("3/4");
    useShaderPresetDraftStore.getState().setFraming("rotation", -90);

    expect(framing().rotation).toBe(-90);
    useShaderPresetDraftStore.getState().setAspect("4/3");
    expect(framing().rotation).toBe(30);
  });

  // The shape being left is pinned on the way out, so that what you come back
  // to is what you left rather than a fresh derivation from wherever you have
  // been since.
  it("comes back to the shape it left, not to a derivation of where it went", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    const before = framing();
    useShaderPresetDraftStore.getState().setAspect("3/4");
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(framing()).toEqual(before);
  });

  // Seeded ON ARRIVAL, so the answer is fixed the first time you look at a
  // shape. Derived lazily it would keep following whatever you were on last,
  // and going back to a shape after retuning another would silently reframe it.
  it("holds a seeded shape still once it has been visited", () => {
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 4);

    useShaderPresetDraftStore.getState().setAspect("4/3");
    expect(framing().scale).toBe(2);
  });

  // The same four controls on every shader, spread from one array — so unlike
  // the params there is no key here the next shader has never heard of, and
  // wiping them would be throwing away work for a reason that does not apply.
  it("keeps the placements across a shader switch", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().selectShader("godRays");
    // The switch opens square, so the work is found by going back to the shape
    // it was done in — which is the point: the framings survive, the frame you
    // happened to be in does not.
    useShaderPresetDraftStore.getState().setAspect("4/3");

    expect(framing().scale).toBe(2);
  });

  // Reset acts on the panel, and the placement rows are in it — but on the
  // shape being looked at only. Putting all eleven back would be a button
  // quietly undoing work in ten frames you cannot see.
  it("resets the placement of the shape on screen, and only that one", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);
    useShaderPresetDraftStore.getState().resetParams();

    expect(framing()).toEqual(FRAMING_DEFAULTS);
    expect(useShaderPresetDraftStore.getState().settings.framing["4/3"]?.scale).toBe(2);
  });

  // Back to the SAVED placement where there is one, exactly as the params go
  // back to the saved preset rather than to the table.
  it("resets to the saved placement where the preset has one", () => {
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: {
        ...savedSettings(SHADER_SPECS.swirl),
        framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 2 } },
      },
      publishedAt: null,
    });
    // A load opens square, so the shape whose saved placement is under test has
    // to be the one on screen before Reset can put it back.
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 3.5);
    useShaderPresetDraftStore.getState().resetParams();

    expect(framing().scale).toBe(2);
  });

  // --- Which shapes have been reframed ---------------------------------------
  //
  // The rail marks a shape whose framing has been touched since the preset was
  // opened, so unsaved work in a frame you are not looking at is not invisible.
  // EDITED, not merely visited: `setAspect` writes framing on the way in and
  // out (see above), so a rule that compared values would mark every shape you
  // clicked through and mean nothing.
  const edited = () => useShaderPresetDraftStore.getState().editedAspects;

  it("opens with no shape marked", () => {
    expect(edited()).toEqual([]);
  });

  it("marks a shape when its framing is moved", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);

    expect(edited()).toEqual(["4/3"]);
  });

  // Browsing the rail is not editing, however much framing it writes.
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

  // Reset puts the shape on screen back to its baseline, so there is nothing
  // left on it to mark — and only that shape, exactly as Reset itself reaches
  // only that shape.
  it("unmarks the shape Reset puts back, and no other", () => {
    useShaderPresetDraftStore.getState().setAspect("4/3");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 3);
    useShaderPresetDraftStore.getState().resetParams();

    expect(edited()).toEqual(["4/3"]);
  });

  // Loading a preset is where "since it was opened" starts again — the same
  // seam that re-baselines the params and clears the dirty flag.
  it("clears the marks when a preset is loaded", () => {
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: null,
    });

    expect(edited()).toEqual([]);
  });

  // --- Publication ----------------------------------------------------------
  //
  // Whether the preset is on show is a fact about the SAVED row, not about the
  // picture, so it travels with the preset the draft is holding and the panel's
  // one button reads it to know which of its two things it is.
  it("opens a draft with nothing published behind it", () => {
    expect(useShaderPresetDraftStore.getState().publishedAt).toBeNull();
  });

  it("adopts a loaded preset's publication date", () => {
    const at = new Date("2026-01-01");
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: at,
    });

    expect(useShaderPresetDraftStore.getState().publishedAt).toEqual(at);
  });

  // Publishing writes the row, not the picture — so it must not leave the draft
  // claiming unsaved work and putting a "discard?" question in front of an exit
  // that would lose nothing.
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

  // Square, and stated as the literal rather than through the constant: what
  // this pins is that the playground opens neutral, which a test reading the
  // same constant the code does could not tell you.
  it("opens a new draft square", () => {
    expect(useShaderPresetDraftStore.getState().aspect).toBe("1/1");
  });

  // --- Moving between presets with work in progress --------------------------
  //
  // Switching preset SETS THE CURRENT DRAFT ASIDE rather than asking whether to
  // throw it away, so a preset can be opened to look at while another is being
  // tuned and the tuning is still there on the way back. The strip marks which
  // presets are holding something.
  const preset = (id: string, twist = 0.5) => ({
    id,
    title: id,
    shaderId: "swirl" as const,
    settings: {
      ...savedSettings(SHADER_SPECS.swirl),
      params: { ...defaultState(SHADER_SPECS.swirl).params, twist },
    },
    publishedAt: null,
  });

  it("keeps a dirty draft when another preset is opened", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("b");
    expect(Object.keys(useShaderPresetDraftStore.getState().buffers)).toEqual(["a"]);
  });

  it("gives the work back on the way in, dirty as it was left", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().load(preset("a"));

    const state = useShaderPresetDraftStore.getState();
    expect(state.settings.params.twist).toBe(0.9);
    expect(state.isDirty).toBe(true);
    // Consumed on the way in: the active draft is never also a buffer, or it
    // would count as unsaved twice.
    expect(state.buffers.a).toBeUndefined();
  });

  it("opens a clean preset from the database, not from a stale buffer", () => {
    useShaderPresetDraftStore.getState().load(preset("a", 0.2));
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().settings.params.twist).toBe(0.5);
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  // The marks travel with the draft, or the rail would come back saying
  // something different from what it said when you left.
  it("brings a preset's reframed shapes back with it", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setAspect("16/9");
    useShaderPresetDraftStore.getState().setFraming("scale", 2);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().load(preset("a"));

    expect(useShaderPresetDraftStore.getState().editedAspects).toEqual(["16/9"]);
    expect(useShaderPresetDraftStore.getState().aspect).toBe("16/9");
  });

  // A save re-adopts what was STORED through this same action. Buffering there
  // would file the pre-save edits and then restore them over the write.
  it("does not buffer a draft against itself when a save re-adopts it", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("a", 0.9));

    const state = useShaderPresetDraftStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.buffers.a).toBeUndefined();
    expect(state.settings.params.twist).toBe(0.9);
  });

  // The never-saved draft is as bufferable as any preset — it just has no id.
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

  // --- What the strip marks and the palette asks -----------------------------

  it("reports nothing unsaved on a freshly loaded preset", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));

    expect(unsavedShaderPresetKeys(useShaderPresetDraftStore.getState())).toEqual([]);
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(false);
  });

  it("counts the draft on screen as well as the ones set aside", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.8);

    expect(unsavedShaderPresetKeys(useShaderPresetDraftStore.getState()).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  // Leaving the editor is still a question, however freely the strip moves —
  // and it has to be asked about EVERY preset holding work, not just the one on
  // screen.
  it("still reports unsaved work left in a preset you are not looking at", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));

    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(true);
  });

  // The discard is a discard: leaving other presets' work behind would be one
  // you had to press more than once.
  it("throws away every buffered edit on a reset", () => {
    useShaderPresetDraftStore.getState().load(preset("a"));
    useShaderPresetDraftStore.getState().setParam("twist", 0.9);
    useShaderPresetDraftStore.getState().load(preset("b"));
    useShaderPresetDraftStore.getState().reset();

    expect(useShaderPresetDraftStore.getState().buffers).toEqual({});
    expect(hasUnsavedShaderPresetWork(useShaderPresetDraftStore.getState())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Undo / redo.
//
// The same snapshot stack the article editor keeps (`src/store/editor.ts`), over
// the authored picture rather than over the document: the shader, its settings,
// and which shapes the rail is marking as reframed. Not `publishedAt` and not
// `savedParams` — those are facts the SERVER owns, and an undo that took a
// preset off show would be undoing something the author never did here.
// ---------------------------------------------------------------------------

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

  // The floor is the state the draft opened in: there is nothing behind it to
  // go back to, and a press that did nothing is better than one that empties
  // the panel.
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

  // A new edit after an undo is a new branch — what was undone is gone, which
  // is what every undo stack does and what stops redo restoring a value the
  // author has since moved away from.
  it("drops the redo stack once a fresh edit lands", () => {
    setAndPush(0.25);
    setAndPush(0.5);
    useShaderPresetDraftStore.getState().undo();
    setAndPush(0.75);

    useShaderPresetDraftStore.getState().redo();
    expect(paramNow()).toBe(0.75);
  });

  // A push that records nothing is a press wasted: a slider settling back where
  // it started, or the debounce firing twice on one edit.
  it("ignores a push that changes nothing", () => {
    setAndPush(0.25);
    const depth = useShaderPresetDraftStore.getState().history.length;
    useShaderPresetDraftStore.getState().pushHistory();
    expect(useShaderPresetDraftStore.getState().history).toHaveLength(depth);
  });

  // Opening another preset is not an edit to this one. Undo crossing that line
  // would pull a DIFFERENT preset's colours into the one on screen.
  it("starts a new history when another preset is opened", () => {
    setAndPush(0.25);
    useShaderPresetDraftStore.getState().load({
      id: "preset-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: null,
    });

    const state = useShaderPresetDraftStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.historyIndex).toBe(0);

    state.undo();
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("swirl");
  });

  // Undo is an edit like any other as far as the exit question is concerned:
  // stepping back to where you started still leaves a draft that differs from
  // the row behind it until it is saved.
  it("leaves the draft dirty", () => {
    setAndPush(0.25);
    useShaderPresetDraftStore.getState().undo();
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
  });
});
