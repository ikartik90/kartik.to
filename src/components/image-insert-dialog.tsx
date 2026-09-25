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

// This is the one surface that shows media it holds as an ASSET rather than as
// a document node, so there is no `kind` field to read — and it needs none,
// because the content type it does have is where a node's `kind` comes from in
// the first place. `mediaKindOf` is the same call `getInsertPayload` makes one
// step later (see `ImageInsertPayload.kind`), so the pane you check a file in
// and the block that file becomes cannot disagree about which element it is.

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

// Built from the allow-lists rather than restated, so the file picker cannot
// drift from what `processFiles` and the server will actually take.
const ACCEPT = {
  media: ALLOWED_MEDIA_CONTENT_TYPES.join(","),
  document: ALLOWED_DOCUMENT_CONTENT_TYPES.join(","),
} as const;

/** The same lists as `ACCEPT`, for the hint under the drop zone. */
const FORMAT_NAMES = {
  media: "PNG, SVG, WEBP, JPG, GIF, MP4",
  document: "PDF",
} as const;

/**
 * A document's stand-in in the list and in the preview pane.
 *
 * There is no element that draws a PDF, and nothing here tries: the pane's job
 * is to let you check WHICH file you are about to point at, and the name, the
 * type and the size below it answer that. An `<embed>` of a document would be a
 * second document viewer to keep working in two browsers for a preview nobody
 * reads at 280px.
 */
const documentGlyphStyle = css({
  width: "40px",
  height: "40px",
  color: "text.body/50",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ImageDialogMode = "insert" | "change";

interface ImageInsertDialogBaseProps {
  open: boolean;
  mode?: ImageDialogMode;
  initialPhase?: ImageInsertPhase;
  /**
   * Which half of the bucket this is opening — pictures and clips by default,
   * or documents. See {@link ImageInsertAccepts}: it decides what the library
   * lists, what the drop zone takes and what the dialog calls itself.
   */
  accepts?: ImageInsertAccepts;
  /**
   * Which folder of the bucket to list and upload into. See {@link
   * MediaFolder} — `profiles` keeps testimonial faces out of the library.
   */
  folder?: MediaFolder;
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

// Left-aligned button cluster in dialog footer.
const dialogFooterGroupStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
});

// Flex-grow region that centers the upload block in the dialog content area
// (Figma y=156 in 480px shell).
const uploadBodySlotStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: "1 1 0%",
  width: "100%",
  minHeight: 0,
});

// Large image preview in insert-image library view. HEIGHT is the only fixed
// dimension (280px) — the width hugs the image's own aspect ratio and stretches
// at most to the pane's content box (`maxWidth: 100%` resolves against the flex
// container's content box, so the pane's padding is excluded). Fixed rather
// than max height so the metadata rows below hold their position as you switch
// images; `object-fit: contain` letterboxes anything the width clamp squeezes.
// The library holds clips as well as pictures, so the inner rule names both
// elements — a <video> is a replaced element with the same box model, and the
// rule is about the BOX, not about what fills it.
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

// Filename and file-size row below preview.
const mediaMetadataRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xl",
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  textStyle: "caption",
});

// Alt-text field row below metadata.
const mediaAltRowStyle = css({
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  alignSelf: "center",
});

// Delete action row below alt text in media preview.
const mediaDeleteRowStyle = css({
  display: "flex",
  justifyContent: "center",
  width: "100%",
  maxWidth: "token(sizes.imagePreviewMax)",
  minWidth: 0,
  alignSelf: "center",
});

// Small thumbnail in image library sidebar. Names <video> alongside <img> — a
// clip's row shows a live thumbnail of itself, filling the same square.
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
  // "Media" is the dialog's noun throughout — the library holds clips as well
  // as stills. It is also a mass noun, so the batch count rides along without
  // inflecting the way "1 Image / 2 Images" did. A document dialog says
  // "Document" for the same reason it lists nothing but documents: what you are
  // picking is the whole difference between the two, and calling both of them
  // "Media" would leave the two surfaces indistinguishable at the header.
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
                aria-label={`${noun} library`}
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
                    <span className={mediaThumbnailStyle}>
                      {/* The row's own `label` is the accessible name, so the
                          thumbnail is decorative either way. */}
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
                {/* The pane below edits ONE image — the anchor, i.e. whichever
                    row you touched last. This line is what keeps that honest
                    when the batch is larger than what's on screen. */}
                {isMultiple && (
                  <p className={selectionCountStyle} aria-live="polite">
                    {selectedCount} of {maxSelection} selected
                  </p>
                )}
                <figure className={mediaPreviewStyle}>
                  {/* Controls here and not on the thumbnail: this pane is
                      where you check what you are about to insert, and for a
                      clip that means being able to scrub it. */}
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
                {/* Nothing draws a document, so there is no picture for a
                    description to stand in for — alt text on one would be a
                    field with no reader. */}
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
                {/* The bar measures the whole drop in bytes, so on its own it
                    cannot say how far through the FILES you are — which is the
                    only question worth asking of a batch that is part way up. */}
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
        // A library is a place files LIVE, not a queue of exactly what this
        // block needs — uploading five and inserting one of them is ordinary,
        // so the batch is allowed even where the selection is single.
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
