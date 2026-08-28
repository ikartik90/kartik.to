import { describe, expect, it } from "vitest";
import { pixelCometsFragmentShader } from "../pixel-comets-shader";
import {
  DEFAULT_PIXEL_COMETS,
  PIXEL_COMETS_MAX_COLORS,
  PIXEL_COMETS_MAX_GLOW_REACH,
  toPixelCometsUniforms,
} from "../pixel-comets-uniforms";
import { SHADER_SPECS } from "@/data/shader-specs";

// The GLSL cannot run here — jsdom has no WebGL — but the SOURCE is a string,
// and the failure modes worth catching are all visible in it. Every one of them
// is silent at runtime, which is what makes them worth a test. See
// `cosmic-track-shader.test.ts`, which this follows.

describe("pixelCometsFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(pixelCometsFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(pixelCometsFragmentShader).toContain("void main()");
    // The final statement of main(), so anything cut short fails here.
    expect(pixelCometsFragmentShader).toContain("fragColor = vec4(color, opacity)");
    expect(pixelCometsFragmentShader.trimEnd().endsWith("}")).toBe(true);
  });

  it("declares every uniform the conversion sends it", () => {
    const uniforms = toPixelCometsUniforms(DEFAULT_PIXEL_COMETS);

    for (const name of Object.keys(uniforms)) {
      const declaration =
        name === "u_colors"
          ? `uniform vec4 u_colors[${PIXEL_COMETS_MAX_COLORS}]`
          : new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`);

      if (typeof declaration === "string") {
        expect(pixelCometsFragmentShader, name).toContain(declaration);
      } else {
        expect(declaration.test(pixelCometsFragmentShader), name).toBe(true);
      }
    }
  });

  it("actually READS every uniform it declares", () => {
    // A uniform declared but never used is stripped by the compiler and its
    // control goes dead — the same symptom as a missing declaration.
    // The optional group is the precision qualifier two of these carry — see
    // `u_resolution` in the shader. Without it they are skipped rather than
    // checked, which is the quiet way for this test to stop covering them.
    const declared = [
      ...pixelCometsFragmentShader.matchAll(
        /uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(u_\w+)/g,
      ),
    ].map((match) => match[1]);

    expect(declared).toContain("u_resolution");
    expect(declared).toContain("u_pixelRatio");

    expect(declared.length).toBeGreaterThan(0);

    for (const name of declared) {
      const uses = pixelCometsFragmentShader.split(name).length - 1;
      expect(uses, `${name} is declared but never read`).toBeGreaterThan(1);
    }
  });

  // The bug this locks out is geometric, so it can only be SEEN in a rendered
  // frame — which this repo cannot produce in jsdom. What it can check is the
  // shape of the mistake, and that is worth doing, because the mistake is one
  // line and it reads as correct:
  //
  //   float at = mix(toStep, toFree, u_tailBlend);   // moves with the slider
  //   fade = ... * step(-.5, behind)                 // ...so this end moves too
  //
  // Gating on the blended coordinate puts the trail's ends wherever the head
  // and the mover's fractional spawn point fall — never a cell boundary — so at
  // blend 1 the band stops half-way across a square and slides inside it as the
  // head advances. Which cells are LIT must be read at the cell; only the fade's
  // VALUE may follow the slider.
  it("decides which cells are lit at the cell, not on the blended coordinate", () => {
    expect(pixelCometsFragmentShader).toContain("step(-.5, behindStep)");
    expect(pixelCometsFragmentShader).toContain("step(-.5, toStep)");
    // `behind` is the blended reading — a gate on it is the bug.
    expect(/step\(-\.5, behind\)/.test(pixelCometsFragmentShader)).toBe(false);
    expect(/step\(at, /.test(pixelCometsFragmentShader)).toBe(false);
  });

  // THE SWERVE. A comet that catches the tail of the other comet in its lane
  // steps one lane sideways and finishes its run there.
  //
  // Its OWN lane's other slot is the only comet it can catch, and that is what
  // makes the check affordable rather than a search: they share an axis and a
  // lane, and a lane carries at most COMET_SLOTS. Anything crossing
  // perpendicular belongs to somebody else's lane, and nothing bounds which
  // one, so a fragment would have to sweep every lane along the run to find it.
  //
  // Tested against the other comet's BASE path — where it would be had it not
  // swerved itself. Reading its real path is circular: two slots in a lane each
  // asking the other what it did.
  it("swerves a comet that catches the other one in its lane", () => {
    expect(pixelCometsFragmentShader).toContain("vec3 otherComet(");
    // How far into the other's tail this comet's head has got, in cells, and
    // the half that fires it.
    expect(pixelCometsFragmentShader).toContain(
      "float pen = other.y * (other.x - posA);",
    );
    expect(pixelCometsFragmentShader).toContain("pen <= .5 * g_tailCells");
  });

  // The trail keeps the lane it was LAID in. The switch is a step in the trail
  // at the cell the head switched on, not the whole trail moving across — so
  // the lane a stretch of ink sits in is read at that stretch's own distance
  // along the run, never at the head's.
  it("bends the trail at the cell the head switched on", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float shiftStep = toStep >= switchAt ? sideStep : 0.;",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float onLaneStep = abs(laneOffset + shiftStep) < .5 ? 1. : 0.;",
    );
    // The head's own bloom reads the shift at the HEAD, and the trail's at the
    // nearest lit point — both distinct from the fragment's own stretch.
    expect(pixelCometsFragmentShader).toContain(
      "float shiftHead = headAt >= switchAt ? sideStep : 0.;",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float shiftNear = toNear >= switchAt ? sideStep : 0.;",
    );
  });

  // Free when off, not merely invisible — the same bargain the glow radii
  // strike with their strengths. The sampling below is the most expensive thing
  // in the shader, and a field with no swerving must not pay for it.
  it("does not look for traffic when nothing may swerve", () => {
    expect(pixelCometsFragmentShader).toContain("if (u_swerve > 0.)");
    // And the walk only widens by the lane a swerve can reach.
    expect(pixelCometsFragmentShader).toContain(
      "int swerveLanes = u_swerve > 0. ? 1 : 0;",
    );
  });

  // Falloff 0 is NO falloff: a trail whose last cell is as opaque as its first.
  //
  // It could not be while the curve was normalised. The subtraction that made
  // it land on zero at exactly Tail cells was also what guaranteed a fade, so
  // the flattest the control could reach was a straight ramp to nothing — and
  // the soft end of the decay had to sit at .995 rather than 1 to keep that
  // ratio off 0/0.
  //
  // The LENGTH is held by the gate now instead of by the curve, which is what
  // frees the curve to be flat. Nothing else wanted the normalisation: at any
  // real falloff the geometric curve is already at a fraction of a percent by
  // the time it reaches the gate.
  it("leaves the trail's two ends equally opaque at no falloff", () => {
    expect(pixelCometsFragmentShader).toContain("#define COMET_DECAY_NONE 1.");
    expect(pixelCometsFragmentShader).toContain(
      "return pow(g_decay, d) * step(d, g_tailCells);",
    );
    // The normalisation it replaced, which divided the fade out to zero at the
    // tail's end whatever the decay.
    expect(pixelCometsFragmentShader).not.toContain("g_tailEnd");
  });

  // The head's bloom is MOTION BLUR on a radial glow: the circle smeared along
  // the track it has just come down, all of it behind. A capsule, so the
  // distance is taken to the nearest point of the smear — which is what keeps
  // the glow round at both ends and full width along the whole of it, and is
  // how the trail's own bloom is built.
  //
  // The clamp is the load-bearing character in the whole thing. Its window is
  // [-smear, 0] in the head's own frame: an upper bound of anything but zero
  // puts blur in FRONT of the comet, which is the one direction inertia cannot
  // throw it, and a symmetric window is the ellipse this replaced.
  it("smears the head's glow backwards, and only backwards", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float ahead = dir * (alongFree - headCell);",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float alongToHead = ahead - clamp(ahead, -u_headStretch, 0.);",
    );
    // `perpHead`, not `perp`: a comet that has swerved is one lane off the lane
    // being walked, and its bloom is centred on the lane its HEAD is in.
    expect(pixelCometsFragmentShader).toContain("length(vec2(perpHead, alongToHead))");
    // The isotropic reading it started as: one radius in every direction.
    expect(
      /length\(vec2\(perp, alongFree - headCell\)\)/.test(pixelCometsFragmentShader),
    ).toBe(false);
    // The across-lane half must stay undivided, or the reach outruns the walk.
    expect(/vec2\(perp \//.test(pixelCometsFragmentShader)).toBe(false);
  });

  // The smear FADES along its length, which a true exposure would not — a
  // uniform pass over the same ground is uniformly bright, and that capsule
  // read as a bar with a cap on it.
  //
  // The fade takes the RADIUS with it, and that is the whole difference between
  // a comet and a bar: dimming does not narrow, so a held width stays even
  // until the light drops under the eye's floor and then stops. It is the fault
  // the trail's own bloom was caught with, guarded there by the taper test
  // above and here by this one.
  it("fades the smear out behind the head, narrowing it as it goes", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float fadeBack = 1. - back / max(u_headStretch, 1e-4);",
    );
    expect(pixelCometsFragmentShader).toContain(
      "max(u_headRadius * fadeBack, 1e-4)",
    );
    expect(pixelCometsFragmentShader).toContain(
      "u_headGlow * alive * fadeBack * pow(max(1. - toHead, 0.), 2.)",
    );
    // The bare radius is the even-width capsule back again.
    expect(/max\(u_headRadius, 1e-4\)/.test(pixelCometsFragmentShader)).toBe(false);
  });

  // The smear is the CONTROL's, whole. Scaling it by the comet's speed is the
  // honest reading of an exposure and it was written that way first; what it
  // costs is a streak length nothing on the panel names, drifting with Parallax
  // and Travel, so the one thing you cannot do is set the look you want and
  // keep it.
  it("takes the smear from the control alone, not from how fast the comet is", () => {
    const bloom = pixelCometsFragmentShader.slice(
      pixelCometsFragmentShader.indexOf("float headCell"),
      pixelCometsFragmentShader.indexOf("float lit0"),
    );
    expect(bloom).toContain("clamp(ahead, -u_headStretch, 0.)");
    expect(bloom).not.toContain("speedFactor");
    expect(bloom).not.toContain("lifeCells");
  });

  // THE COMET, and the reason it needs guarding is that the taper is invisible
  // in the code the moment you stop looking for it: dividing by the raw control
  // reads as the obvious simplification, compiles, and renders a glowing BAR
  // with a rounded end — a shape, not an error, so nothing complains.
  it("sizes the trail's bloom by the fade, so a smooth trail reads as a comet", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float taper = mix(1., fadeNear, u_tailBlend);",
    );
    expect(pixelCometsFragmentShader).toContain("max(u_tailRadius * taper, 1e-4)");
    // The raw radius is the even-width capsule back again.
    expect(/max\(u_tailRadius, 1e-4\)/.test(pixelCometsFragmentShader)).toBe(false);
  });

  // A comet is born at a distance from the CENTRE and marches back at it, so
  // the side it spawned on IS the direction it came from. The two were
  // independent coin tosses before — a comet went whichever way it fancied from
  // wherever it landed — and half of them therefore ran off the card and were
  // never seen. Binding one to the other is the whole of "march in towards the
  // centre"; leave them apart and the field converges only by accident.
  it("marches a comet back at the centre from whichever side it was born on", () => {
    expect(pixelCometsFragmentShader).toContain("float side = h.y < .5 ? -1. : 1.;");
    expect(pixelCometsFragmentShader).toContain("float dir = -side;");
    // The old free coin toss. A direction drawn from the hash again is a comet
    // that may run outward, which is the thing this replaced.
    expect(/dir = h\.y/.test(pixelCometsFragmentShader)).toBe(false);
  });

  // PARALLAX, and the load-bearing half of it is what it must NOT touch.
  //
  // A comet's depth is drawn from the hash of the cycle it is born in, which is
  // only sound while the cycle itself is free of parallax: vary the RATE and the
  // hash lives inside the cycle it would be choosing, so the boundary moves
  // under the draw that moved it. Scaling the RUN instead leaves every comet
  // born and buried on the same clock, and a longer run over the same clock is
  // exactly a faster comet.
  it("spreads the depth over the run, leaving the cycle alone", () => {
    expect(pixelCometsFragmentShader).toContain("float runCells = timing.x * depth;");

    const opens = pixelCometsFragmentShader.indexOf("vec2 timingFor");
    // The function's OWN body, closed at its own brace. Slicing to the next
    // declaration instead swept up whatever came to sit between them.
    const timingFor = pixelCometsFragmentShader.slice(
      opens,
      pixelCometsFragmentShader.indexOf("\n}", opens) + 2,
    );
    expect(timingFor).not.toBe("");
    expect(timingFor).not.toContain("u_parallax");
  });

  // Never below 1. Travel names the far plane and parallax brings comets nearer
  // — push it the other way and the slowest are stranded inside the frame at the
  // top of a slider whose whole promise is that they leave.
  it("only ever brings a comet nearer than the run Travel names", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float depth = 1. + u_parallax * PARALLAX_REACH *",
    );
  });

  // How far out a comet may be born is a BAND, and the odds have to answer to
  // it: a comet spawned two half-frames out spends half its run off the card,
  // so leaving the correction at a constant would make Count mean a different
  // number of visible comets at every setting of the band.
  it("corrects the odds by the band the comets are spawned into", () => {
    expect(pixelCometsFragmentShader).toContain("max(u_originMax, 1.)");
    // The constant it replaced. It described one fixed spawn box, which is not
    // what the control offers any more.
    expect(pixelCometsFragmentShader).not.toContain("COMET_SPAWN_SPREAD");
  });

  // Asserted rather than imported: a `#define` is a string to TypeScript, so
  // nothing but this test stands between the shader's neighbourhood radius and
  // the ceiling the control is clamped against. Let them drift and the symptom
  // is a bloom clipped SQUARE at the lane boundary — which reads as a rendering
  // bug rather than as a setting that has run out of room.
  it("walks as many lanes as the glow controls are allowed to reach", () => {
    expect(pixelCometsFragmentShader).toContain(
      `#define COMET_MAX_GLOW_LANES ${PIXEL_COMETS_MAX_GLOW_REACH}`,
    );
  });
});

// The spec table and the shader are two hand-kept copies of the same three
// numbers — the table cannot import from a component, and the shader cannot
// import from the table. This is what keeps them honest.
describe("the Pixel Comets spec table against the shader", () => {
  const spec = SHADER_SPECS.pixelComets;

  it("offers exactly the colour slots the uniform array holds", () => {
    expect(spec.maxColors).toBe(PIXEL_COMETS_MAX_COLORS);
  });

  it("stops both glow radii at the shader's reach", () => {
    const radii = spec.controls.filter(
      (control) => control.key === "headRadius" || control.key === "tailRadius",
    );
    expect(radii).toHaveLength(2);

    for (const control of radii) {
      expect(control.kind, control.key).toBe("slider");
      if (control.kind !== "slider") continue;
      expect(control.max, control.key).toBe(PIXEL_COMETS_MAX_GLOW_REACH);
    }
  });

  // The one invariant that makes the top of the Travel slider mean something.
  //
  // Both controls are measured in HALF-FRAMES — 1 is the centre to the frame's
  // edge — which is the only unit in which this can be checked at all: in cells
  // the answer depends on Pixel Size and the card's size, so a Travel that
  // crossed the frame at one setting stranded a comet mid-air at another.
  //
  // A comet born at the furthest origin has that distance to cover before it
  // even reaches the frame, and then the frame's own half to cross. Travel's
  // ceiling has to cover both or the top of the slider is a comet that stops
  // where you can see it stop.
  it("lets Travel carry a comet from the furthest origin out the far side", () => {
    const max = (key: string) => {
      const control = spec.controls.find((entry) => entry.key === key);
      expect(control?.kind, key).toBe("slider");
      return control?.kind === "slider" ? control.max : 0;
    };

    expect(max("travelSpans")).toBeGreaterThanOrEqual(max("originMax") + 1);
  });

  it("names an extra colour for the lattice, which the shader takes", () => {
    expect(spec.extraColors.map((extra) => extra.key)).toContain("colorGrid");
    expect(pixelCometsFragmentShader).toContain("uniform vec4 u_colorGrid;");
  });
});
