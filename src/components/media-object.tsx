"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../styled-system/css";
import { mediaObjectToolbar, toolbar } from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { PROPERTIES_TRIGGER_ATTR } from "@/components/ui/properties-panel";
import { BackgroundEffectLayer } from "@/components/background-effect";
import { Media, type MediaProps } from "@/components/media";
import type { MediaNode } from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";
import FeatureIcon from "@/assets/icons/feature.svg";
import PropertiesIcon from "@/assets/icons/slider.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";
import TrashIcon from "@/assets/icons/trash.svg";

export interface MediaObjectClasses {
  /** Must not clip, so the rail can straddle the frame's edge. */
  root: string;
  frame: string;
  image: string;
  backgroundEffect: string;
}

export interface MediaObjectProps {
  item: MediaNode;
  classes: MediaObjectClasses;
  label: string;
  featured?: boolean;
  /** Absent for a standalone block, which withholds the control. */
  onFeature?: () => void;
  propertiesOpen: boolean;
  onToggleProperties: () => void;
  onReplace: () => void;
  onRemove: () => void;
  /** Names what the trash does here: empty a slot, or delete a block. */
  removeLabel?: string;
  checkered?: boolean;
  frameProps?: HTMLAttributes<HTMLDivElement> & {
    ref?: Ref<HTMLDivElement>;
    [state: `data-${string}`]: unknown;
  };
  mediaProps?: Partial<
    Pick<
      MediaProps,
      | "tabIndex"
      | "onFocus"
      | "onBlur"
      | "onKeyDown"
      | "data-showcase-media"
      | "elementRef"
      | "autoPlay"
      | "draggable"
      | "loading"
    >
  >;
  /** Shown while the object has no source yet. */
  placeholder?: ReactNode;
}

export function MediaObject({
  item,
  classes,
  label,
  featured = false,
  onFeature,
  propertiesOpen,
  onToggleProperties,
  onReplace,
  onRemove,
  removeLabel = "Remove image",
  checkered = false,
  frameProps,
  mediaProps,
  placeholder,
}: MediaObjectProps) {
  return (
    <div className={classes.root}>
      <div
        className={classes.frame}
        // The hook the rail's reveal rule keys on.
        data-media-cell=""
        {...frameProps}
      >
        {/* Before the picture in the DOM, since tree order is paint order. */}
        {item.backgroundEffect && (
          <BackgroundEffectLayer
            effect={item.backgroundEffect}
            className={classes.backgroundEffect}
          />
        )}
        {item.src ? (
          <Media
            src={item.src}
            kind={item.kind}
            alt={collectionItemAlt(item)}
            className={classes.image}
            layout={item}
            width={item.width}
            height={item.height}
            data-checkered={checkered ? "" : undefined}
            {...mediaProps}
          />
        ) : (
          placeholder
        )}
      </div>
      <MediaToolbar
        label={label}
        featured={featured}
        onFeature={onFeature}
        propertiesOpen={propertiesOpen}
        onToggleProperties={onToggleProperties}
        onReplace={onReplace}
        onRemove={onRemove}
        removeLabel={removeLabel}
      />
    </div>
  );
}

interface MediaToolbarProps {
  label: string;
  featured: boolean;
  onFeature?: () => void;
  propertiesOpen: boolean;
  onToggleProperties: () => void;
  onReplace: () => void;
  onRemove: () => void;
  removeLabel: string;
}

function MediaToolbar({
  label,
  featured,
  onFeature,
  propertiesOpen,
  onToggleProperties,
  onReplace,
  onRemove,
  removeLabel,
}: MediaToolbarProps) {
  return (
    <div className={cx(toolbar(), mediaObjectToolbar())}>
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label={`${label} actions`}>
          {onFeature && (
            <>
              <OptionList.Option
                aria-label="Feature image"
                pressed={featured}
                onClick={() => {
                  if (!featured) onFeature();
                }}
              >
                <FeatureIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Divider />
            </>
          )}
          {/* Marked as the panel's trigger so a second press closes it; see PROPERTIES_TRIGGER_ATTR. */}
          <OptionList.Option
            {...PROPERTIES_TRIGGER_ATTR}
            aria-label="Image properties"
            pressed={propertiesOpen}
            onClick={onToggleProperties}
          >
            <PropertiesIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option aria-label="Replace image" onClick={onReplace}>
            <ReplaceIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option aria-label={removeLabel} onClick={onRemove}>
            <TrashIcon aria-hidden />
          </OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>
    </div>
  );
}
