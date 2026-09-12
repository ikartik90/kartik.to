"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMediaUploadUrl,
  deleteMedia,
  listMediaAssets,
  updateMediaAlt,
  updateMediaFilename,
} from "@/app/actions/media";
import {
  isAllowedMediaContentType,
  isDocumentContentType,
  maxUploadBytesFor,
  mediaKindOf,
  type MediaAsset,
  type MediaFolder,
} from "@/domain/media";
import type { MediaKind } from "@/domain/nodes";
import { measureMediaFile } from "@/utils/measure-media";
import { PROGRESS_COMPLETE_HOLD_MS } from "@/components/ui/progress-bar";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ImageInsertPhase = "upload" | "uploading" | "library";

export type ImageSelectionMode = "single" | "multiple";

/**
 * Which half of the bucket this dialog is opening.
 *
 * The bucket holds pictures, clips and documents behind one prefix, one signer
 * and one admin guard — but no surface ever wants two of those at once. An
 * article block wants something it can DRAW; the link card's document picker
 * wants a file to point at, and a PDF listed among the pictures would be a
 * thumbnail that cannot load and a preview pane with nothing in it.
 *
 * So the filter is the dialog's, not the library's: `listMediaAssets` still
 * returns everything, and this decides what is shown, what may be dropped on the
 * drop zone, and which formats the hint names.
 */
export type ImageInsertAccepts = "media" | "document";

export interface UseImageInsertOptions {
  open: boolean;
  initialPhase?: ImageInsertPhase;
  /**
   * `multiple` turns the library into a batch picker — the collection block
   * takes several images in one pass. `selectedKey` keeps its meaning either
   * way, but in `multiple` it stops being "the selection" and becomes the
   * ANCHOR: the last row touched, and so the one the metadata panel edits and
   * the delete button acts on.
   */
  selectionMode?: ImageSelectionMode;
  /** Hard cap on a multiple selection — the collection's remaining capacity. */
  maxSelection?: number;
  /** Pictures and clips (the default), or documents. */
  accepts?: ImageInsertAccepts;
  /**
   * Which folder of the bucket this dialog reads and writes — the media
   * library by default, `profiles` for the face beside a testimonial.
   *
   * ONE value for both halves on purpose. A dialog that listed the library but
   * uploaded into `profiles` would lose the picture the moment it was added:
   * the upload lands somewhere the list it just refreshed does not look.
   */
  folder?: MediaFolder;
  onReset?: () => void;
}

export interface ImageInsertPayload {
  src: string;
  alt?: string;
  /**
   * Which element the inserted node should render with — the ONE fact this
   * dialog knows first-hand that the document could not otherwise recover.
   *
   * Every asset in the library was validated against
   * `CreateMediaUploadInputSchema` on the way up and carries its content type
   * ever since, so the answer is sitting in `MediaAsset.contentType` at the
   * moment Insert is pressed. It used to be dropped here: the payload was an
   * src and an alt, and the renderer went back to guessing from the file
   * extension (`isVideoSource`) on every paint — a guess that is only as good
   * as the URL, and R2 keys are not obliged to carry an extension at all.
   *
   * Passing it through is what stops the unanswered set from growing. The
   * filename guess survives, but only as the backfill for documents written
   * before there was a field to write this in (see `withMediaKind`), and
   * nothing inserted from here on will ever need it.
   */
  kind: MediaKind;
  /**
   * The source's own pixel size, when the library knows it — measured at
   * upload and stored on the object ever since (`measureMediaFile`).
   *
   * It travels with `kind` because it is the same sort of fact: something the
   * library holds first-hand that the document cannot recover later. A surface
   * uses it to reserve the box the picture will need before a byte of it has
   * arrived (`mediaReservedAspect`), which is the difference between an
   * article that holds still while it loads and one that jolts open around
   * every image in it.
   *
   * Absent for everything uploaded before the measurement existed, and for
   * anything the browser declined to decode. Those fall back to the house
   * ratio and are merely reserved less exactly, never not at all.
   */
  width?: number;
  height?: number;
}

function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Upload failed — check that your R2 bucket CORS policy allows PUT from this origin (see scripts/r2-cors-policy.json)",
        ),
      );
    xhr.send(file);
  });
}

