"use client";

import { backgroundEffectPanel } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Typography } from "@/components/ui/typography";
import { ColorInput } from "@/components/ui/input/color-input";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
  type BackgroundEffect,
} from "@/domain/nodes";
import CloseIcon from "@/assets/icons/cross.svg";
import RemoveShaderIcon from "@/assets/icons/remove-shader.svg";

// ---------------------------------------------------------------------------
// BackgroundEffectPanel — the StaticMeshGradient properties for one image
// (Figma 845:7223).
//
// A live editor, not a form: every control commits on change, so the gradient
// behind the picture is always showing exactly what the panel says. There is no
// apply step and no local draft — the parent owns the effect and hands back a
// new one, which is what lets the same object drive the editor cell, the
// reader and the lightbox with nothing to keep in sync.
//
// Anchored to the cell rather than to the toolbar button: the button is inside
// an overlay that hides itself the moment this opens, so anchoring to it would
// pin the panel to something that is no longer there.
// ---------------------------------------------------------------------------

const styles = backgroundEffectPanel();

/**
 * The sliders, in the order the panel lists them, each with the shader's own
 * documented uniform range. A table rather than fifteen hand-written rows: the
 * rows differ ONLY in these four values, and spelling them out would invite the
 * ranges to drift from the shader they describe.
 *
 * `step` is what sets the readout's precision (see `formatSliderValue`), so a
 * 0–1 parameter reads `0.05` and an integer one reads `4`.
 */
const SLIDERS: {
  key: keyof Omit<BackgroundEffect, "colors">;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  // A placement SEED, not a position — nudging it re-rolls the whole field
  // rather than sliding it, which is why it steps by whole numbers.
  { key: "positions", label: "Positions", min: 0, max: 100, step: 1 },
  { key: "waveX", label: "Wave X", min: 0, max: 1, step: 0.01 },
  { key: "waveXShift", label: "Wave X Shift", min: 0, max: 1, step: 0.01 },
  { key: "waveY", label: "Wave Y", min: 0, max: 1, step: 0.01 },
  { key: "waveYShift", label: "Wave Y Shift", min: 0, max: 1, step: 0.01 },
  { key: "mixing", label: "Mixing", min: 0, max: 1, step: 0.01 },
  { key: "grainMixer", label: "Grain Mixer", min: 0, max: 1, step: 0.01 },
  { key: "grainOverlay", label: "Grain Overlay", min: 0, max: 1, step: 0.01 },
  { key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.01 },
  { key: "rotation", label: "Rotation", min: 0, max: 360, step: 1 },
  { key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.01 },
  { key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.01 },
];

export interface BackgroundEffectPanelProps {
  effect: BackgroundEffect;
  onChange: (effect: BackgroundEffect) => void;
  /** Clears the effect from the image entirely and closes the panel. */
  onRemove: () => void;
  onDismiss: () => void;
}

export function BackgroundEffectPanel({
  effect,
  onChange,
  onRemove,
  onDismiss,
}: BackgroundEffectPanelProps) {
  /**
   * Resizes the colour list. Growing copies the LAST colour rather than
   * inserting a default: a new stop the same as its neighbour is invisible
   * until you edit it, whereas a black one would drop a hole into the gradient
   * you were in the middle of tuning.
   *
   * Shrinking truncates, so growing back restores nothing — the colours you
   * removed are gone. That is the honest reading of a count control, and
   * remembering them would make the slider's two directions asymmetric.
   */
  function setColorCount(count: number) {
    const colors = effect.colors.slice(0, count);
    while (colors.length < count) {
      colors.push(colors[colors.length - 1] ?? "#FFFFFFFF");
    }
    onChange({ ...effect, colors });
  }

  function setColor(index: number, value: string) {
    onChange({
      ...effect,
      colors: effect.colors.map((color, i) => (i === index ? value : color)),
    });
  }

  return (
    <Popover
      className={styles.root}
      role="dialog"
      ariaLabel="Background properties"
      onDismiss={onDismiss}
    >
      <div className={styles.header}>
        <Typography tag="p" type="bodySmall" className={styles.title}>
          Background Properties
        </Typography>
        <Button aria-label="Close background properties" onClick={onDismiss}>
          <CloseIcon aria-hidden />
        </Button>
      </div>

      <div className={styles.body}>
        <Field size="sm">
          <Field.Label>Color Count</Field.Label>
          <Slider
            min={1}
            max={BACKGROUND_EFFECT_MAX_COLORS}
            step={1}
            value={effect.colors.length}
            onValueChange={setColorCount}
          />
        </Field>

        {effect.colors.map((color, index) => (
          // Keyed by SLOT. The colours are positional stops, and keying on the
          // value would make two identical stops collide — which is the normal
          // state right after Color Count grows one.
          <Field key={index} size="sm">
            <Field.Label>Color {index + 1}</Field.Label>
            <ColorInput
              value={color}
              onValueChange={(value) => setColor(index, value)}
            />
          </Field>
        ))}

        {SLIDERS.map(({ key, label, min, max, step }) => (
          <Field key={key} size="sm">
            <Field.Label>{label}</Field.Label>
            <Slider
              min={min}
              max={max}
              step={step}
              value={effect[key]}
              onValueChange={(value) => onChange({ ...effect, [key]: value })}
            />
          </Field>
        ))}

        <div className={styles.footer}>
          <Button emphasis="tertiary" size="sm" onClick={onRemove}>
            <RemoveShaderIcon aria-hidden />
            <Button.Text>Remove Background Effect</Button.Text>
          </Button>
        </div>
      </div>
    </Popover>
  );
}
