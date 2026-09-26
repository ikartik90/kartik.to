"use client";

import type { ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
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

// No grid of its own: the replace chip is a sibling that the properties row places.
const imageFrameStyle = css({ cursor: "pointer" });

// Fills the frame, so the separator can stretch to its full height.
const imageTriggerStyle = css({
  appearance: "none",
  margin: "none",
  padding: "none",
  borderWidth: "0",
  backgroundColor: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "md",
  flex: "1 1 auto",
  minWidth: 0,
  textAlign: "start",
  _disabled: { cursor: "not-allowed" },
});

const imageThumbnailStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "& svg": {
    width: "token(spacing.lg)",
    height: "token(spacing.lg)",
    color: "field.text.muted",
  },
});

const imageMediaStyle = css({
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  objectFit: "cover",
});

// Typography comes from the field's `control` slot, worn alongside; don't set it here.
const imageNameStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

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
  const filename = src ? filenameFromMediaUrl(src) : undefined;

  return (
    <>
      <Field.Frame className={cx(imageFrameStyle, className)}>
        <button
          type="button"
          // Lights the frame while focused.
          data-control
          aria-label={`${filename ? "Change" : "Add"} ${noun}`}
          disabled={disabled}
          className={imageTriggerStyle}
          onClick={onPick}
        >
          <span className={cx(fieldStyles.thumbnail, imageThumbnailStyle)}>
            {thumbnailFor(src, kind, poster, imageMediaStyle)}
          </span>
          <span className={fieldStyles.separator} aria-hidden />
          <span
            className={cx(fieldStyles.control, imageNameStyle)}
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
