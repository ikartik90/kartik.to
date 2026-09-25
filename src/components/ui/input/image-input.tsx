"use client";

import type { ReactNode } from "react";
import { cx } from "../../../../styled-system/css";
import { imageField } from "../../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/media";
import { filenameFromMediaUrl } from "@/domain/media";
import type { MediaKind } from "@/domain/nodes";
import { Field, useField } from "./field";
import MediaIcon from "@/assets/icons/media.svg";
import PageIcon from "@/assets/icons/page.svg";
import ReplaceIcon from "@/assets/icons/replace.svg";

export interface ImageInputProps {
  /** The stored URL; the displayed name is read off it. */
  src?: string;
  /** Taken rather than guessed from the src; `document` draws a glyph. */
  kind?: MediaKind | "document";
  /** A clip's still, so a slot holding a clip shows a frame rather than black. */
  poster?: string;
  /** Names both controls ("Change picture", "Add document"); a button can't take the row's `<label>`. */
  noun: string;
  onPick: () => void;
  disabled?: boolean;
  /** Applied to the field frame. */
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
  // The name is not a `Field.Control`, so it borrows the `control` class.
  const { styles: fieldStyles } = useField("ImageInput");
  const styles = imageField();
  const filename = src ? filenameFromMediaUrl(src) : undefined;

  return (
    <>
      <Field.Frame className={cx(styles.frame, className)}>
        <button
          type="button"
          // Lights the frame while focused.
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
            data-placeholder={filename ? undefined : ""}
          >
            {filename ?? `Add ${noun}`}
          </span>
        </button>
      </Field.Frame>

      {filename ? (
        <Button
          type="button"
          size="sm"
          variant="icon"
          emphasis="tertiary"
          aria-label={`Replace ${noun}`}
          disabled={disabled}
          onClick={onPick}
        >
          <ReplaceIcon aria-hidden />
        </Button>
      ) : null}
    </>
  );
}

function thumbnailFor(
  src: string | undefined,
  kind: MediaKind | "document",
  poster: string | undefined,
  className: string,
): ReactNode {
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
