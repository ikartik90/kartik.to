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
  maxUploadBytesFor,
  type MediaAsset,
} from "@/domain/media";
import { PROGRESS_COMPLETE_HOLD_MS } from "@/components/ui/progress-bar";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ImageInsertPhase = "upload" | "uploading" | "library";

export type ImageSelectionMode = "single" | "multiple";

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
  onReset?: () => void;
}

export interface ImageInsertPayload {
  src: string;
  alt?: string;
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const altSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAsset =
    assets.find((asset) => asset.key === selectedKey) ?? null;

  const reset = useCallback(() => {
    setPhase("upload");
    setAssets([]);
    setSelectedKey(null);
    setSelectedKeys([]);
    setAltText("");
    setFilenameText("");
    setUploadProgress(0);
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
    async (selectKey?: string) => {
      const list = await listMediaAssets();
      setAssets(list);
      const key = selectKey ?? list[0]?.key ?? null;
      setSelectedKey(key);
      // An image uploaded mid-batch JOINS the batch rather than replacing it —
      // "upload one more" is the natural way to finish a collection. Only an
      // explicit key does this; the bare refresh that opens the library is just
      // parking the anchor and must not select anything.
      if (isMultiple && selectKey) {
        setSelectedKeys((prev) =>
          prev.includes(selectKey) || prev.length >= maxSelection
            ? prev
            : [...prev, selectKey],
        );
      }
      const asset = list.find((item) => item.key === key);
      setAltText(asset?.alt ?? "");
      setFilenameText(asset?.filename ?? "");
      return list;
    },
    [isMultiple, maxSelection],
  );

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    (async () => {
      try {
        const list = await listMediaAssets();
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
  }, [open]);

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

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!isAllowedMediaContentType(file.type)) {
        setError("Unsupported file type");
        return;
      }

      // The ceiling depends on the format — a clip is allowed to be an order
      // larger than a picture. Same check the server makes when it signs the
      // upload; this one exists to answer before the round trip.
      if (file.size > maxUploadBytesFor(file.type)) {
        setError("File is too large");
        return;
      }

      setPhase("uploading");
      setUploadProgress(0);

      try {
        const { uploadUrl, key } = await createMediaUploadUrl({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        await uploadFileWithProgress(uploadUrl, file, setUploadProgress);
        // Hold the filled (100%) bar for a beat — overlapping the library
        // refresh — so the brand fill visibly completes before the view swaps.
        await Promise.all([
          refreshLibrary(key),
          delay(PROGRESS_COMPLETE_HOLD_MS),
        ]);
        setPhase("library");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setPhase("upload");
      }
    },
    [refreshLibrary],
  );

  const openLibrary = useCallback(async () => {
    setError(null);
    try {
      await refreshLibrary(selectedKey ?? undefined);
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
        } catch {
          // Non-blocking — alt stays in local state until retry
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
        } catch {
          // Non-blocking — the name stays in local state until retry
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
      return [{ src: asset.url, alt: alt.trim() || undefined }];
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
    reset,
  };
}
