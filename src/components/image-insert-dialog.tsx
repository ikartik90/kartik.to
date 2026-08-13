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
import {
  useImageInsert,
  type ImageInsertPayload,
  type ImageInsertPhase,
} from "@/hooks/use-image-insert";
import { ALLOWED_MEDIA_CONTENT_TYPES } from "@/domain/media";
import { Media } from "@/components/media";
import { formatFileSize, formatMediaType } from "@/utils/format-file-size";
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

const selectionCountStyle = css({
  textStyle: "caption",
  color: "text.body/50",
  margin: "none",
  fontVariantNumeric: "tabular-nums",
});

const errorStyle = css({
  textStyle: "caption",
  color: "brand.pink",
  textAlign: "center",
});

const iconStyle = menuIcon();

// Built from the allow-list rather than restated, so the file picker cannot
// drift from what `processFile` and the server will actually take.
const ACCEPT = ALLOWED_MEDIA_CONTENT_TYPES.join(",");

/** The same list as `ACCEPT`, for the hint under the drop zone. */
const FORMAT_NAMES = "PNG, SVG, WEBP, JPG, GIF, MP4";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ImageDialogMode = "insert" | "change";

interface ImageInsertDialogBaseProps {
  open: boolean;
  mode?: ImageDialogMode;
  initialPhase?: ImageInsertPhase;
  onClose: () => void;
}

/**
 * Single- and multi-select are one dialog but two contracts: the payload shape
 * follows the selection mode, so the union makes a mismatched `onInsert` a type
 * error rather than a runtime surprise.
 */
export type ImageInsertDialogProps = ImageInsertDialogBaseProps &
  (
    | {
        selectionMode?: "single";
        maxSelection?: never;
        onInsert: (payload: ImageInsertPayload) => void;
      }
    | {
        selectionMode: "multiple";
        /** How many more images the target will take. */
        maxSelection?: number;
        onInsert: (payloads: ImageInsertPayload[]) => void;
      }
  );

export function ImageInsertDialog(props: ImageInsertDialogProps) {
  const {
    open,
    mode = "insert",
    initialPhase = "upload",
    onClose,
    selectionMode = "single",
  } = props;
  const isMultiple = selectionMode === "multiple";
  const maxSelection = (isMultiple ? props.maxSelection : undefined) ?? 6;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altFieldRef = useRef<HTMLTextAreaElement>(null);

  const {
    phase,
    assets,
    hasLibraryImages,
    selectedKey,
    selectedKeys,
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
    toggleAsset,
    updateAltText,
    updateFilename,
    deleteSelectedAsset,
    getInsertPayload,
    getInsertPayloads,
  } = useImageInsert({
    open,
    initialPhase,
    selectionMode,
    ...(isMultiple ? { maxSelection } : {}),
  });

  const selectedCount = selectedKeys.length;
  // "Media" is the dialog's noun throughout — the library holds clips as well
  // as stills. It is also a mass noun, so the batch count rides along without
  // inflecting the way "1 Image / 2 Images" did.
  const title = mode === "change" ? "Change Media" : "Insert Media";
  const confirmLabel = isMultiple ? `Insert ${selectedCount} Media` : title;

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
    if (props.selectionMode === "multiple") {
      const payloads = getInsertPayloads();
      if (payloads.length === 0) return;
      props.onInsert(payloads);
    } else {
      const payload = getInsertPayload();
      if (!payload) return;
      props.onInsert(payload);
    }
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
              selectedValues={isMultiple ? selectedKeys : undefined}
              // A plain click means "just this one"; a modified click adds or
              // drops a single image. Shift is what the brief asked for; ⌘/Ctrl
              // is the same gesture on every desktop file list, and treating it
              // differently here would only surprise people.
              onValueChange={(key, event) => {
                const modified =
                  !!event &&
                  (event.shiftKey || event.metaKey || event.ctrlKey);
                if (isMultiple && modified) toggleAsset(key);
                else selectAsset(key);
              }}
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
                      {/* The row's own `label` is the accessible name, so the
                          thumbnail is decorative either way. */}
                      <Media src={asset.url} alt="" />
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
                {/* The pane below edits ONE image — the anchor, i.e. whichever
                    row you touched last. This line is what keeps that honest
                    when the batch is larger than what's on screen. */}
                {isMultiple && (
                  <p className={selectionCountStyle} aria-live="polite">
                    {selectedCount} of {maxSelection} selected
                  </p>
                )}
                <figure className={mediaPreview()}>
                  {/* Controls here and not on the thumbnail: this pane is
                      where you check what you are about to insert, and for a
                      clip that means being able to scrub it. */}
                  <Media
                    src={selectedAsset.url}
                    alt={altText || selectedAsset.filename}
                    controls
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
                    {formatMediaType(selectedAsset.contentType)} -{" "}
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
                  a file
                </div>
                <p className={formatsStyle}>Supported formats: {FORMAT_NAMES}</p>
              </>
            )}
          </div>
        </div>
      )}

      <footer className={dialogFooter()}>
        <div className={dialogFooterGroup()}>
          <Button
            type="button"
            size="sm"
            emphasis="tertiary"
            disabled={isBusy}
            onClick={handleClose}
          >
            Cancel
          </Button>
          {phase === "library" ? (
            <Button
              type="button"
              size="sm"
              disabled={isBusy}
              onClick={goToUpload}
            >
              Upload Media...
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
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
          size="sm"
          disabled={
            isBusy ||
            phase !== "library" ||
            (isMultiple ? selectedCount === 0 : !selectedKey)
          }
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
