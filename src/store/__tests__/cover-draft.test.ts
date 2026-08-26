import { beforeEach, describe, expect, it } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  DEFAULT_COVER_ASPECT,
  FRAMING_DEFAULTS,
  coverContentFor,
  framingFor,
} from "@/domain/cover";
import {
  NEW_COVER_KEY,
  hasUnsavedCoverWork,
  unsavedCoverKeys,
  useCoverDraftStore,
} from "../cover-draft";

/**
 * A saved cover's settings — the shader's own state, the frame it is judged in,
 * and the placements it has been given in each.
 *
 * Through `coverContentFor` rather than `defaultState`, because a cover does
 * not keep the four placement controls in `params`: `spec.controls` lists them
 * (it is the complete list of what a shader takes) and the schema is what moves
 * them out. See `@/domain/cover`.
 */
const savedSettings = (spec: (typeof SHADER_SPECS)[keyof typeof SHADER_SPECS]) => ({
  ...coverContentFor(spec.id).settings,
  aspect: DEFAULT_COVER_ASPECT,
  framing: {},
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
      coverContentFor("godRays").settings.params,
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
      publishedAt: null,
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
      publishedAt: null,
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
      publishedAt: null,
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
    useCoverDraftStore
      .getState()
      .load({ id: "cover-1", title: "Dusk", shaderId: "swirl", settings: open, publishedAt: null });

    const committed = { ...open, params: { ...open.params, twist: 0.2 } };
    useCoverDraftStore
      .getState()
      .load({ id: "cover-1", title: "Dusk", shaderId: "swirl", settings: committed, publishedAt: null });
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
      publishedAt: null,
    });
    useCoverDraftStore.getState().selectShader("godRays");
    useCoverDraftStore.getState().resetParams();

    expect(useCoverDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.godRays).params,
    );
  });

  // --- Framing, per shape ---------------------------------------------------
  //
  // The four placement controls are kept one set per aspect ratio, so that a
  // cover can be framed one way as a poster and another as a banner. The store
  // is where "which set am I writing to" is decided; the rules for what a shape
  // inherits live in `@/domain/cover`.
  const framing = () => framingFor(useCoverDraftStore.getState().settings);

  it("writes a placement onto the shape on screen and no other", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);

    const { settings } = useCoverDraftStore.getState();
    expect(settings.framing["4/3"]?.scale).toBe(2);
    expect(settings.framing["16/9"]).toBeUndefined();
  });

  it("keeps a placement out of the shader's own params", () => {
    useCoverDraftStore.getState().setFraming("scale", 2);

    expect("scale" in useCoverDraftStore.getState().settings.params).toBe(false);
  });

  // Each shape holds its own, which is the whole feature: go back and the
  // placement you left there is still there.
  it("gives each shape back its own placement", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 3);

    useCoverDraftStore.getState().setAspect("4/3");
    expect(framing().scale).toBe(2);
    useCoverDraftStore.getState().setAspect("16/9");
    expect(framing().scale).toBe(3);
  });

  // Changing shape within one orientation is a different crop of the same
  // composition, so the placement carries straight over.
  it("carries the placement into a shape of the same orientation", () => {
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("rotation", 30);
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("4/3");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  // Turning the frame over is NOT a special case: the other side is a shape you
  // have not framed yet, and it opens on what you arrived with — untouched, so
  // that reframing it is yours to do rather than yours to undo.
  it("carries the placement across an orientation change, unchanged", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("rotation", 30);
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("3/4");

    expect(framing()).toMatchObject({ scale: 2, rotation: 30 });
  });

  // And the other side is then its OWN, which is the whole point of the
  // per-shape split: reframing the portrait must not reach back into the
  // landscape it was seeded from.
  it("lets the two sides of an orientation pair be framed apart", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("rotation", 30);
    useCoverDraftStore.getState().setAspect("3/4");
    useCoverDraftStore.getState().setFraming("rotation", -90);

    expect(framing().rotation).toBe(-90);
    useCoverDraftStore.getState().setAspect("4/3");
    expect(framing().rotation).toBe(30);
  });

  // The shape being left is pinned on the way out, so that what you come back
  // to is what you left rather than a fresh derivation from wherever you have
  // been since.
  it("comes back to the shape it left, not to a derivation of where it went", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    const before = framing();
    useCoverDraftStore.getState().setAspect("3/4");
    useCoverDraftStore.getState().setAspect("4/3");

    expect(framing()).toEqual(before);
  });

  // Seeded ON ARRIVAL, so the answer is fixed the first time you look at a
  // shape. Derived lazily it would keep following whatever you were on last,
  // and going back to a shape after retuning another would silently reframe it.
  it("holds a seeded shape still once it has been visited", () => {
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 4);

    useCoverDraftStore.getState().setAspect("4/3");
    expect(framing().scale).toBe(2);
  });

  // The same four controls on every shader, spread from one array — so unlike
  // the params there is no key here the next shader has never heard of, and
  // wiping them would be throwing away work for a reason that does not apply.
  it("keeps the placements across a shader switch", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().selectShader("godRays");

    expect(framing().scale).toBe(2);
  });

  // Reset acts on the panel, and the placement rows are in it — but on the
  // shape being looked at only. Putting all eleven back would be a button
  // quietly undoing work in ten frames you cannot see.
  it("resets the placement of the shape on screen, and only that one", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 3);
    useCoverDraftStore.getState().resetParams();

    expect(framing()).toEqual(FRAMING_DEFAULTS);
    expect(useCoverDraftStore.getState().settings.framing["4/3"]?.scale).toBe(2);
  });

  // Back to the SAVED placement where there is one, exactly as the params go
  // back to the saved preset rather than to the table.
  it("resets to the saved placement where the preset has one", () => {
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: {
        ...savedSettings(SHADER_SPECS.swirl),
        aspect: "4/3",
        framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 2 } },
      },
      publishedAt: null,
    });
    useCoverDraftStore.getState().setFraming("scale", 3.5);
    useCoverDraftStore.getState().resetParams();

    expect(framing().scale).toBe(2);
  });

  // --- Which shapes have been reframed ---------------------------------------
  //
  // The rail marks a shape whose framing has been touched since the cover was
  // opened, so unsaved work in a frame you are not looking at is not invisible.
  // EDITED, not merely visited: `setAspect` writes framing on the way in and
  // out (see above), so a rule that compared values would mark every shape you
  // clicked through and mean nothing.
  const edited = () => useCoverDraftStore.getState().editedAspects;

  it("opens with no shape marked", () => {
    expect(edited()).toEqual([]);
  });

  it("marks a shape when its framing is moved", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);

    expect(edited()).toEqual(["4/3"]);
  });

  // Browsing the rail is not editing, however much framing it writes.
  it("marks nothing for a shape that was only looked at", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setAspect("9/16");

    expect(edited()).toEqual([]);
  });

  it("marks each edited shape once, however many sliders move", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setFraming("rotation", 15);
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 3);

    expect(edited()).toEqual(["4/3", "16/9"]);
  });

  // Reset puts the shape on screen back to its baseline, so there is nothing
  // left on it to mark — and only that shape, exactly as Reset itself reaches
  // only that shape.
  it("unmarks the shape Reset puts back, and no other", () => {
    useCoverDraftStore.getState().setAspect("4/3");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 3);
    useCoverDraftStore.getState().resetParams();

    expect(edited()).toEqual(["4/3"]);
  });

  // Loading a cover is where "since it was opened" starts again — the same
  // seam that re-baselines the params and clears the dirty flag.
  it("clears the marks when a cover is loaded", () => {
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: null,
    });

    expect(edited()).toEqual([]);
  });

  // --- Publication ----------------------------------------------------------
  //
  // Whether the cover is on show is a fact about the SAVED row, not about the
  // picture, so it travels with the cover the draft is holding and the panel's
  // one button reads it to know which of its two things it is.
  it("opens a draft with nothing published behind it", () => {
    expect(useCoverDraftStore.getState().publishedAt).toBeNull();
  });

  it("adopts a loaded cover's publication date", () => {
    const at = new Date("2026-01-01");
    useCoverDraftStore.getState().load({
      id: "cover-1",
      title: "Dusk",
      shaderId: "swirl",
      settings: savedSettings(SHADER_SPECS.swirl),
      publishedAt: at,
    });

    expect(useCoverDraftStore.getState().publishedAt).toEqual(at);
  });

  // Publishing writes the row, not the picture — so it must not leave the draft
  // claiming unsaved work and putting a "discard?" question in front of an exit
  // that would lose nothing.
  it("records a publish without dirtying the draft", () => {
    const at = new Date("2026-01-01");
    useCoverDraftStore.getState().setPublishedAt(at);

    expect(useCoverDraftStore.getState().publishedAt).toEqual(at);
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
  });

  it("forgets the publication when the draft goes back to blank", () => {
    useCoverDraftStore.getState().setPublishedAt(new Date("2026-01-01"));
    useCoverDraftStore.getState().reset();

    expect(useCoverDraftStore.getState().publishedAt).toBeNull();
  });

  it("opens a new draft on the default shape", () => {
    expect(useCoverDraftStore.getState().settings.aspect).toBe(
      DEFAULT_COVER_ASPECT,
    );
  });

  // --- Moving between presets with work in progress --------------------------
  //
  // Switching preset SETS THE CURRENT DRAFT ASIDE rather than asking whether to
  // throw it away, so a preset can be opened to look at while another is being
  // tuned and the tuning is still there on the way back. The strip marks which
  // covers are holding something.
  const cover = (id: string, twist = 0.5) => ({
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
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("b"));

    expect(useCoverDraftStore.getState().coverId).toBe("b");
    expect(Object.keys(useCoverDraftStore.getState().buffers)).toEqual(["a"]);
  });

  it("gives the work back on the way in, dirty as it was left", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("b"));
    useCoverDraftStore.getState().load(cover("a"));

    const state = useCoverDraftStore.getState();
    expect(state.settings.params.twist).toBe(0.9);
    expect(state.isDirty).toBe(true);
    // Consumed on the way in: the active draft is never also a buffer, or it
    // would count as unsaved twice.
    expect(state.buffers.a).toBeUndefined();
  });

  it("opens a clean preset from the database, not from a stale buffer", () => {
    useCoverDraftStore.getState().load(cover("a", 0.2));
    useCoverDraftStore.getState().load(cover("b"));

    expect(useCoverDraftStore.getState().settings.params.twist).toBe(0.5);
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
  });

  // The marks travel with the draft, or the rail would come back saying
  // something different from what it said when you left.
  it("brings a preset's reframed shapes back with it", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setAspect("16/9");
    useCoverDraftStore.getState().setFraming("scale", 2);
    useCoverDraftStore.getState().load(cover("b"));
    useCoverDraftStore.getState().load(cover("a"));

    expect(useCoverDraftStore.getState().editedAspects).toEqual(["16/9"]);
    expect(useCoverDraftStore.getState().settings.aspect).toBe("16/9");
  });

  // A save re-adopts what was STORED through this same action. Buffering there
  // would file the pre-save edits and then restore them over the write.
  it("does not buffer a draft against itself when a save re-adopts it", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("a", 0.9));

    const state = useCoverDraftStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.buffers.a).toBeUndefined();
    expect(state.settings.params.twist).toBe(0.9);
  });

  // The never-saved draft is as bufferable as any preset — it just has no id.
  it("keeps an unsaved new draft when a preset is opened", () => {
    useCoverDraftStore.getState().setParam("scale", 2);
    useCoverDraftStore.getState().load(cover("a"));

    expect(Object.keys(useCoverDraftStore.getState().buffers)).toEqual([
      NEW_COVER_KEY,
    ]);
  });

  it("gives the new draft back when it is taken up again", () => {
    useCoverDraftStore.getState().setParam("rampLength", 4);
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().openNewDraft();

    const state = useCoverDraftStore.getState();
    expect(state.coverId).toBeNull();
    expect(state.settings.params.rampLength).toBe(4);
    expect(state.isDirty).toBe(true);
  });

  it("opens a blank new draft when nothing was left in it", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().openNewDraft();

    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
  });

  // --- What the strip marks and the palette asks -----------------------------

  it("reports nothing unsaved on a freshly loaded cover", () => {
    useCoverDraftStore.getState().load(cover("a"));

    expect(unsavedCoverKeys(useCoverDraftStore.getState())).toEqual([]);
    expect(hasUnsavedCoverWork(useCoverDraftStore.getState())).toBe(false);
  });

  it("counts the draft on screen as well as the ones set aside", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("b"));
    useCoverDraftStore.getState().setParam("twist", 0.8);

    expect(unsavedCoverKeys(useCoverDraftStore.getState()).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  // Leaving the editor is still a question, however freely the strip moves —
  // and it has to be asked about EVERY cover holding work, not just the one on
  // screen.
  it("still reports unsaved work left in a preset you are not looking at", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("b"));

    expect(useCoverDraftStore.getState().isDirty).toBe(false);
    expect(hasUnsavedCoverWork(useCoverDraftStore.getState())).toBe(true);
  });

  // The discard is a discard: leaving other covers' work behind would be one
  // you had to press more than once.
  it("throws away every buffered edit on a reset", () => {
    useCoverDraftStore.getState().load(cover("a"));
    useCoverDraftStore.getState().setParam("twist", 0.9);
    useCoverDraftStore.getState().load(cover("b"));
    useCoverDraftStore.getState().reset();

    expect(useCoverDraftStore.getState().buffers).toEqual({});
    expect(hasUnsavedCoverWork(useCoverDraftStore.getState())).toBe(false);
  });
});
