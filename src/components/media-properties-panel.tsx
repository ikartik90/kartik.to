"use client";

import { useState, type Ref } from "react";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { ColorInput } from "@/components/ui/input/color-input";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Slider } from "@/components/ui/input/slider";
import {
  ROTATION_MAX,
  ROTATION_MIN,
  ROTATION_STEP,
} from "@/utils/rotation";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_MEDIA_FIT,
  DEFAULT_MEDIA_RADIUS,
  MEDIA_PADDING_MAX,
  MEDIA_PADDING_STEP,
  MEDIA_RADIUS_MAX,
  MEDIA_RADIUS_STEP,
  type BackgroundEffect,
  type MediaFit,
} from "@/domain/nodes";
import EditIcon from "@/assets/icons/edit.svg";
import ShaderIcon from "@/assets/icons/shader.svg";

/** Each slider with the shader's documented range; `step` also sets the readout's precision. */
const SLIDERS: {
  key: keyof Omit<BackgroundEffect, "colors">;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  // A placement seed, not a position, so it steps by whole numbers.
  { key: "positions", label: "Positions", min: 0, max: 100, step: 1 },
  { key: "waveX", label: "Wave X", min: 0, max: 1, step: 0.01 },
  { key: "waveXShift", label: "Wave X Shift", min: 0, max: 1, step: 0.01 },
  { key: "waveY", label: "Wave Y", min: 0, max: 1, step: 0.01 },
  { key: "waveYShift", label: "Wave Y Shift", min: 0, max: 1, step: 0.01 },
  { key: "mixing", label: "Mixing", min: 0, max: 1, step: 0.01 },
  { key: "grainMixer", label: "Grain Mixer", min: 0, max: 1, step: 0.01 },
  { key: "grainOverlay", label: "Grain Overlay", min: 0, max: 1, step: 0.01 },
  { key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.01 },
  { key: "rotation", label: "Rotation", min: ROTATION_MIN, max: ROTATION_MAX, step: ROTATION_STEP },
  { key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.01 },
  { key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.01 },
];

const FITS: { value: MediaFit; label: string }[] = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

export interface MediaPropertiesPanelProps {
  objectFit: MediaFit | undefined;
  onObjectFitChange: (fit: MediaFit) => void;
  padding: number | undefined;
  onPaddingChange: (padding: number) => void;
  borderRadius: number | undefined;
  onBorderRadiusChange: (radius: number) => void;
  caption: string | undefined;
  onCaptionChange: (caption: string | undefined) => void;
  effect: BackgroundEffect | undefined;
  onEffectChange: (effect: BackgroundEffect | undefined) => void;
  /** Fired once the panel has finished sliding out. */
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

export function MediaPropertiesPanel({
  objectFit,
  onObjectFitChange,
  padding,
  onPaddingChange,
  borderRadius,
  onBorderRadiusChange,
  caption,
  onCaptionChange,
  effect,
  onEffectChange,
  onDismiss,
  ref,
}: MediaPropertiesPanelProps) {
  // A draft: the stored caption is trimmed, so a field derived from it would eat spaces as you type.
  const [draft, setDraft] = useState(caption ?? "");

  // Defaults rather than the parent's echo, so the first click never appears to do nothing.
  const current = effect ?? DEFAULT_BACKGROUND_EFFECT;

  /** Growing copies the last colour; shrinking truncates. */
  function setColorCount(count: number) {
    const colors = current.colors.slice(0, count);
    while (colors.length < count) {
      colors.push(colors[colors.length - 1] ?? "#FFFFFFFF");
    }
    onEffectChange({ ...current, colors });
  }

  function setColor(index: number, value: string) {
    onEffectChange({
      ...current,
      colors: current.colors.map((color, i) => (i === index ? value : color)),
    });
  }

  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel="Media properties"
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Media Properties</PropertiesPanel.Header>

      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Media layout">
          <PropertiesPanel.Control label="Object Fit">
            <SegmentedControl
              options={FITS}
              value={objectFit ?? DEFAULT_MEDIA_FIT}
              onValueChange={(value) => onObjectFitChange(value as MediaFit)}
            />
          </PropertiesPanel.Control>

          <PropertiesPanel.Control label="Padding">
            <Slider
              min={0}
              max={MEDIA_PADDING_MAX}
              step={MEDIA_PADDING_STEP}
              value={padding ?? 0}
              onValueChange={onPaddingChange}
            />
          </PropertiesPanel.Control>

          <PropertiesPanel.Control label="Radius">
            <Slider
              min={0}
              max={MEDIA_RADIUS_MAX}
              step={MEDIA_RADIUS_STEP}
              value={borderRadius ?? DEFAULT_MEDIA_RADIUS}
              onValueChange={onBorderRadiusChange}
            />
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={caption !== undefined}
        onEnabledChange={(enabled) => {
          if (enabled) return;
          setDraft("");
          onCaptionChange(undefined);
        }}
      >
        <PropertiesPanel.SectionHeader icon={<EditIcon aria-hidden />}>
          Caption
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Text
            ariaLabel="Image caption"
            placeholder="Describe this image…"
            value={draft}
            onValueChange={(value) => {
              setDraft(value);
              onCaptionChange(value.trim() || undefined);
            }}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={effect !== undefined}
        onEnabledChange={(enabled) =>
          onEffectChange(enabled ? DEFAULT_BACKGROUND_EFFECT : undefined)
        }
      >
        <PropertiesPanel.SectionHeader icon={<ShaderIcon aria-hidden />}>
          Background
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Control label="Color Count">
            <Slider
              min={1}
              max={BACKGROUND_EFFECT_MAX_COLORS}
              step={1}
              value={current.colors.length}
              onValueChange={setColorCount}
            />
          </PropertiesPanel.Control>

          {current.colors.map((color, index) => (
            // Keyed by slot: identical stops would collide on value.
            <PropertiesPanel.Control key={index} label={`Color ${index + 1}`}>
              <ColorInput
                value={color}
                onValueChange={(value) => setColor(index, value)}
              />
            </PropertiesPanel.Control>
          ))}

          {SLIDERS.map(({ key, label, min, max, step }) => (
            <PropertiesPanel.Control key={key} label={label}>
              <Slider
                min={min}
                max={max}
                step={step}
                value={current[key]}
                onValueChange={(value) =>
                  onEffectChange({ ...current, [key]: value })
                }
              />
            </PropertiesPanel.Control>
          ))}
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </PropertiesPanel>
  );
}
