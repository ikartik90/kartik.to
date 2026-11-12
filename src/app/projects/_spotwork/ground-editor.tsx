"use client";

import { css } from "../../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { ColorSwatchGrid } from "@/components/ui/input/color-swatch-grid";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Tooltip } from "@/components/ui/tooltip";
import CheckIcon from "@/assets/icons/check.svg";
import SliderIcon from "@/assets/icons/slider.svg";
import { FRAMING_CONTROL_KEYS, MOTION_CONTROL_KEYS, SHADER_SPECS, type ControlGroup } from "@/data/shader-specs";
import { GROUND_SLIDERS, PRISM_GROUND, mergeGround, usePrismGround, type PrismGround } from "./prism-ground";
import { ValuesActions } from "./values-actions";

// Kartik's controls for the overlay's Prism Fold ground, in the About sheet in development. Tune, then copy the values
// into PRISM_GROUND to make them the defaults.

// Its parts keep their height in the card, which would otherwise squeeze them to fit.
const editorStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  "& > *, & > section > *": { flexShrink: 0 },
});

const headStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
});

const titleStyle = css({ textStyle: "subheading", color: "text.title" });

const actionsStyle = css({ display: "flex", alignItems: "center", gap: "xs" });

const groupStyle = css({ display: "flex", flexDirection: "column", gap: "md" });

const groupTitleStyle = css({ textStyle: "caption", color: "text.body" });

const spec = SHADER_SPECS.prismFold;

// Framing and Speed carry no group in the spec, so they're kept out of the shader's own.
const SHARED = new Set([...FRAMING_CONTROL_KEYS, ...MOTION_CONTROL_KEYS]);
const keysIn = (group?: ControlGroup) =>
  GROUND_SLIDERS.filter((s) => s.group === group && !SHARED.has(s.key)).map((s) => s.key);

// The playground's groups, in its order.
const GROUPS = [
  { title: spec.ownLabel, keys: keysIn() },
  { title: "Ramp", keys: keysIn("ramp") },
  { title: "Glow", keys: keysIn("glow") },
  { title: "Edge", keys: keysIn("edge") },
  { title: "Dither", keys: keysIn("dither") },
  { title: "Framing", keys: FRAMING_CONTROL_KEYS },
  { title: "Motion", keys: MOTION_CONTROL_KEYS },
];

const SLIDER = new Map(GROUND_SLIDERS.map((s) => [s.key, s]));

/** The About sheet's switch between the project story and these controls, in development only. */
export function TuneGroundToggle({ tuning, onTuning }: { tuning: boolean; onTuning: (tuning: boolean) => void }) {
  if (process.env.NODE_ENV !== "development") return null;
  const label = tuning ? "Done tuning" : "Tune background";
  return (
    <Button variant="icon" aria-label={label} aria-pressed={tuning} onClick={() => onTuning(!tuning)}>
      {tuning ? <CheckIcon aria-hidden /> : <SliderIcon aria-hidden />}
      <Button.Tooltip>
        <Tooltip.Text>{label}</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );
}

export function GroundEditor() {
  const [ground, setGround] = usePrismGround();
  const set = (change: Partial<PrismGround>) => setGround({ ...ground, ...change });
  const values = ground as unknown as Record<string, number>;

  return (
    <div className={editorStyle}>
      <div className={headStyle}>
        <h2 className={titleStyle}>Background</h2>
        <div className={actionsStyle}>
          <ValuesActions
            values={ground}
            onPaste={(pasted) => {
              const next = mergeGround(ground, pasted);
              if (next) setGround(next);
              return !!next;
            }}
            onReset={() => setGround(PRISM_GROUND)}
          />
        </div>
      </div>

      <section className={groupStyle} aria-label="Colours">
        <h3 className={groupTitleStyle}>Colours</h3>
        <Field size="sm">
          <Field.Label>{spec.colorsLabel}</Field.Label>
          <ColorSwatchGrid
            ariaLabel={`${spec.colorsLabel} colours`}
            capacity={spec.maxColors}
            values={ground.colors}
            onValueChange={(index, value) => set({ colors: ground.colors.map((c, i) => (i === index ? value : c)) })}
            onAdd={() => set({ colors: [...ground.colors, ground.colors[ground.colors.length - 1]] })}
            onRemove={(index) => ground.colors.length > 1 && set({ colors: ground.colors.filter((_, i) => i !== index) })}
          />
        </Field>
        {spec.extraColors.map((extra) => (
          <Field size="sm" key={extra.key}>
            <Field.Label>{extra.label}</Field.Label>
            <ColorSwatchGrid
              ariaLabel={`${extra.label} colour`}
              capacity={1}
              values={[ground.colorSeam]}
              onValueChange={(_, colorSeam) => set({ colorSeam })}
            />
          </Field>
        ))}
      </section>

      {GROUPS.map(({ title, keys }) => (
        <section key={title} className={groupStyle} aria-label={title}>
          <h3 className={groupTitleStyle}>{title}</h3>
          {keys.map((key) => {
            const slider = SLIDER.get(key)!;
            return (
              <Field size="sm" key={key}>
                <Field.Label>{slider.label}</Field.Label>
                <Slider
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={values[key]}
                  onValueChange={(value) => set({ [key]: value })}
                />
              </Field>
            );
          })}
        </section>
      ))}
    </div>
  );
}
