"use client";

import type { Ref } from "react";
import { css } from "../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Field } from "@/components/ui/input/field";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Switch } from "@/components/ui/input/switch";
import { CaptionStyleControl } from "@/components/media-properties-panel";
import type {
  CarouselSize,
  CollectionNode,
  MediaCaptionStyle,
} from "@/domain/nodes";

// At the field column's end, under the switches.
const captionStyleEnd = css({ justifySelf: "end" });

const SIZES: { value: CarouselSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

// Each setting is written only away from its default, so an untouched carousel saves as before.
function withSize(block: CollectionNode, size: CarouselSize): CollectionNode {
  const { size: _, ...rest } = block;
  return size === "medium" ? rest : { ...rest, size };
}

function withLightbox(block: CollectionNode, on: boolean): CollectionNode {
  const { lightbox: _, ...rest } = block;
  return on ? rest : { ...rest, lightbox: false };
}

function withCaptions(block: CollectionNode, on: boolean): CollectionNode {
  const { showCaptions: _, ...rest } = block;
  return on ? { ...rest, showCaptions: true } : rest;
}

function withCaptionStyle(
  block: CollectionNode,
  style: MediaCaptionStyle,
): CollectionNode {
  const { captionStyle: _, ...rest } = block;
  return style === "caption" ? rest : { ...rest, captionStyle: style };
}

/** A switch after a label too long for the label column. */
function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field size="sm" labelFirst data-property-block>
      <Field.Label>{label}</Field.Label>
      <Switch size="md" checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}

export interface CarouselPropertiesPanelProps {
  block: CollectionNode;
  onChange: (block: CollectionNode) => void;
  /** Fired once the panel has finished sliding out. */
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

export function CarouselPropertiesPanel({
  block,
  onChange,
  onDismiss,
  ref,
}: CarouselPropertiesPanelProps) {
  const showCaptions = block.showCaptions === true;

  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel="Carousel properties"
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Carousel properties</PropertiesPanel.Header>

      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Carousel settings">
          <PropertiesPanel.Control label="Size">
            <SegmentedControl
              options={SIZES}
              value={block.size ?? "medium"}
              onValueChange={(size) =>
                onChange(withSize(block, size as CarouselSize))
              }
            />
          </PropertiesPanel.Control>

          <ToggleRow
            label="Open slides in lightbox"
            checked={block.lightbox !== false}
            onCheckedChange={(on) => onChange(withLightbox(block, on))}
          />

          <ToggleRow
            label="Show captions on carousel slides"
            checked={showCaptions}
            onCheckedChange={(on) => onChange(withCaptions(block, on))}
          />

          {showCaptions && (
            <PropertiesPanel.Control label="Caption style">
              <CaptionStyleControl
                className={captionStyleEnd}
                value={block.captionStyle ?? "caption"}
                onValueChange={(style) =>
                  onChange(withCaptionStyle(block, style))
                }
              />
            </PropertiesPanel.Control>
          )}
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </PropertiesPanel>
  );
}
