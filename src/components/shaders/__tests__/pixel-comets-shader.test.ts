import { describe, expect, it } from "vitest";
import { pixelCometsFragmentShader } from "../pixel-comets-shader";
import {
  DEFAULT_PIXEL_COMETS,
  PIXEL_COMETS_MAX_COLORS,
  PIXEL_COMETS_DIRECTIONS,
  PIXEL_COMETS_MAX_GLOW_REACH,
  toPixelCometsUniforms,
} from "../pixel-comets-uniforms";
import { SHADER_SPECS } from "@/data/shader-specs";

describe("pixelCometsFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(pixelCometsFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(pixelCometsFragmentShader).toContain("void main()");
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
    // The optional group is a precision qualifier (see u_resolution); without it those are skipped.
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

  it("decides which cells are lit at the cell, not on the blended coordinate", () => {
    expect(pixelCometsFragmentShader).toContain("step(-.5, behindStep)");
    expect(pixelCometsFragmentShader).toContain("step(-.5, toStep)");
    expect(/step\(-\.5, behind\)/.test(pixelCometsFragmentShader)).toBe(false);
    expect(/step\(at, /.test(pixelCometsFragmentShader)).toBe(false);
  });

  it("swerves a comet that catches the other one in its lane", () => {
    expect(pixelCometsFragmentShader).toContain("vec3 otherComet(");
    expect(pixelCometsFragmentShader).toContain(
      "float pen = other.y * (other.x - posA);",
    );
    expect(pixelCometsFragmentShader).toContain("pen <= .5 * g_tailCells");
  });

  it("bends the trail at the cell the head switched on", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float shiftStep = toStep >= switchAt ? sideStep : 0.;",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float onLaneStep = abs(laneOffset + shiftStep) < .5 ? 1. : 0.;",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float shiftHead = headAt >= switchAt ? sideStep : 0.;",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float shiftNear = toNear >= switchAt ? sideStep : 0.;",
    );
  });

  it("does not look for traffic when nothing may swerve", () => {
    expect(pixelCometsFragmentShader).toContain("if (u_swerve > 0.)");
    expect(pixelCometsFragmentShader).toContain(
      "int swerveLanes = u_swerve > 0. ? 1 : 0;",
    );
  });

  it("leaves the trail's two ends equally opaque at no falloff", () => {
    expect(pixelCometsFragmentShader).toContain("#define COMET_DECAY_NONE 1.");
    expect(pixelCometsFragmentShader).toContain(
      "return pow(g_decay, d) * step(d, g_tailCells);",
    );
    expect(pixelCometsFragmentShader).not.toContain("g_tailEnd");
  });

  it("smears the head's glow backwards, and only backwards", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float ahead = dir * (alongFree - headCell);",
    );
    expect(pixelCometsFragmentShader).toContain(
      "float alongToHead = ahead - clamp(ahead, -u_headStretch, 0.);",
    );
    expect(pixelCometsFragmentShader).toContain("length(vec2(perpHead, alongToHead))");
    expect(
      /length\(vec2\(perp, alongFree - headCell\)\)/.test(pixelCometsFragmentShader),
    ).toBe(false);
    expect(/vec2\(perp \//.test(pixelCometsFragmentShader)).toBe(false);
  });

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
    expect(/max\(u_headRadius, 1e-4\)/.test(pixelCometsFragmentShader)).toBe(false);
  });

  it("takes the smear from the control alone, not from how fast the comet is", () => {
    const bloom = pixelCometsFragmentShader.slice(
      pixelCometsFragmentShader.indexOf("float headCell"),
      pixelCometsFragmentShader.indexOf("float lit0"),
    );
    expect(bloom).toContain("clamp(ahead, -u_headStretch, 0.)");
    expect(bloom).not.toContain("speedFactor");
    expect(bloom).not.toContain("lifeCells");
  });

  it("sizes the trail's bloom by the fade, so a smooth trail reads as a comet", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float taper = mix(1., fadeNear, u_tailBlend);",
    );
    expect(pixelCometsFragmentShader).toContain("max(u_tailRadius * taper, 1e-4)");
    expect(/max\(u_tailRadius, 1e-4\)/.test(pixelCometsFragmentShader)).toBe(false);
  });

  it("marches a comet back at the centre from whichever side it was born on", () => {
    expect(pixelCometsFragmentShader).toContain("float side = birthSide(heading, h.y);");
    expect(pixelCometsFragmentShader).toContain("float dir = -side;");
    expect(/dir = h\.y/.test(pixelCometsFragmentShader)).toBe(false);
  });

  it("spreads the depth over the run, leaving the cycle alone", () => {
    expect(pixelCometsFragmentShader).toContain("float runCells = timing.x * depth;");

    const opens = pixelCometsFragmentShader.indexOf("vec2 timingFor");
    const timingFor = pixelCometsFragmentShader.slice(
      opens,
      pixelCometsFragmentShader.indexOf("\n}", opens) + 2,
    );
    expect(timingFor).not.toBe("");
    expect(timingFor).not.toContain("u_parallax");
  });

  it("only ever brings a comet nearer than the run Travel names", () => {
    expect(pixelCometsFragmentShader).toContain(
      "float depth = 1. + u_parallax * PARALLAX_REACH *",
    );
  });

  it("corrects the odds by the band the comets are spawned into", () => {
    expect(pixelCometsFragmentShader).toContain("max(u_originMax, 1.)");
    expect(pixelCometsFragmentShader).not.toContain("COMET_SPAWN_SPREAD");
  });

  it("walks as many lanes as the glow controls are allowed to reach", () => {
    expect(pixelCometsFragmentShader).toContain(
      `#define COMET_MAX_GLOW_LANES ${PIXEL_COMETS_MAX_GLOW_REACH}`,
    );
  });

  it("shares Count over the lanes the direction actually leaves running", () => {
    expect(pixelCometsFragmentShader).toContain("dot(u_axes, frame)");
  });

  it("skips the axis it turns off rather than drawing it invisibly", () => {
    expect(pixelCometsFragmentShader).toContain("if (u_axes.x > 0.)");
    expect(pixelCometsFragmentShader).toContain("if (u_axes.y > 0.)");
  });

  it("forces the side a comet is born on only where a heading is named", () => {
    expect(pixelCometsFragmentShader).toContain("float birthSide(float heading, float toss)");
    expect(pixelCometsFragmentShader).toContain(
      "return abs(heading) > .5 ? -heading : (toss < .5 ? -1. : 1.);",
    );
    expect(pixelCometsFragmentShader.split("h.y < .5 ? -1. : 1.")).toHaveLength(1);
  });

  it("gives the other comet in the lane the same heading", () => {
    const call = pixelCometsFragmentShader.match(/vec3 otherComet\(([^)]*)\)/);
    expect(call?.[1]).toContain("heading");
    expect(pixelCometsFragmentShader).toContain("birthSide(heading, h.y)");
  });
});

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

  it("lets Travel carry a comet from the furthest origin out the far side", () => {
    const max = (key: string) => {
      const control = spec.controls.find((entry) => entry.key === key);
      expect(control?.kind, key).toBe("slider");
      return control?.kind === "slider" ? control.max : 0;
    };

    expect(max("travelSpans")).toBeGreaterThanOrEqual(max("originMax") + 1);
  });

  it("offers exactly the directions the conversion knows, and opens on all of them", () => {
    const control = spec.controls.find((entry) => entry.key === "direction");

    expect(control?.kind).toBe("toggles");
    if (control?.kind !== "toggles") return;
    expect(control.options.map((option) => option.value)).toEqual([
      ...PIXEL_COMETS_DIRECTIONS,
    ]);
    expect(control.value).toEqual([...PIXEL_COMETS_DIRECTIONS]);
  });

  it("names an extra colour for the lattice, which the shader takes", () => {
    expect(spec.extraColors.map((extra) => extra.key)).toContain("colorGrid");
    expect(pixelCometsFragmentShader).toContain("uniform vec4 u_colorGrid;");
  });
});
