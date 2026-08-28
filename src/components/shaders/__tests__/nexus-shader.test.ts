import { describe, expect, it } from "vitest";
import { nexusFragmentShader } from "../nexus-shader";
import {
  DEFAULT_NEXUS,
  NEXUS_MAX_COLORS,
  NEXUS_MAX_GLOW_REACH,
  toNexusUniforms,
} from "../nexus-uniforms";
import { SHADER_SPECS } from "@/data/shader-specs";

// The GLSL cannot run here — jsdom has no WebGL — but the SOURCE is a string,
// and the failure modes worth catching are all visible in it. Every one of them
// is silent at runtime, which is what makes them worth a test. See
// `cosmic-track-shader.test.ts`, which this follows.

describe("nexusFragmentShader", () => {
  it("is a complete program, not a truncated template literal", () => {
    expect(nexusFragmentShader.startsWith("#version 300 es")).toBe(true);
    expect(nexusFragmentShader).toContain("void main()");
    // The final statement of main(), so anything cut short fails here.
    expect(nexusFragmentShader).toContain("fragColor = vec4(color, opacity)");
    expect(nexusFragmentShader.trimEnd().endsWith("}")).toBe(true);
  });

  it("declares every uniform the conversion sends it", () => {
    const uniforms = toNexusUniforms(DEFAULT_NEXUS);

    for (const name of Object.keys(uniforms)) {
      const declaration =
        name === "u_colors"
          ? `uniform vec4 u_colors[${NEXUS_MAX_COLORS}]`
          : new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`);

      if (typeof declaration === "string") {
        expect(nexusFragmentShader, name).toContain(declaration);
      } else {
        expect(declaration.test(nexusFragmentShader), name).toBe(true);
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
      ...nexusFragmentShader.matchAll(
        /uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(u_\w+)/g,
      ),
    ].map((match) => match[1]);

    expect(declared).toContain("u_resolution");
    expect(declared).toContain("u_pixelRatio");

    expect(declared.length).toBeGreaterThan(0);

    for (const name of declared) {
      const uses = nexusFragmentShader.split(name).length - 1;
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
    expect(nexusFragmentShader).toContain("step(-.5, behindStep)");
    expect(nexusFragmentShader).toContain("step(-.5, toStep)");
    // `behind` is the blended reading — a gate on it is the bug.
    expect(/step\(-\.5, behind\)/.test(nexusFragmentShader)).toBe(false);
    expect(/step\(at, /.test(nexusFragmentShader)).toBe(false);
  });

  // THE COMET, and the reason it needs guarding is that the taper is invisible
  // in the code the moment you stop looking for it: dividing by the raw control
  // reads as the obvious simplification, compiles, and renders a glowing BAR
  // with a rounded end — a shape, not an error, so nothing complains.
  it("sizes the trail's bloom by the fade, so a smooth trail reads as a comet", () => {
    expect(nexusFragmentShader).toContain(
      "float taper = mix(1., fadeNear, u_tailBlend);",
    );
    expect(nexusFragmentShader).toContain("max(u_tailRadius * taper, 1e-4)");
    // The raw radius is the even-width capsule back again.
    expect(/max\(u_tailRadius, 1e-4\)/.test(nexusFragmentShader)).toBe(false);
  });

  // Asserted rather than imported: a `#define` is a string to TypeScript, so
  // nothing but this test stands between the shader's neighbourhood radius and
  // the ceiling the control is clamped against. Let them drift and the symptom
  // is a bloom clipped SQUARE at the lane boundary — which reads as a rendering
  // bug rather than as a setting that has run out of room.
  it("walks as many lanes as the glow controls are allowed to reach", () => {
    expect(nexusFragmentShader).toContain(
      `#define NEXUS_MAX_GLOW_LANES ${NEXUS_MAX_GLOW_REACH}`,
    );
  });
});

// The spec table and the shader are two hand-kept copies of the same three
// numbers — the table cannot import from a component, and the shader cannot
// import from the table. This is what keeps them honest.
describe("the Nexus spec table against the shader", () => {
  const spec = SHADER_SPECS.nexus;

  it("offers exactly the colour slots the uniform array holds", () => {
    expect(spec.maxColors).toBe(NEXUS_MAX_COLORS);
  });

  it("stops both glow radii at the shader's reach", () => {
    const radii = spec.controls.filter(
      (control) => control.key === "headRadius" || control.key === "tailRadius",
    );
    expect(radii).toHaveLength(2);

    for (const control of radii) {
      expect(control.kind, control.key).toBe("slider");
      if (control.kind !== "slider") continue;
      expect(control.max, control.key).toBe(NEXUS_MAX_GLOW_REACH);
    }
  });

  it("names an extra colour for the lattice, which the shader takes", () => {
    expect(spec.extraColors.map((extra) => extra.key)).toContain("colorGrid");
    expect(nexusFragmentShader).toContain("uniform vec4 u_colorGrid;");
  });
});
