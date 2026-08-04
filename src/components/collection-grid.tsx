"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type Ref } from "react";
import {
  collectionCellOverlay,
  collectionEmptyCell,
  collectionGrid,
  inlineEditRow,
} from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { COLLECTION_MAX_ITEMS, type CollectionItem } from "@/domain/nodes";
import { collectionItemAlt } from "@/utils/collection-items";
import AddIcon from "@/assets/icons/add.svg";
import EditIcon from "@/assets/icons/edit.svg";
import FeatureIcon from "@/assets/icons/feature.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// CollectionGrid — the collection block's authoring surface.
//
// Every slot is drawn, filled or not, so the six-image cap reads as a shape
// rather than as an error you discover by hitting it. A filled slot reveals its
// controls on hover; an empty one is a single "Add Image" button.
//
// The component is deliberately stateless about the collection itself: it takes
// an ordered `items` array and emits intent (feature / caption / replace /
// remove / add). All the array algebra lives in `@/utils/collection-items`, and
// the parent owns undo granularity — a reorder or a removal has to be one clean
// history step, which it can't be if it rides a caption-typing debounce.
// ---------------------------------------------------------------------------

const gridStyles = collectionGrid({ layout: "uniform" });
const emptyCellStyle = collectionEmptyCell();
// Only the Esc key-cap is borrowed from the inline-edit row — the caption card
// owns its own surface and field, and the hint is identical wherever it appears.
const editRow = inlineEditRow();

export interface CollectionGridProps {
  items: CollectionItem[];
  /**
   * The editor's showcase-media contract (tabindex, focus handlers, caret
   * key handling) — spread onto the grid root so a collection navigates
   * exactly like a single image block.
   */
  rootProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };
  onFeature: (index: number) => void;
  onEditCaption: (index: number, caption: string | undefined) => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onAddImage: () => void;
}

export function CollectionGrid({
  items,
  rootProps,
  onFeature,
  onEditCaption,
  onReplace,
  onRemove,
  onAddImage,
}: CollectionGridProps) {
  // Keyed on the image, NOT the slot. Featuring an image moves it to another
  // cell and removing one slides its neighbours along, so a stored index would
  // strand the open field on whatever took that slot. Pinning to `src` makes
  // "the editor follows its image" and "the editor closes when its image is
  // gone" fall out of a plain lookup, with no effect to keep them in sync.
  const [editingSrc, setEditingSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const editingIndex = editingSrc
    ? items.findIndex((item) => item.src === editingSrc)
    : -1;

  useEffect(() => {
    if (editingIndex !== -1) inputRef.current?.select();
  }, [editingIndex]);

  function startEditing(index: number) {
    setEditingSrc(items[index].src);
    setDraft(items[index].caption ?? "");
  }

  function commit(index: number) {
    setEditingSrc(null);
    onEditCaption(index, draft.trim() || undefined);
  }

  // Six slots, always: the items in order, then empties to fill.
  const slots = Array.from(
    { length: COLLECTION_MAX_ITEMS },
    (_, index) => items[index] ?? null,
  );

  return (
    <div {...rootProps} className={gridStyles.root}>
      {slots.map((item, index) =>
        item ? (
          <figure
            // `src` alone isn't unique (the same image may be added twice), so
            // the slot index disambiguates.
            key={`${index}-${item.src}`}
            className={gridStyles.cell}
            // The hook the overlay's reveal rule keys on — an attribute rather
            // than a generated class, so the recipe can name it directly.
            data-collection-cell=""
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={collectionItemAlt(item)}
              className={gridStyles.image}
            />
            <CellOverlay
              index={index}
              featured={index === 0}
              editing={index === editingIndex}
              draft={draft}
              inputRef={inputRef}
              onDraftChange={setDraft}
              onStartEditing={() => startEditing(index)}
              onCommit={() => commit(index)}
              onCancel={() => setEditingSrc(null)}
              onFeature={() => onFeature(index)}
              onReplace={() => onReplace(index)}
              onRemove={() => onRemove(index)}
            />
          </figure>
        ) : (
          <button
            key={index}
            type="button"
            className={emptyCellStyle}
            onClick={onAddImage}
          >
            <AddIcon aria-hidden />
            Add Image
          </button>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-cell controls
// ---------------------------------------------------------------------------

interface CellOverlayProps {
  index: number;
  featured: boolean;
  editing: boolean;
  draft: string;
  inputRef: Ref<HTMLInputElement>;
  onDraftChange: (value: string) => void;
  onStartEditing: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onFeature: () => void;
  onReplace: () => void;
  onRemove: () => void;
}

function CellOverlay({
  index,
  featured,
  editing,
  draft,
  inputRef,
  onDraftChange,
  onStartEditing,
  onCommit,
  onCancel,
  onFeature,
  onReplace,
  onRemove,
}: CellOverlayProps) {
  const styles = collectionCellOverlay();
  const label = `Image ${index + 1}`;

  // The caption editor stands WHERE the toolbar stands, but is a card rather
  // than a pill — a margin note on the picture, wearing the sidenote's clothes.
  if (editing) {
    return (
      <div className={styles.root}>
        <div className={styles.scrim} aria-hidden />
        <div className={styles.captionCard}>
          <input
            ref={inputRef}
            type="text"
            aria-label="Image caption"
            placeholder="Add caption..."
            className={styles.captionField}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            // Leaving the field commits. Losing a caption you just typed to a
            // stray click elsewhere is a worse failure than committing one you
            // were unsure about — Escape is the way to discard.
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                // Stop the editor's block-level Escape handling: this key press
                // belongs to the field it is closing.
                event.stopPropagation();
                onCancel();
              }
            }}
          />
          <div className={editRow.hint} aria-hidden>
            <span className={editRow.hintKey}>Esc</span>
            <span className={editRow.hintLabel}>to exit</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.scrim} aria-hidden />
      <div className={styles.toolbar}>
        <OptionList direction="inline">
          <OptionList.Toolbar aria-label={`${label} actions`}>
            {/* Featured is a POSITION (index 0), so the first slot's button is
                simply already on. Pressed rather than disabled: a disabled
                button dims to 40%, which would fight the brand chip that is
                the whole signal here. */}
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
            <OptionList.Option
              aria-label="Edit image caption"
              onClick={onStartEditing}
            >
              <EditIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Replace image" onClick={onReplace}>
              <ReplaceIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Remove image" onClick={onRemove}>
              <TrashIcon aria-hidden />
            </OptionList.Option>
          </OptionList.Toolbar>
        </OptionList>
      </div>
    </div>
  );
}
