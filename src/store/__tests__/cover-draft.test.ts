import { beforeEach, describe, expect, it } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { useCoverDraftStore } from "../cover-draft";

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
      settings: defaultState(SHADER_SPECS.swirl),
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
      settings: defaultState(SHADER_SPECS.swirl),
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
    expect(content.settings).toEqual(defaultState(SHADER_SPECS.warp));
  });
});
