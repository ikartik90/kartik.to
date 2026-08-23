"use client";

import { useState, type ComponentProps } from "react";
import {
  ColorPanels,
  GodRays,
  PaperTexture,
  StaticMeshGradient,
  Swirl,
  Warp,
} from "@paper-design/shaders-react";
import { css } from "../../../../styled-system/css";
import { CosmicTrack } from "@/components/shaders/cosmic-track";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { ColorInput } from "@/components/ui/input/color-input";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import {
  SHADER_IDS,
  SHADER_SPECS,
  defaultParams,
  presetParams,
  type Params,
  type ShaderId,
  type ShaderSpec,
} from "./shader-specs";

// ---------------------------------------------------------------------------
// Local-only playground for the card-background shaders — the fanned light
// blades and soft washes in the reference art.
//
// One shader is mounted at a time (plus the optional grain layer), which is
// deliberate: every paper-shaders instance holds its OWN webgl2 context, the
// library pools nothing and registers no `webglcontextlost` handler, so a page
// that rendered all five side by side would be one long session away from
// blank canvases. Compare by switching, not by tiling.
//
// The controls come from the table in `shader-specs.ts` rather than being
// written out here, so a range can only be wrong in one place.
// ---------------------------------------------------------------------------

/** The preview is ~380×680 at 2×; no detail in a soft gradient survives above it. */
const MAX_PIXELS = 1280 * 1280;

const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "5xl",
  padding: "3xl",
  flexWrap: "wrap",
});

const stageStyle = css({
  position: "sticky",
  top: "3xl",
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

// The card the reference art is drawn on: portrait, generously rounded. The
// shader fills it via `fit="cover"` — a ground with margins is just a smaller
// picture.
const cardStyle = css({
  position: "relative",
  isolation: "isolate",
  width: "380px",
  height: "680px",
  borderRadius: "xxl",
  overflow: "hidden",
  backgroundColor: "bg.surface",
});

const layerStyle = css({ position: "absolute", inset: 0 });

const overlayStyle = css({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  color: "#00000055",
});

const panelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  width: "320px",
  paddingBottom: "5xl",
});

const rowStyle = css({ display: "flex", flexWrap: "wrap", gap: "sm" });

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

const headingStyle = css({
  textStyle: "caption",
  color: "text.default/40",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
});

const groupStyle = css({ display: "flex", flexDirection: "column", gap: "lg" });

/**
 * A `Field` holding a SegmentedControl has to be a GRID, not the default column
 * flex: the toolbar sizes itself against its parent, and as a column flex item
 * it collapses to zero height (measured — the control renders, invisibly).
 * `PropertiesPanel.Control` is the proven composition and it lays its fields out
 * exactly this way; this is that rule, minus the panel it is scoped to.
 */
const selectFieldStyle = css({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  columnGap: "md",
  "& > label": { width: "auto" },
});

/**
 * The mounted shader. Each component takes a different prop set, so the params
 * object is spread in wholesale — the control table is what guarantees the keys
 * match the uniforms, and `shader-specs.test.ts` is what guarantees the table
 * does. A component ignores anything it does not recognise.
 */
function ShaderStage({
  spec,
  params,
  colors,
  colorBack,
  extraColors,
}: {
  spec: ShaderSpec;
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
}) {
  const props = {
    ...params,
    ...extraColors,
    ...(spec.hasColorBack ? { colorBack } : {}),
    colors,
    className: layerStyle,
    fit: "cover" as const,
    maxPixelCount: MAX_PIXELS,
  };

  switch (spec.id) {
    case "cosmicTrack":
      return <CosmicTrack {...(props as ComponentProps<typeof CosmicTrack>)} />;
    case "colorPanels":
      return <ColorPanels {...(props as ComponentProps<typeof ColorPanels>)} />;
    case "godRays":
      return <GodRays {...(props as ComponentProps<typeof GodRays>)} />;
    case "warp":
      return <Warp {...(props as ComponentProps<typeof Warp>)} />;
    case "swirl":
      return <Swirl {...(props as ComponentProps<typeof Swirl>)} />;
    case "staticMeshGradient":
      return (
        <StaticMeshGradient
          {...(props as ComponentProps<typeof StaticMeshGradient>)}
        />
      );
  }
}

/**
 * The dashed vector marks the reference art lays over its gradients. NOT a
 * shader — an orbit ellipse and a drifting curve are geometry, so they cost a
 * few DOM nodes rather than a second webgl context. Kept here so the card can
 * be judged as the finished thing rather than as a background alone.
 */
