"use client";

import type { ReactNode } from "react";
import { cx } from "../../../../styled-system/css";
import { imageField } from "../../../../styled-system/recipes";
import { Media } from "@/components/media";
import { filenameFromMediaUrl } from "@/domain/media";
import type { MediaKind } from "@/domain/nodes";
import { Field, useField } from "./field";
import MediaIcon from "@/assets/icons/media.svg";
import PageIcon from "@/assets/icons/page.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";

// ---------------------------------------------------------------------------
// ImageInput — the file archetype of the field family, composed INTO a <Field>
// exactly like ColorInput and Slider:
//
//   <PropertiesPanel.Control label="Image">
//     <ImageInput noun="picture" src={avatarUrl} onPick={openLibrary} />
//   </PropertiesPanel.Control>
//
// It is the colour field one part along (Figma 1233:2639): the 16px cell holds
// the file instead of a colour, the same hairline divides it, and the file's
// name stands where the hex digits do. Every picture slot in every rail is this
// control, so a card's cover and a testimonial's portrait are edited in the
// same row rather than in two hand-rolled ones.
//
// ONE FRAME, the width of every other row. The name is set in the field's own
// `control` slot rather than in a style of its own — that is how the two stay
// the same size as the rail's `size` changes, and how the empty slot asks in
// the same placeholder tone as an empty text field. Written here instead, it
// took the page's 16px into a row of 14px values and stood out as a bigger,
// looser line than everything above it.
//
// It owns no library and no dialog — `onPick` is the whole of its outward
// contract. WHICH library opens (pictures or documents) is the caller's to
// decide, because it is the caller that holds the slot.
//
// Two targets for one act: the field itself, which is the big and obvious one,
// and the replace action at its trailing edge, which says out loud what
// pressing does. An empty slot has nothing to replace, so it stands alone and
// asks instead.
//
// There is no clear: emptying a slot is the SECTION's job — closing the Picture
// section is how a portrait is removed, and closing Media drops both covers.
// ---------------------------------------------------------------------------

export interface ImageInputProps {
  /**
   * The file in the slot, as the URL the document stores — `undefined` for an
   * empty one. The name written in the field is read off it, the way every
   * surface holding a src rather than an asset does (`filenameFromMediaUrl`).
   */
  src?: string;
  /**
   * Which element draws it. `"document"` draws nothing at all — there is no
   * element that renders a PDF, and the glyph stands in for it exactly as it
   * does in the insert dialog.
   *
   * Taken rather than guessed from the src: a library key is not obliged to
   * carry an extension, and every caller holds either a media node that states
   * its kind or a slot that can only ever be one thing.
   */
  kind?: MediaKind | "document";
  /** A clip's still, so a slot holding a clip shows a frame rather than black. */
  poster?: string;
  /**
   * What the slot holds, for the controls' labels — "picture", "document",
   * "dark media". A button is not labelable by the row's `<label>`, so this is
   * the only thing that names either control: "Change dark media", "Add
   * document".
   */
  noun: string;
  /** Open the library. The same act on both controls. */
  onPick: () => void;
  disabled?: boolean;
  /** Applied to the field frame, as on every other control in the family. */
  className?: string;
}

export function ImageInput({
  src,
  kind = "image",
  poster,
  noun,
  onPick,
  disabled = false,
  className,
}: ImageInputProps) {
  // The field's own slot styles. The name is not a `Field.Control` (it holds no
  // value and claims no id), so it is handed the `control` class the way the
  // colour field's opacity box is — see ColorInput.
  const { styles: fieldStyles } = useField("ImageInput");
  const styles = imageField();
  const filename = src ? filenameFromMediaUrl(src) : undefined;

  return (
    <Field.Frame className={cx(styles.frame, className)}>
      <button
        type="button"
        // The field lights up while it is engaged, like every other control
        // in the family — the `field` recipe keys that off any `[data-control]`
        // in focus.
        data-control
        aria-label={`${filename ? "Change" : "Add"} ${noun}`}
        disabled={disabled}
        className={styles.trigger}
        onClick={onPick}
      >
        <span className={styles.thumbnail}>
          {thumbnailFor(src, kind, poster, styles.media)}
        </span>
        <span className={styles.separator} aria-hidden />
        <span
          className={cx(fieldStyles.control, styles.name)}
          // The family's own placeholder attribute, so an empty slot is written
          // in the placeholder tone — and shifts with the field when it is
          // engaged, exactly as an empty text field's prompt does.
          data-placeholder={filename ? undefined : ""}
        >
          {filename ?? `Add ${noun}`}
        </span>
      </button>

      {/* Nothing to replace in an empty slot — the field is asking already. */}
      {filename ? (
        <button
          type="button"
          // Carries `data-control` for the reason the opacity box does: the
          // field stays lit while THIS is the part in hand.
          data-control
          aria-label={`Replace ${noun}`}
          disabled={disabled}
          className={styles.replace}
          onClick={onPick}
        >
          <ReplaceIcon aria-hidden />
        </button>
      ) : null}
    </Field.Frame>
  );
}

/**
 * What the 16px cell draws: the file, or the glyph that stands in for one.
 *
 * Decorative in every branch — the name beside it is what says which file this
 * is, so a described thumbnail would be the same fact twice.
 */
function thumbnailFor(
  src: string | undefined,
  kind: MediaKind | "document",
  poster: string | undefined,
  className: string,
): ReactNode {
  // The glyph follows the KIND, not the emptiness: an empty document slot is
  // still a document slot, and offering it a picture glyph would describe the
  // library it does not open.
  if (!src || kind === "document") {
    return kind === "document" ? <PageIcon aria-hidden /> : <MediaIcon aria-hidden />;
  }
  return (
    <Media
      src={src}
      kind={kind}
      alt=""
      poster={poster}
      className={className}
      loading="lazy"
    />
  );
}
