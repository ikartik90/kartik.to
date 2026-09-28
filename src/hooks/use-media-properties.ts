"use client";

import { useRef, useState } from "react";
import type { MediaPropertiesPanelProps } from "@/components/media-properties-panel";
import type { PropertiesPanelHandle } from "@/components/ui/properties-panel";
import type { MediaCaptionStyle, MediaNode } from "@/domain/nodes";
import {
  setItemBackgroundEffect,
  setItemCaption,
  setItemCaptionStyle,
  setItemLayout,
} from "@/utils/collection-items";

export interface MediaPropertiesController {
  /** The object whose panel is open, or -1 when none is. */
  openIndex: number;
  isOpen: (index: number) => boolean;
  toggle: (index: number) => void;
  /** `key` is separate: React reads it off the element, remounting the panel per object. */
  panel: { key: string; props: MediaPropertiesPanelProps } | null;
}

export function useMediaProperties(
  items: readonly MediaNode[],
  onItemsChange: (next: MediaNode[]) => void,
  /** `captionStyles` offers the caption's style, which a slide takes from its carousel instead. */
  { captionStyles = false }: { captionStyles?: boolean } = {},
): MediaPropertiesController {
  // Keyed on the object's src, not its index, which shifts as items move or are removed.
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  // Close through the panel's `dismiss()` so its exit slide plays; clearing state unmounts it at once.
  const panelRef = useRef<PropertiesPanelHandle>(null);

  const openIndex = openSrc
    ? items.findIndex((item) => item.src === openSrc)
    : -1;
  const item = openIndex === -1 ? null : items[openIndex];

  function toggle(index: number) {
    const target = items[index];
    if (!target) return;
    if (openSrc === target.src) {
      panelRef.current?.dismiss();
      return;
    }
    setOpenSrc(target.src);
  }

  return {
    openIndex,
    isOpen: (index) => index === openIndex,
    toggle,
    panel: item
      ? {
          key: item.src,
          props: {
            ref: panelRef,
            objectFit: item.objectFit,
            onObjectFitChange: (objectFit) =>
              onItemsChange(setItemLayout(items, openIndex, { objectFit })),
            padding: item.padding,
            onPaddingChange: (padding) =>
              onItemsChange(setItemLayout(items, openIndex, { padding })),
            borderRadius: item.borderRadius,
            onBorderRadiusChange: (borderRadius) =>
              onItemsChange(setItemLayout(items, openIndex, { borderRadius })),
            caption: item.caption,
            onCaptionChange: (caption) =>
              onItemsChange(setItemCaption(items, openIndex, caption)),
            ...(captionStyles && {
              captionStyle: item.captionStyle ?? "caption",
              onCaptionStyleChange: (style: MediaCaptionStyle) =>
                onItemsChange(setItemCaptionStyle(items, openIndex, style)),
            }),
            effect: item.backgroundEffect,
            onEffectChange: (effect) =>
              onItemsChange(
                setItemBackgroundEffect(items, openIndex, effect),
              ),
            onDismiss: () => setOpenSrc(null),
          },
        }
      : null,
  };
}
