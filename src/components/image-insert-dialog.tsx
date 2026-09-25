"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { css, cx } from "../../styled-system/css";
import {
  dialogPanel,
  dialogHeader,
  dialogTitle,
  dialogFooter,
  uploadBody,
  libraryBody,
  mediaLibrarySidebar,
  mediaPreviewPane,
  menuIcon,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptionList } from "@/components/ui/input/option-list";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  useImageInsert,
  type ImageInsertAccepts,
  type ImageInsertPayload,
  type ImageInsertPhase,
} from "@/hooks/use-image-insert";
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  ALLOWED_MEDIA_CONTENT_TYPES,
  mediaKindOf,
  type MediaFolder,
} from "@/domain/media";
import { Media } from "@/components/media";
import { formatFileSize, formatMediaType } from "@/utils/format-file-size";
import CloseIcon from "@/assets/icons/cross.svg";
import PageIcon from "@/assets/icons/page.svg";
import TrashIcon from "@/assets/icons/trash.svg";

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

const illustrationForDarkUiStyle = css({
  display: "none",
  _dark: { display: "block" },
});

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

// `font: inherit`: a form control doesn't inherit typography.
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

const ACCEPT = {
  media: ALLOWED_MEDIA_CONTENT_TYPES.join(","),
  document: ALLOWED_DOCUMENT_CONTENT_TYPES.join(","),
} as const;

/** Must match `ACCEPT`'s lists; shown under the drop zone. */
const FORMAT_NAMES = {
  media: "PNG, SVG, WEBP, JPG, GIF, MP4",
  document: "PDF",
} as const;

const documentGlyphStyle = css({
  width: "40px",
  height: "40px",
  color: "text.body/50",
});

export type ImageDialogMode = "insert" | "change";

interface ImageInsertDialogBaseProps {
  open: boolean;
  mode?: ImageDialogMode;
  initialPhase?: ImageInsertPhase;
  accepts?: ImageInsertAccepts;
  /** `profiles` keeps testimonial faces out of the library. */
  folder?: MediaFolder;
  onClose: () => void;
}

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

const dialogFooterGroupStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
});

const uploadBodySlotStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: "1 1 0%",
  width: "100%",
  minHeight: 0,
});

const mediaPreviewStyle = css({
  height: "token(sizes.imagePreviewMax)",
  width: "auto",
  maxWidth: "token(spacing.full)",
  flexShrink: 0,
  margin: "none",
  "& :is(img, video)": {
    height: "100%",
    width: "auto",
    maxWidth: "token(spacing.full)",
    objectFit: "contain",
    display: "block",
    borderRadius: "sm",
    outline: "[none]",
  },
});

const mediaMetadataRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xl",
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  textStyle: "caption",
});

const mediaAltRowStyle = css({
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  alignSelf: "center",
});

const mediaDeleteRowStyle = css({
  display: "flex",
  justifyContent: "center",
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  alignSelf: "center",
});

const mediaThumbnailStyle = css({
  position: "relative",
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "xs",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "hidden",
  "& :is(img, video)": {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
});

export function ImageInsertDialog(props: ImageInsertDialogProps) {
  const {
    open,
    mode = "insert",
    initialPhase = "upload",
    accepts = "media",
    folder = "media",
    onClose,
    selectionMode = "single",
  } = props;
  const isMultiple = selectionMode === "multiple";
  const isDocument = accepts === "document";
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
    uploadIndex,
    uploadTotal,
    isDragOver,
    setIsDragOver,
    error,
    isBusy,
    processFiles,
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
    accepts,
    folder,
    ...(isMultiple ? { maxSelection } : {}),
  });

  const selectedCount = selectedKeys.length;
  const noun = isDocument ? "Document" : "Media";
  const title = `${mode === "change" ? "Change" : "Insert"} ${noun}`;
  const confirmLabel = isMultiple ? `Insert ${selectedCount} ${noun}` : title;

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
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) void processFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (isBusy || phase === "library") return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void processFiles(files);
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
                aria-label={`${noun} library`}
              >
                {assets.map((asset) => (
                  // `label` is the searchable, accessible text; the children are rich.
                  <OptionList.Option
                    key={asset.key}
                    value={asset.key}
                    label={asset.filename}
                    disabled={isBusy}
                  >
                    <span className={mediaThumbnailStyle}>
                      {isDocument ? (
                        <PageIcon aria-hidden />
                      ) : (
                        <Media
                          src={asset.url}
                          kind={mediaKindOf(asset.contentType)}
                          alt=""
                          width={asset.width}
                          height={asset.height}
                        />
                      )}
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
                {isMultiple && (
                  <p className={selectionCountStyle} aria-live="polite">
                    {selectedCount} of {maxSelection} selected
                  </p>
                )}
                <figure className={mediaPreviewStyle}>
                  {isDocument ? (
                    <PageIcon aria-hidden className={documentGlyphStyle} />
                  ) : (
                    <Media
                      src={selectedAsset.url}
                      kind={mediaKindOf(selectedAsset.contentType)}
                      alt={altText || selectedAsset.filename}
                      controls
                      width={selectedAsset.width}
                      height={selectedAsset.height}
                    />
                  )}
                </figure>
                <div className={mediaMetadataRowStyle}>
                  {/* Renames the display name only; the object key and any published URL are untouched. */}
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
                {!isDocument && (
                  <label className={mediaAltRowStyle}>
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
                )}
                <div className={mediaDeleteRowStyle}>
                  <Button
                    type="button"
                    variant="icon"
                    aria-label={`Delete ${noun.toLowerCase()}`}
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
        <div className={uploadBodySlotStyle}>
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
              <>
                <ProgressBar
                  value={uploadProgress}
                  label={`Uploading ${noun.toLowerCase()}`}
                />
                {uploadTotal > 1 && (
                  <p className={formatsStyle} aria-live="polite">
                    Uploading {uploadIndex} of {uploadTotal}
                  </p>
                )}
              </>
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
                  one or more files
                </div>
                <p className={formatsStyle}>
                  Supported formats: {FORMAT_NAMES[accepts]}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <footer className={dialogFooter()}>
        <div className={dialogFooterGroupStyle}>
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
        multiple
        accept={ACCEPT[accepts]}
        className={css({ display: "none" })}
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden
      />
    </Dialog>
  );
}
