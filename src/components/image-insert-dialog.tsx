"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { css, cx } from "../../styled-system/css";
import {
  dialogPanel,
  dialogHeader,
  dialogTitle,
  dialogFooter,
  dialogFooterGroup,
  uploadBody,
  uploadBodySlot,
  libraryBody,
  mediaLibrarySidebar,
  mediaPreview,
  mediaPreviewPane,
  mediaMetadataRow,
  mediaAltRow,
  mediaDeleteRow,
  mediaThumbnail,
  menuIcon,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptionList } from "@/components/ui/input/option-list";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useImageInsert, type ImageInsertPhase } from "@/hooks/use-image-insert";
import { formatFileSize, formatImageType } from "@/utils/format-file-size";
import CloseIcon from "@/assets/icons/cross.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const hiddenWhenEmptyStyle = css({ display: "none" });

const illustrationStyle = css({
  width: "125px",
  height: "100px",
  position: "relative",
  flexShrink: 0,
});

const illustrationImageStyle = css({
  objectFit: "contain",
  outline: "[none]",
  outlineWidth: "0",
});

/** Dark UI uses the light-themed illustration asset (Figma: image-light). */
const illustrationForDarkUiStyle = css({
  display: "none",
  _dark: { display: "block" },
});

/** Light UI uses the dark-themed illustration asset (Figma: image-dark). */
const illustrationForLightUiStyle = css({
  display: "block",
  _dark: { display: "none" },
});

const hintStyle = css({
  textStyle: "bodySmall",
  color: "text.body",
  textWrap: "pretty",
  lineHeight: "1.5rem",
  margin: "none",
});

const formatsStyle = css({
  textStyle: "caption",
  color: "text.body/50",
  lineHeight: "1.25rem",
  margin: "none",
});

// The filename reads as plain text until you click it — a bare input with the
// chrome stripped, exactly like the alt-text field it sits above. `font:
// inherit` is what keeps it matching the metadata row's caption type, since a
// form control doesn't inherit typography on its own.
const filenameFieldStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  background: "none",
  border: "none",
  padding: "none",
  font: "inherit",
  color: "text.body",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  _placeholder: { color: "text.body/50" },
});

