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

// ---------------------------------------------------------------------------
// MediaPropertiesPanel — everything about one picture that its five-button
// toolbar cannot say, in the docked inspector (Figma 845:7223).
//
// Caption and background used to be two separate editors reached from two
// separate toolbar buttons — a card standing where the toolbar stood, and a
// panel floating beside the cell. They are both answers to "what are the
// properties of this image?", so they are now two SECTIONS of one panel, and
// the toolbar asks that question once.
//
// A live editor, not a form: every control commits on change, so what is
// behind the picture is always exactly what the panel says. There is no apply
// step and no draft of the effect — the parent owns it and hands back a new
// one, which is what lets the same object drive the editor cell, the reader
// and the lightbox with nothing to keep in sync.
//
// A SECTION is the property. Adding one applies it, removing one takes it
// away — so there is no third state where a section is open over a property
// that isn't there, and no "remove" action buried at the foot of a list of
// fifteen controls.
// ---------------------------------------------------------------------------

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

/**
 * The two fits the control offers, in the drawn order (Figma 885:1963).
 * `cover` first because it is the default and the one most pictures want; a
 * screenshot with its own margins is the case for `contain`.
 */
const FITS: { value: MediaFit; label: string }[] = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

export interface MediaPropertiesPanelProps {
  /** Absent means the default fill — see `mediaLayoutStyle`. */
  objectFit: MediaFit | undefined;
  onObjectFitChange: (fit: MediaFit) => void;
  /** Absent means no padding. */
  padding: number | undefined;
  onPaddingChange: (padding: number) => void;
  /** Absent means square, as it does for the inset. See `DEFAULT_MEDIA_RADIUS`. */
  borderRadius: number | undefined;
  onBorderRadiusChange: (radius: number) => void;
  caption: string | undefined;
  /** `undefined` clears the caption — what removing the section does. */
  onCaptionChange: (caption: string | undefined) => void;
  effect: BackgroundEffect | undefined;
  /** `undefined` clears the effect — what removing the section does. */
  onEffectChange: (effect: BackgroundEffect | undefined) => void;
  /** Fired once the panel has finished sliding out — see PropertiesPanel. */
  onDismiss: () => void;
  /** Handle for closing the panel from the control that opened it. */
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
  // A draft, because what is STORED is not what is typed: the caption is
  // trimmed on the way out and an empty one is dropped entirely, so a field
  // derived from the stored value would swallow the space between two words
  // and refuse to hold a caption you were halfway through clearing.
  const [draft, setDraft] = useState(caption ?? "");

  // Falls back to the defaults rather than waiting for the effect to come back
  // from the parent. Enabling the section already emitted them upwards, but
  // that is a ROUND TRIP, and gating the controls on it would make the first
  // click appear to do nothing whenever the parent was slow to echo — or, for
  // a consumer that only observes, forever.
  const current = effect ?? DEFAULT_BACKGROUND_EFFECT;

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

      {/* First, and headerless: how the picture sits in its frame is not a
          property you ADD to it — every picture has a fit and an inset whether
          or not anyone has chosen one, so there is nothing here for an
          add/remove button to mean. `enabled` is held true rather than
          defaulted, so the section can never be closed (Figma 885:1963).

          Above Caption because it is about the picture itself; the sections
          below describe things laid over or behind it. */}
      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Media layout">
          <PropertiesPanel.Control label="Object Fit">
            <SegmentedControl
              options={FITS}
              value={objectFit ?? DEFAULT_MEDIA_FIT}
              onValueChange={(value) => onObjectFitChange(value as MediaFit)}
            />
          </PropertiesPanel.Control>

          {/* What the picture leaves clear around itself — and therefore how
              much of whatever stands BEHIND it shows: a background effect
              fills the box while the picture shrinks inside it, so padding is
              how you let the gradient out from under a photo that would
              otherwise cover it entirely. */}
          <PropertiesPanel.Control label="Padding">
            <Slider
              min={0}
              max={MEDIA_PADDING_MAX}
              step={MEDIA_PADDING_STEP}
              value={padding ?? 0}
              onValueChange={onPaddingChange}
            />
          </PropertiesPanel.Control>

          {/* The OBJECT's corner, and the corner of the ground behind it — no
              surface adds one of its own, so this number IS the shape on
              screen. It reads 0 for a picture nobody has rounded because that
              picture is square; it used to read 0 over a tile drawn with a 20px
              corner, which is the discrepancy `DEFAULT_MEDIA_RADIUS` exists to
              close. */}
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
            // Keyed by SLOT. The colours are positional stops, and keying on
            // the value would make two identical stops collide — which is the
            // normal state right after Color Count grows one.
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
