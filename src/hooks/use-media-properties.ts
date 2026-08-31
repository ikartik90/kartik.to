"use client";

import { useRef, useState } from "react";
import type { MediaPropertiesPanelProps } from "@/components/media-properties-panel";
import type { PropertiesPanelHandle } from "@/components/ui/properties-panel";
import type { MediaNode } from "@/domain/nodes";
import {
  setItemBackgroundEffect,
  setItemCaption,
  setItemLayout,
} from "@/utils/collection-items";

// ---------------------------------------------------------------------------
// Which media object the docked inspector is addressing, and what it writes.
//
// The panel is ONE surface shared by every media object on the page — it docks
// to the viewport and portals to the body — so "which one is open" is a
// question about the page rather than about any object, and it is answered
// here rather than four times over.
//
// A standalone media block is a list of ONE. That is the whole reason this is a
// hook over an array rather than two hooks: the editor's collection block and
// its media block hold the same kind of thing (`CollectionItem` is literally
// `MediaNode`), so the item algebra in `@/utils/collection-items` applies to a
// block untouched and the panel wiring stops being duplicated between them.
// ---------------------------------------------------------------------------

export interface MediaPropertiesController {
  /** The object whose panel is open, or -1 when none is. */
  openIndex: number;
  isOpen: (index: number) => boolean;
  /** Opens this object's panel — or closes it, if it is the one already open. */
  toggle: (index: number) => void;
  /**
   * The panel to render, or null when nothing is open. `key` is separate from
   * `props` because React reads it off the element rather than out of a spread:
   * the panel is remounted per object, so one reopened on another picture
   * starts from that picture's values rather than the previous one's drafts.
   */
  panel: { key: string; props: MediaPropertiesPanelProps } | null;
}

export function useMediaProperties(
  items: readonly MediaNode[],
  onItemsChange: (next: MediaNode[]) => void,
): MediaPropertiesController {
  // Keyed on the OBJECT and not on the slot. Featuring an image moves it to
  // another cell and removing one slides its neighbours along, so a stored
  // index would strand the open panel on whatever took that slot — captioning
  // or retuning the wrong picture. Pinning to `src` makes "the panel follows
  // its image" and "the panel closes when its image is gone" fall out of a
  // plain lookup, with no effect to keep them in sync.
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  // Closing goes through the PANEL, never through this state directly — see
  // `toggle`.
  const panelRef = useRef<PropertiesPanelHandle>(null);

  const openIndex = openSrc
    ? items.findIndex((item) => item.src === openSrc)
    : -1;
  const item = openIndex === -1 ? null : items[openIndex];

  /**
   * Opens the panel for an object — or closes it, if that object's panel is the
   * one already open.
   *
   * Opening applies NOTHING. The panel's sections each own their property, and
   * adding one is a click inside the panel: reaching for the button is a
   * request to SEE the properties of a picture, which must not be the same
   * gesture as giving it a gradient it didn't have.
   *
   * Closing ASKS the panel rather than dropping it from the tree. Clearing this
   * state unmounts it on the spot, which takes its closing slide with it — the
   * panel arrives from the edge of the screen and would simply blink out. It
   * calls back when it has finished leaving.
   */
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
