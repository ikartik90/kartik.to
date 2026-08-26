import { beforeEach, describe, expect, it } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { DEFAULT_COVER_ASPECT } from "@/domain/cover";
import { useCoverDraftStore } from "../cover-draft";

/** A saved cover's settings — the shader's own state plus the frame it was designed in. */
const savedSettings = (spec: (typeof SHADER_SPECS)[keyof typeof SHADER_SPECS]) => ({
  ...defaultState(spec),
  aspect: DEFAULT_COVER_ASPECT,
});

describe("useCoverDraftStore", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());

  it("opens on the first shader's defaults, with nothing saved behind it", () => {
    const state = useCoverDraftStore.getState();
    expect(state.coverId).toBeNull();
    expect(state.shaderId).toBe("cosmicTrack");
    expect(state.isDirty).toBe(false);
  });

  // Switching shader re-seeds: a different shader has a different control
  // table, so carrying the old params over would be carrying keys it has never
  // heard of.
  it("re-seeds from the new shader's defaults on a switch", () => {
    useCoverDraftStore.getState().selectShader("godRays");
    const state = useCoverDraftStore.getState();

    expect(state.shaderId).toBe("godRays");
    expect(state.settings.params).toEqual(
      defaultState(SHADER_SPECS.godRays).params,
    );
  });

  it("marks the draft dirty once a param moves", () => {
    useCoverDraftStore.getState().setParam("scale", 2);

    expect(useCoverDraftStore.getState().isDirty).toBe(true);
    expect(useCoverDraftStore.getState().settings.params.scale).toBe(2);
  });

  // What "Save changes and exit" writes, and what a saved cover reopens into.
  it("loads a saved cover and opens clean, not dirty", () => {
    useCoverDraftStore.getState().setParam("scale", 2);
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
    });

    const state = useCoverDraftStore.getState();
    expect(state.coverId).toBe("cover-1");
    expect(state.title).toBe("Dusk");
    expect(state.shaderId).toBe("swirl");
    // A cover just opened has no unsaved work in it, so the palette must not
    // offer to discard changes that do not exist.
    expect(state.isDirty).toBe(false);
  });

  it("reset returns a loaded cover to a blank draft", () => {
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
    });
    useCoverDraftStore.getState().reset();

    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(useCoverDraftStore.getState().shaderId).toBe("cosmicTrack");
  });

  // The store hands the action layer exactly what the schema validates, so the
  // two cannot drift into disagreeing about the stored shape.
  it("hands back content in the shape the domain schema takes", () => {
    useCoverDraftStore.getState().selectShader("warp");
    const content = useCoverDraftStore.getState().toContent();

    expect(content.shaderId).toBe("warp");
    expect(content.settings).toEqual(savedSettings(SHADER_SPECS.warp));
  });

  // The frame is a fact about the COVER, not about the shader in it — so it
  // survives the one edit that throws everything else away.
  it("keeps the designed-for shape across a shader switch", () => {
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().selectShader("godRays");

    expect(useCoverDraftStore.getState().settings.aspect).toBe("16/9");
  });

  it("marks the draft dirty once the shape moves", () => {
    useCoverDraftStore.getState().setAspect("1/1");

    expect(useCoverDraftStore.getState().isDirty).toBe(true);
    expect(useCoverDraftStore.getState().settings.aspect).toBe("1/1");
  });

  // "Reset params" is about the shader's uniforms. The frame you chose to
  // design in is not one of them.
  it("leaves the shape alone when the params are reset", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.aspect).toBe("4/3");
  });

  // "Reset params" on a saved preset means BACK TO THE PRESET, not back to the
  // shader's factory defaults: once a cover has been written, the thing you
  // want to undo an experiment against is your own last save.
  it("resets a loaded preset's params to what was saved, not to the defaults", () => {
    const saved = {
      ...savedSettings(SHADER_SPECS.swirl),
      params: { ...defaultState(SHADER_SPECS.swirl).params, twist: 0.9 },
    };
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: saved,
    });
    useCoverDraftStore.getState().setParam("twist", 0.1);
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.params).toEqual(saved.params);
  });

  // Every save re-baselines, because a save is what "last saved" MEANS — and
  // the save path adopts what was stored through `load`, so this is the seam.
  it("follows the latest save rather than the one the draft opened on", () => {
    const spec = SHADER_SPECS.swirl;
    const open = { ...savedSettings(spec), params: { ...defaultState(spec).params, twist: 0.9 } };
    useCoverDraftStore.getState().load({ id: "cover-1", title: "Dusk", shaderId: "swirl", settings: open });

    const committed = { ...open, params: { ...open.params, twist: 0.2 } };
    useCoverDraftStore.getState().load({ id: "cover-1", title: "Dusk", shaderId: "swirl", settings: committed });
    useCoverDraftStore.getState().setParam("twist", 0.7);
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.params.twist).toBe(0.2);
  });

  // Nothing has been saved to go back to, so the defaults are the only baseline
  // there is.
  it("resets an unsaved draft to the shader's defaults", () => {
    useCoverDraftStore.getState().setParam("rampLength", 4);
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.cosmicTrack).params,
    );
  });

  // A saved cover's params belong to the shader it was saved on. Restoring them
  // over a different shader's control table would write keys it has never heard
  // of, so the baseline only applies where it fits.
  it("resets to the defaults after switching off the saved cover's shader", () => {
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: { ...savedSettings(SHADER_SPECS.swirl), params: { ...defaultState(SHADER_SPECS.swirl).params, twist: 0.9 } },
    });
    useCoverDraftStore.getState().selectShader("godRays");
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.godRays).params,
    );
  });

  it("opens a new draft on the default shape", () => {
    expect(useCoverDraftStore.getState().settings.aspect).toBe(
      DEFAULT_COVER_ASPECT,
    );
  });
});