const fileMetaStyle = css({
  flexShrink: 0,
  width: "120px",
  textAlign: "right",
  color: "text.body/50",
  fontVariantNumeric: "tabular-nums",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const altFieldStyle = css({
  width: "100%",
  minWidth: 0,
  background: "none",
  border: "none",
  padding: "none",
  textStyle: "caption",
  color: "text.body",
  lineHeight: "1.25rem",
  resize: "none",
  overflow: "hidden",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  _placeholder: {
    color: "text.body/50",
  },
});

const libraryFilenameStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

// The sidebar column (`mediaLibrarySidebar`) owns the frame, padding and scroll,
// so neutralize the OptionList `list` slot's self-contained popover framing —
// its 4px inset and 7-row max-height cap — and let the list fill the column.
// Atomic `css()` reliably outranks the recipe slot (utilities cascade layer).
const libraryListStyle = css({
  flex: "1 1 auto",
  minHeight: 0,
  maxHeight: "none",
  padding: "none",
});

const errorStyle = css({
  textStyle: "caption",
  color: "brand.pink",
  textAlign: "center",
});

const iconStyle = menuIcon();

const ACCEPT = "image/png,image/svg+xml,image/webp,image/jpeg,image/gif";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ImageDialogMode = "insert" | "change";

export interface ImageInsertDialogProps {
  open: boolean;
  mode?: ImageDialogMode;
  initialPhase?: ImageInsertPhase;
  onClose: () => void;
  onInsert: (payload: { src: string; alt?: string }) => void;
}

export function ImageInsertDialog({
  open,
  mode = "insert",
  initialPhase = "upload",
  onClose,
  onInsert,
}: ImageInsertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altFieldRef = useRef<HTMLTextAreaElement>(null);

  const {
    phase,
    assets,
    hasLibraryImages,
    selectedKey,
    selectedAsset,
    altText,
    filenameText,
    uploadProgress,
    isDragOver,
    setIsDragOver,
    error,
    isBusy,
    processFile,
    openLibrary,
    goToUpload,
    selectAsset,
    updateAltText,
    updateFilename,
    deleteSelectedAsset,
    getInsertPayload,
  } = useImageInsert({ open, initialPhase });

  const title = mode === "change" ? "Change Image" : "Insert Image";
  const confirmLabel = mode === "change" ? "Change Image" : "Insert Image";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useLayoutEffect(() => {
    const field = altFieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [altText, selectedKey]);

  function handleClose() {
    if (isBusy) return;
    onClose();
  }

  function handleInsert() {
    const payload = getInsertPayload();
    if (!payload) return;
    onInsert(payload);
    onClose();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (isBusy || phase === "library") return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  return (
    <Dialog
      ref={dialogRef}
      align="center"
      justify="center"
      aria-label={title}
      className={dialogPanel({ size: "md" })}
      onClose={handleClose}
    >
      <header className={dialogHeader()}>
        <h2 className={dialogTitle()}>{title}</h2>
        <Button
          type="button"
          variant="icon"
          aria-label="Close dialog"
          disabled={isBusy}
          onClick={handleClose}
        >
          <CloseIcon className={iconStyle} />
        </Button>
      </header>

      {phase === "library" ? (
        <div className={libraryBody()}>
          <div className={mediaLibrarySidebar()}>
            <OptionList
              value={selectedKey}
              onValueChange={selectAsset}
              tone="plain"
            >
              <OptionList.Listbox
                className={libraryListStyle}
                aria-label="Image library"
              >
                {assets.map((asset) => (
                  // `label` carries the searchable/accessible text, since the
                  // children are rich (thumbnail + filename) rather than a string.
                  <OptionList.Option
                    key={asset.key}
                    value={asset.key}
                    label={asset.filename}
                    disabled={isBusy}
                  >
                    <span className={mediaThumbnail()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt="" />
                    </span>
                    <span className={libraryFilenameStyle}>
                      {asset.filename}
                    </span>
                  </OptionList.Option>
                ))}
              </OptionList.Listbox>
            </OptionList>
          </div>

          <div className={mediaPreviewPane()}>
            {selectedAsset && (
              <>
                <figure className={mediaPreview()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedAsset.url}
                    alt={altText || selectedAsset.filename}
                  />
                </figure>
                <div className={mediaMetadataRow()}>
                  {/* Click the name to rename it — display only; the object key
                      (and any URL already published) is untouched. */}
                  <input
                    type="text"
                    className={filenameFieldStyle}
                    value={filenameText}
                    aria-label="File name"
                    placeholder="File name"
                    disabled={isBusy}
                    onChange={(e) => updateFilename(e.target.value)}
                  />
                  <span className={fileMetaStyle}>
                    {formatImageType(selectedAsset.contentType)} -{" "}
                    {formatFileSize(selectedAsset.size)}
                  </span>
                </div>
                <label className={mediaAltRow()}>
                  <span className={css({ srOnly: true })}>Alt text</span>
                  <textarea
                    ref={altFieldRef}
                    className={altFieldStyle}
                    value={altText}
                    placeholder="Add alt text..."
                    rows={1}
                    disabled={isBusy}
                    onChange={(e) => updateAltText(e.target.value)}
                  />
                </label>
                <div className={mediaDeleteRow()}>
                  <Button
                    type="button"
                    variant="icon"
                    aria-label="Delete image"
                    disabled={isBusy}
                    onClick={() => void deleteSelectedAsset()}
                  >
                    <TrashIcon className={iconStyle} />
                  </Button>
                </div>
                {error && <p className={errorStyle}>{error}</p>}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={uploadBodySlot()}>
          <div
            className={uploadBody({ dragOver: isDragOver })}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isBusy) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isBusy && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!isBusy) fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={isBusy ? -1 : 0}
            aria-disabled={isBusy}
          >
            <div className={illustrationStyle}>
              <Image
                src="/assets/image-dark.png"
                alt=""
                fill
                sizes="125px"
                className={cx(
                  illustrationForLightUiStyle,
                  illustrationImageStyle,
                )}
                priority
              />
              <Image
                src="/assets/image-light.png"
                alt=""
                fill
                sizes="125px"
                className={cx(
                  illustrationForDarkUiStyle,
                  illustrationImageStyle,
                )}
                priority
              />
            </div>

            {phase === "uploading" ? (
              <ProgressBar value={uploadProgress} label="Uploading image" />
            ) : error ? (
              <p className={errorStyle}>{error}</p>
            ) : (
              <>
                <div className={hintStyle}>
                  Drag and drop or{" "}
                  <Button
                    type="button"
                    variant="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    browse to upload
                  </Button>{" "}
                  an image
                </div>
                <p className={formatsStyle}>
                  Supported formats: PNG, SVG, WEBP, JPG, GIF
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <footer className={dialogFooter()}>
        <div className={dialogFooterGroup()}>
          <Button type="button" emphasis="tertiary" disabled={isBusy} onClick={handleClose}>
            Cancel
          </Button>
          {phase === "library" ? (
            <Button type="button" disabled={isBusy} onClick={goToUpload}>
              Upload Image...
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isBusy || !hasLibraryImages}
              className={cx(!hasLibraryImages && hiddenWhenEmptyStyle)}
              onClick={() => void openLibrary()}
            >
              Insert from Library...
            </Button>
          )}
        </div>
        <Button
          type="button"
          disabled={isBusy || phase !== "library" || !selectedKey}
          onClick={handleInsert}
        >
          {confirmLabel}
        </Button>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className={css({ display: "none" })}
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden
      />
    </Dialog>
  );
}