export function useImageInsert({
  open,
  initialPhase = "upload",
  selectionMode = "single",
  maxSelection = Number.POSITIVE_INFINITY,
  accepts = "media",
  folder = "media",
  onReset,
}: UseImageInsertOptions) {
  const isMultiple = selectionMode === "multiple";
  const [phase, setPhase] = useState<ImageInsertPhase>("upload");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // ORDERED, not a Set: the order images are picked in becomes the order of the
  // collection, and its first entry becomes the featured image.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [altText, setAltText] = useState("");
  const [filenameText, setFilenameText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  // Which file of the drop is on the wire, and how many there are — the bar
  // itself is one measure of the whole batch, so this is what says "3 of 5".
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const altSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAsset =
    assets.find((asset) => asset.key === selectedKey) ?? null;

  /**
   * Whether this dialog will show, take or insert a file of this type — see
   * {@link ImageInsertAccepts}.
   *
   * One predicate for the library filter AND the drop zone, deliberately: a
   * dialog that listed a format it would refuse on upload (or the reverse)
   * would be two answers to one question, and the mismatch only shows up at the
   * moment somebody drops a file.
   */
  const allows = useCallback(
    (contentType: string) =>
      accepts === "document"
        ? isDocumentContentType(contentType)
        : isAllowedMediaContentType(contentType),
    [accepts],
  );

  /** The half of the library this dialog is for, newest-first as it arrives. */
  const loadLibrary = useCallback(
    async () =>
      (await listMediaAssets(folder)).filter((a) => allows(a.contentType)),
    [allows, folder],
  );

  const reset = useCallback(() => {
    setPhase("upload");
    setAssets([]);
    setSelectedKey(null);
    setSelectedKeys([]);
    setAltText("");
    setFilenameText("");
    setUploadProgress(0);
    setUploadIndex(0);
    setUploadTotal(0);
    setIsDragOver(false);
    setError(null);
    setIsDeleting(false);
    if (altSaveTimer.current) {
      clearTimeout(altSaveTimer.current);
      altSaveTimer.current = null;
    }
    if (nameSaveTimer.current) {
      clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = null;
    }
    onReset?.();
  }, [onReset]);

  const refreshLibrary = useCallback(
    async (arrivals: string[] = []) => {
      const list = await loadLibrary();
      setAssets(list);
      // The anchor lands on the FIRST of an arrival: a drop of five reads top
      // down, so the panel opens on the one you would check first.
      const key = arrivals[0] ?? list[0]?.key ?? null;
      setSelectedKey(key);
      // Images uploaded mid-batch JOIN the batch rather than replacing it —
      // "upload a few more" is the natural way to finish a collection. Only an
      // arrival does this; the bare refresh that opens the library is just
      // parking the anchor and must not select anything.
      if (isMultiple && arrivals.length > 0) {
        setSelectedKeys((prev) => {
          const next = [...prev];
          for (const arrival of arrivals) {
            if (next.length >= maxSelection) break;
            if (!next.includes(arrival)) next.push(arrival);
          }
          return next;
        });
      }
      const asset = list.find((item) => item.key === key);
      setAltText(asset?.alt ?? "");
      setFilenameText(asset?.filename ?? "");
      return list;
    },
    [isMultiple, maxSelection, loadLibrary],
  );

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    (async () => {
      try {
        const list = await loadLibrary();
        if (ignore) return;
        setAssets(list);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Failed to load library");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [open, loadLibrary]);

  useEffect(() => {
    if (!open) {
      // Reset the form when the (externally controlled) dialog closes so it
      // reopens clean — syncing to the `open` prop, not deriving render state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open || initialPhase !== "library") return;

    let ignore = false;

    (async () => {
      try {
        await refreshLibrary();
        if (!ignore) setPhase("library");
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load library");
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [open, initialPhase, refreshLibrary]);

  /** Why the library will not take this file, or `null` if it will. */
  const refusalFor = useCallback(
    (file: File): string | null => {
      if (!allows(file.type)) return "Unsupported file type";
      // The ceiling depends on the format — a clip is allowed to be an order
      // larger than a picture. Same check the server makes when it signs the
      // upload; this one exists to answer before the round trip.
      if (file.size > maxUploadBytesFor(file.type)) return "File is too large";
      return null;
    },
    [allows],
  );

  /**
   * Upload everything that was dropped or picked — a drop is a BATCH, and one
   * file is only the shortest one.
   *
   * Sequential rather than parallel: five clips PUT at once share one uplink,
   * so nothing finishes sooner and the bar can no longer say which file it is
   * describing. What IS shared is the measure — progress is weighed across the
   * whole batch in bytes, so the bar fills once rather than snapping back to
   * zero on every file, and a 40MB clip dropped beside two screenshots does
   * not report itself two-thirds done before it has begun.
   *
   * A refusal is per FILE. Whatever the finder handed over is what arrives
   * here, and one `.mov` among four screenshots is a file to skip and name,
   * never a reason to throw the other four away. Same for a PUT that fails
   * mid-batch: the files either side of it still land.
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      if (files.length === 0) return;

      // A lone file is refused in its own words — naming it would be telling
      // somebody the name of the one file they just dropped.
      const describe = (file: File, reason: string) =>
        files.length === 1 ? reason : `${file.name}: ${reason}`;

      const accepted: File[] = [];
      const skipped: string[] = [];
      for (const file of files) {
        const refusal = refusalFor(file);
        if (refusal) skipped.push(describe(file, refusal));
        else accepted.push(file);
      }

      if (accepted.length === 0) {
        setError(skipped.join(", "));
        return;
      }

      setPhase("uploading");
      setUploadProgress(0);
      setUploadTotal(accepted.length);
      setUploadIndex(1);

      const totalBytes = accepted.reduce((sum, file) => sum + file.size, 0);
      let storedBytes = 0;
      const arrivals: string[] = [];

      for (const [index, file] of accepted.entries()) {
        setUploadIndex(index + 1);
        try {
          // Measured HERE, from the file in hand, and never again: this is the
          // only moment anything holds the bytes and the answer at the same
          // time. It rides into the signing request, so recording it costs no
          // round trip of its own — and `null` when the browser will not
          // decode the file, which the object simply stores without.
          const shape = await measureMediaFile(file);

          const { uploadUrl, key } = await createMediaUploadUrl({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            folder,
            ...(shape ?? {}),
          });

          await uploadFileWithProgress(uploadUrl, file, (percent) =>
            setUploadProgress(
              Math.round(
                ((storedBytes + (percent / 100) * file.size) / totalBytes) * 100,
              ),
            ),
          );
          arrivals.push(key);
        } catch (err) {
          skipped.push(
            describe(file, err instanceof Error ? err.message : "Upload failed"),
          );
        }
        storedBytes += file.size;
        setUploadProgress(Math.round((storedBytes / totalBytes) * 100));
      }

      // Nothing landed: stay on the drop zone, where the file can be tried
      // again, rather than showing an empty-handed library.
      if (arrivals.length === 0) {
        setError(skipped.join(", ") || "Upload failed");
        setPhase("upload");
        return;
      }

      setError(skipped.length > 0 ? skipped.join(", ") : null);
      // Hold the filled (100%) bar for a beat — overlapping the library
      // refresh — so the brand fill visibly completes before the view swaps.
      await Promise.all([
        refreshLibrary(arrivals),
        delay(PROGRESS_COMPLETE_HOLD_MS),
      ]);
      setPhase("library");
    },
    [refreshLibrary, refusalFor, folder],
  );

  const openLibrary = useCallback(async () => {
    setError(null);
    try {
      await refreshLibrary(selectedKey ? [selectedKey] : []);
      setPhase("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    }
  }, [refreshLibrary, selectedKey]);

  const goToUpload = useCallback(() => {
    setPhase("upload");
    setUploadProgress(0);
    setError(null);
  }, []);

  /** Move the anchor to `key` and load its metadata into the editable fields. */
  const anchorOn = useCallback(
    (key: string | null) => {
      setSelectedKey(key);
      const asset = assets.find((item) => item.key === key);
      setAltText(asset?.alt ?? "");
      setFilenameText(asset?.filename ?? "");
    },
    [assets],
  );

  /** A plain click: this image, and only this image. */
  const selectAsset = useCallback(
    (key: string) => {
      anchorOn(key);
      if (isMultiple) setSelectedKeys([key]);
    },
    [anchorOn, isMultiple],
  );

  /**
   * A modified click: add or drop one image, leaving the rest of the batch
   * alone. Deselecting always works — only ADDING can hit the cap — so a full
   * selection is still editable rather than stuck.
   */
  const toggleAsset = useCallback(
    (key: string) => {
      if (selectedKeys.includes(key)) {
        const next = selectedKeys.filter((item) => item !== key);
        setSelectedKeys(next);
        // Park the anchor on what's left, so the metadata panel keeps showing
        // something the batch still contains.
        anchorOn(next.at(-1) ?? key);
        return;
      }
      // The anchor moves even on a refused click — you pointed at the row, so
      // it should respond; the error is what explains the refusal.
      anchorOn(key);
      if (selectedKeys.length >= maxSelection) {
        setError(
          `You can select up to ${maxSelection} image${maxSelection === 1 ? "" : "s"}`,
        );
        return;
      }
      setError(null);
      setSelectedKeys([...selectedKeys, key]);
    },
    [anchorOn, maxSelection, selectedKeys],
  );

  const updateAltText = useCallback(
    (value: string) => {
      setAltText(value);
      if (!selectedKey) return;

      if (altSaveTimer.current) clearTimeout(altSaveTimer.current);
      altSaveTimer.current = setTimeout(async () => {
        try {
          const updated = await updateMediaAlt({ key: selectedKey, alt: value });
          setAssets((prev) =>
            prev.map((item) => (item.key === updated.key ? updated : item)),
          );
        } catch (err) {
          // Non-blocking — the typing is not interrupted and the text stands
          // — but a refusal is SAID. Swallowed, it read as the field
          // forgetting what you typed: the value held until the next refresh
          // and then sprang back to the stored one, unexplained.
          setError(err instanceof Error ? err.message : "Failed to save alt text");
        }
      }, 400);
    },
    [selectedKey],
  );

  /**
   * Rename for display only — the object key never changes, so URLs already
   * embedded in published articles keep working. Debounced like the alt text,
   * and a blank field is left unsaved (the stored name stands) rather than
   * writing an empty name.
   */
  const updateFilename = useCallback(
    (value: string) => {
      setFilenameText(value);
      if (!selectedKey || !value.trim()) return;

      if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = setTimeout(async () => {
        try {
          const updated = await updateMediaFilename({
            key: selectedKey,
            filename: value.trim(),
          });
          setAssets((prev) =>
            prev.map((item) => (item.key === updated.key ? updated : item)),
          );
        } catch (err) {
          // Said, not swallowed — see `updateAltText`.
          setError(err instanceof Error ? err.message : "Failed to rename file");
        }
      }, 400);
    },
    [selectedKey],
  );

  const deleteSelectedAsset = useCallback(async () => {
    if (!selectedKey) return;

    setError(null);
    setIsDeleting(true);
    const keyToDelete = selectedKey;

    if (altSaveTimer.current) {
      clearTimeout(altSaveTimer.current);
      altSaveTimer.current = null;
    }
    if (nameSaveTimer.current) {
      clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = null;
    }

    try {
      await deleteMedia({ key: keyToDelete });
      const remaining = assets.filter((item) => item.key !== keyToDelete);
      setAssets(remaining);
      // A deleted object can't stay in a batch that's about to be inserted.
      setSelectedKeys((prev) => prev.filter((key) => key !== keyToDelete));

      const nextKey = remaining[0]?.key ?? null;
      setSelectedKey(nextKey);
      const nextAsset = remaining.find((item) => item.key === nextKey);
      setAltText(nextAsset?.alt ?? "");
      setFilenameText(nextAsset?.filename ?? "");

      if (remaining.length === 0) {
        setPhase("upload");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setIsDeleting(false);
    }
  }, [assets, selectedKey]);

  const getInsertPayload = useCallback((): ImageInsertPayload | null => {
    if (!selectedAsset) return null;
    return {
      src: selectedAsset.url,
      alt: altText.trim() || undefined,
      kind: mediaKindOf(selectedAsset.contentType),
      width: selectedAsset.width,
      height: selectedAsset.height,
    };
  }, [selectedAsset, altText]);

  /**
   * The whole batch, in the order it was picked. Alt text comes from each
   * stored asset — except the ANCHOR, whose alt field may still be mid-debounce
   * (400ms) and therefore newer in local state than in `assets`.
   */
  const getInsertPayloads = useCallback((): ImageInsertPayload[] => {
    return selectedKeys.flatMap((key) => {
      const asset = assets.find((item) => item.key === key);
      if (!asset) return [];
      const alt = key === selectedKey ? altText : (asset.alt ?? "");
      return [
        {
          src: asset.url,
          alt: alt.trim() || undefined,
          kind: mediaKindOf(asset.contentType),
          width: asset.width,
          height: asset.height,
        },
      ];
    });
  }, [selectedKeys, assets, selectedKey, altText]);

  const isBusy = phase === "uploading" || isDeleting;

  return {
    phase,
    assets,
    hasLibraryImages: assets.length > 0,
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
    reset,
  };
}
