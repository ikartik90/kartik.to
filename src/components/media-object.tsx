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

// ---------------------------------------------------------------------------
// MediaObject — one picture or clip on the editor's canvas, wherever it stands.
//
// A collection slot and a standalone media block are the SAME object in two
// positions. The document has said so for a while — `CollectionItem` is
// literally `MediaNode`, and every property the panel edits (the caption, the
// shader ground, the fit, the inset, the corner) lives on the shared base — but
// the canvas did not: a slot got a five-button rail and a docked inspector, and
// a block got a tinted overlay with "Change Image…" on it. So the same picture
// could be given a gradient in one position and not in the other, and moving it
// between them would have silently changed what could be done to it.
//
// This is that object, drawn once. What differs between the two positions is
// handed in rather than branched on:
//
//   • `classes` — the BOXES. A slot is a cell in a 3×2 grid that clips its
//     photo to fill it; a block is the article's full width with its height
//     from the file. Two recipes (`collectionGrid`, `mediaBlock`), one
//     composition of four slots each.
//   • `frameProps` / `mediaProps` — the surface's own contract. The grid's
//     press-to-reorder gesture is on the frame; the editor block's tab stop and
//     caret keys are on the media element itself (see `MediaProps`).
//   • `onFeature` — absent for a block. Featuring is a move-to-front, and a
//     block has no other slot to move in front of.
//
// The rail is a SIBLING of the frame, not a child of it: it is centred on the
// frame's top edge with half of it hanging above, and a frame that clips (which
// a grid cell must, to round a photo filling it) would slice it in half. Both
// recipes give it a `root` that does not clip — see `mediaObjectToolbar`.
// ---------------------------------------------------------------------------

/** The four boxes this object is composed of; see the `mediaBlock` recipe. */
export interface MediaObjectClasses {
  /** The box that does NOT clip, so the rail can straddle the frame's edge. */
  root: string;
  /** The positioned box the ground fills and the media sits in. */
  frame: string;
  image: string;
  backgroundEffect: string;
}

export interface MediaObjectProps {
  item: MediaNode;
  classes: MediaObjectClasses;
  /** What the rail calls this object — "Image 1" in a grid, "Image" alone. */
  label: string;
  /**
   * Whether this object holds the featured position (slot 0). Only consulted
   * when `onFeature` is given — an object with no position is not offered it.
   */
  featured?: boolean;
  /**
   * Absent is what withholds the control, rather than a boolean disabling it —
   * the same bargain `GridItemToolbar` strikes with `onUnpublish`. Featuring is
   * a move-to-front, so for a block standing on its own there is no move to
   * make and a permanently held-down star would be a control that only ever
   * explains itself.
   */
  onFeature?: () => void;
  /**
   * Whether THIS object's properties panel is the one currently open — the
   * PANEL's state, not the object's. A single docked surface is shared by every
   * object on the page, so only its owner knows which one has it.
   */
  propertiesOpen: boolean;
  onToggleProperties: () => void;
  onReplace: () => void;
  onRemove: () => void;
  /**
   * What the trash means here. A collection slot is EMPTIED and the block goes
   * on; a standalone block is deleted outright. Same button, different
   * consequence, so the surface names it rather than the object guessing.
   */
  removeLabel?: string;
  /** Whether the picture is see-through — paints the checkerboard behind it. */
  checkered?: boolean;
  /** The surface's own hooks and gestures, spread onto the frame. */
  frameProps?: HTMLAttributes<HTMLDivElement> & {
    ref?: Ref<HTMLDivElement>;
    /** The state hooks a surface's own recipe keys on. */
    [state: `data-${string}`]: unknown;
  };
  /**
   * The surface's own contract on the media ELEMENT — the editor block's tab
   * stop and caret keys, the grid's `draggable={false}`. On the element rather
   * than on a box around it because that is where `Media` documents it
   * belonging, and because the element is what `[data-showcase-media]` finds.
   */
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
  /**
   * What stands in the frame while the object has no source yet. A block can be
   * inserted empty and filled afterwards, so the rail has to be reachable over
   * something — and an `<img>` with no `src` is a broken picture, not a
   * placeholder.
   */
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
        // The ONE hook the reveal rule keys on, stamped here so both surfaces
        // say it the same way — an explicit contract rather than the recipe
        // reaching in by generated class name.
        data-media-cell=""
        {...frameProps}
      >
        {/* Behind the picture, so it shows through wherever the media is
            transparent. Before it in the DOM as well as beneath it in the
            stack — see each recipe's `backgroundEffect` slot. */}
        {item.backgroundEffect && (
          <BackgroundEffectLayer
            effect={item.backgroundEffect}
            className={classes.backgroundEffect}
          />
        )}
        {item.src ? (
          <Media
            src={item.src}
            // The object's own word about what it is — never re-derived from
            // the src, so a clip under an extensionless key shows as a clip.
            kind={item.kind}
            alt={collectionItemAlt(item)}
            className={classes.image}
            // Fit, inset and corner are per-object DATA, so they ride as a
            // style rather than as recipe variants. The editor applies them for
            // the same reason the reader does: the panel is a live editor with
            // no apply step, and a canvas that ignored what the panel had just
            // written would make it a form rather than a preview.
            layout={item}
            // The box the canvas holds while a slot's picture is still coming
            // — the same reservation the reader makes, so the editor is still
            // a preview of it.
            width={item.width}
            height={item.height}
            // The checkerboard is the picture's OWN background rather than a
            // layer behind it, so it is the exclusive alternative to a gradient
            // and not a companion to one.
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

// ---------------------------------------------------------------------------
// The rail
// ---------------------------------------------------------------------------

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
          {/* Featured is a POSITION (index 0), so the first slot's button is
              simply already on. Pressed rather than disabled: a disabled
              button dims to 40%, which would fight the brand chip that is the
              whole signal here. Absent entirely where there is no position —
              see `onFeature`. */}
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
          {/* ONE button for everything about the media that isn't an action on
              the media. Caption and background each had their own before, which
              made "add a caption" and "add a gradient" look like different
              KINDS of thing; they are both properties, and the panel is where
              properties are.

              Pressed while its own panel is OPEN — the state it reports is the
              panel's, not the picture's. It is the way back out as well as in,
              so it has to look held down while it is holding something open.

              Marked as the panel's trigger so that second press actually closes
              it — see PROPERTIES_TRIGGER_ATTR. */}
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