function VectorOverlay() {
  return (
    <svg className={overlayStyle} viewBox="0 0 380 680" fill="none" aria-hidden>
      <ellipse
        cx="190"
        cy="150"
        rx="95"
        ry="52"
        transform="rotate(-24 190 150)"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="103" cy="122" r="4" fill="currentColor" />
      <circle cx="277" cy="178" r="4" fill="currentColor" />
      <path
        d="M-20 470 C 110 470, 150 300, 400 330"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

export default function ShaderPlaygroundPage() {
  const [shaderId, setShaderId] = useState<ShaderId>("cosmicTrack");
  const spec = SHADER_SPECS[shaderId];

  const [presetId, setPresetId] = useState(spec.presets[0].id);
  const [state, setState] = useState(() =>
    presetParams(spec, spec.presets[0].id),
  );
  const [grain, setGrain] = useState(false);
  const [vectors, setVectors] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Switching shader re-seeds from that shader's first preset — its control table is a different shape. */
  function selectShader(next: ShaderId) {
    const nextSpec = SHADER_SPECS[next];
    const firstPreset = nextSpec.presets[0].id;
    setShaderId(next);
    setPresetId(firstPreset);
    setState(presetParams(nextSpec, firstPreset));
    setCopied(false);
  }

  function selectPreset(next: string) {
    setPresetId(next);
    setState(presetParams(spec, next));
    setCopied(false);
  }

  function setParam(key: string, value: number | boolean | string) {
    setState((current) => ({
      ...current,
      params: { ...current.params, [key]: value },
    }));
    setCopied(false);
  }

  /**
   * Growing the colour list copies the LAST colour rather than inserting a
   * default: a new stop the same as its neighbour is invisible until you edit
   * it, whereas a black one drops a hole into the gradient you were tuning.
   * (Same reasoning as the media properties panel.)
   */
  function setColorCount(count: number) {
    setState((current) => {
      const colors = current.colors.slice(0, count);
      while (colors.length < count) {
        colors.push(colors[colors.length - 1] ?? "#FFFFFFFF");
      }
      return { ...current, colors };
    });
  }

  /** The settings as a JSX tag, ready to paste into a component. */
  async function copyProps() {
    const lines = [
      ...Object.entries(state.params).map(([key, value]) =>
        typeof value === "string"
          ? `  ${key}="${value}"`
          : typeof value === "boolean"
            ? value
              ? `  ${key}`
              : ""
            : `  ${key}={${value}}`,
      ),
      ...(state.colorBack ? [`  colorBack="${state.colorBack}"`] : []),
      ...Object.entries(state.extraColors).map(
        ([key, value]) => `  ${key}="${value}"`,
      ),
      `  colors={${JSON.stringify(state.colors)}}`,
      `  fit="cover"`,
    ].filter(Boolean);

    const jsx = `<${spec.label.replace(/ /g, "")}\n${lines.join("\n")}\n/>`;

    // A denied clipboard permission is a rejected promise, and an unhandled one
    // in a dev tool is just noise in the console you were trying to read. Fall
    // back to logging the tag — the point is to get the settings OUT.
    try {
      await navigator.clipboard.writeText(jsx);
      setCopied(true);
    } catch {
      console.info(jsx);
    }
  }

  return (
    <main className={pageStyle}>
      <div className={stageStyle}>
        <div className={cardStyle}>
          <ShaderStage
            spec={spec}
            params={state.params}
            colors={state.colors}
            colorBack={state.colorBack}
            extraColors={state.extraColors}
          />

          {/* The stacking test, live: a SECOND shader over the first, made
              transparent by `colorBack` and composited with `mix-blend-mode`.
              Only shaders with a `colorBack` can do this — the mesh gradients
              are opaque fills, which is why the grain goes on top and never
              underneath. */}
          {grain && (
            <PaperTexture
              className={layerStyle}
              colorBack="#00000000"
              colorFront="#00000022"
              roughness={0.6}
              fiber={0.3}
              fiberSize={0.4}
              crumples={0}
              folds={0}
              drops={0}
              fade={0}
              contrast={0.4}
              fit="cover"
              speed={0}
              maxPixelCount={MAX_PIXELS}
              style={{ mixBlendMode: "overlay" }}
            />
          )}

          {vectors && <VectorOverlay />}
        </div>

        <div className={rowStyle}>
          <Field size="sm">
            <Switch checked={grain} onCheckedChange={setGrain} />
            <Field.Label>Grain layer</Field.Label>
          </Field>
        </div>
        <div className={rowStyle}>
          <Field size="sm">
            <Switch checked={vectors} onCheckedChange={setVectors} />
            <Field.Label>Vector marks</Field.Label>
          </Field>
        </div>
      </div>

      <div className={panelStyle}>
        <div className={groupStyle}>
          <span className={headingStyle}>Shader</span>
          <div className={rowStyle}>
            {SHADER_IDS.map((id) => (
              <Button
                key={id}
                size="sm"
                emphasis={id === shaderId ? "secondary" : "tertiary"}
                onClick={() => selectShader(id)}
              >
                {SHADER_SPECS[id].label}
              </Button>
            ))}
          </div>
        </div>

        <div className={groupStyle}>
          <span className={headingStyle}>Preset</span>
          <div className={rowStyle}>
            {spec.presets.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                emphasis={preset.id === presetId ? "secondary" : "tertiary"}
                onClick={() => selectPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <p className={captionStyle}>
            {spec.presets.find((preset) => preset.id === presetId)?.note}
          </p>
        </div>

        <div className={groupStyle}>
          <span className={headingStyle}>Colours</span>

          <Field size="sm">
            <Field.Label>Count</Field.Label>
            <Slider
              min={1}
              max={spec.maxColors}
              step={1}
              value={state.colors.length}
              onValueChange={setColorCount}
            />
          </Field>

          {state.colors.map((color, index) => (
            <Field size="sm" key={index}>
              <Field.Label>{`Colour ${index + 1}`}</Field.Label>
              <ColorInput
                value={color}
                onValueChange={(value) =>
                  setState((current) => ({
                    ...current,
                    colors: current.colors.map((existing, i) =>
                      i === index ? value : existing,
                    ),
                  }))
                }
              />
            </Field>
          ))}

          {spec.hasColorBack && state.colorBack && (
            <Field size="sm">
              <Field.Label>Background</Field.Label>
              <ColorInput
                value={state.colorBack}
                onValueChange={(value) =>
                  setState((current) => ({ ...current, colorBack: value }))
                }
              />
            </Field>
          )}

          {spec.extraColors.map((extra) => (
            <Field size="sm" key={extra.key}>
              <Field.Label>{extra.label}</Field.Label>
              <ColorInput
                value={state.extraColors[extra.key]}
                onValueChange={(value) =>
                  setState((current) => ({
                    ...current,
                    extraColors: { ...current.extraColors, [extra.key]: value },
                  }))
                }
              />
            </Field>
          ))}
        </div>

        <div className={groupStyle}>
          <span className={headingStyle}>Parameters</span>

          {spec.controls.map((control) => {
            if (control.kind === "toggle") {
              return (
                <Field size="sm" key={control.key}>
                  <Switch
                    checked={Boolean(state.params[control.key])}
                    onCheckedChange={(checked) =>
                      setParam(control.key, checked)
                    }
                  />
                  <Field.Label>{control.label}</Field.Label>
                </Field>
              );
            }

            if (control.kind === "select") {
              return (
                <Field size="sm" key={control.key} className={selectFieldStyle}>
                  <Field.Label>{control.label}</Field.Label>
                  <SegmentedControl
                    options={control.options}
                    value={String(state.params[control.key])}
                    onValueChange={(value) => setParam(control.key, value)}
                  />
                </Field>
              );
            }

            return (
              <Field size="sm" key={control.key}>
                <Field.Label>{control.label}</Field.Label>
                <Slider
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={Number(state.params[control.key])}
                  onValueChange={(value) => setParam(control.key, value)}
                />
              </Field>
            );
          })}
        </div>

        <div className={groupStyle}>
          <div className={rowStyle}>
            <Button size="sm" onClick={copyProps}>
              {copied ? "Copied" : "Copy as JSX"}
            </Button>
            <Button
              size="sm"
              emphasis="tertiary"
              onClick={() => {
                setState((current) => ({
                  ...current,
                  params: defaultParams(spec),
                }));
                setCopied(false);
              }}
            >
              Reset params
            </Button>
          </div>
          <p className={captionStyle}>
            Presets are starting points, not matches — the last mile is
            eyeballing.
          </p>
        </div>
      </div>
    </main>
  );
}
