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

/** What the dialog lists, accepts and names: drawable media, or documents. */
export type ImageInsertAccepts = "media" | "document";

export interface UseImageInsertOptions {
  open: boolean;
  initialPhase?: ImageInsertPhase;
  /** In `multiple`, `selectedKey` is the anchor: the row the panel edits and delete acts on. */
  selectionMode?: ImageSelectionMode;
  /** Hard cap on a multiple selection — the collection's remaining capacity. */
  maxSelection?: number;
  accepts?: ImageInsertAccepts;
  /** Used for both listing and uploads, so an upload lands where the list looks. */
  folder?: MediaFolder;
  onReset?: () => void;
}

export interface ImageInsertPayload {
  src: string;
  alt?: string;
  /** From the asset's stored content type, so the renderer needn't guess from the extension. */
  kind: MediaKind;
  /** The source's pixel size when measured at upload; lets a surface reserve its box. */
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
  // Ordered, not a Set: pick order becomes collection order, and the first is featured.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [altText, setAltText] = useState("");
  const [filenameText, setFilenameText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const altSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAsset =
    assets.find((asset) => asset.key === selectedKey) ?? null;

  /** One predicate for the library filter and the drop zone, so they can't disagree. */
  const allows = useCallback(
    (contentType: string) =>
      accepts === "document"
        ? isDocumentContentType(contentType)
        : isAllowedMediaContentType(contentType),
    [accepts],
  );

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
      const key = arrivals[0] ?? list[0]?.key ?? null;
      setSelectedKey(key);
      // Arrivals join a multiple selection; the bare refresh that opens the library selects nothing.
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
      // Syncs to the external `open` prop so the dialog reopens clean.
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

  const refusalFor = useCallback(
    (file: File): string | null => {
      if (!allows(file.type)) return "Unsupported file type";
      if (file.size > maxUploadBytesFor(file.type)) return "File is too large";
      return null;
    },
    [allows],
  );

  /**
   * Uploads a batch one file at a time, progress weighted by bytes across the batch.
   * A refused or failed file is skipped and named; the rest still land.
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      if (files.length === 0) return;

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
          // Measured now, the only time the bytes are in hand; null when the browser can't decode it.
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

      if (arrivals.length === 0) {
        setError(skipped.join(", ") || "Upload failed");
        setPhase("upload");
        return;
      }

      setError(skipped.length > 0 ? skipped.join(", ") : null);
      // Hold the full bar for a beat while the library refreshes.
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

  const anchorOn = useCallback(
    (key: string | null) => {
      setSelectedKey(key);
      const asset = assets.find((item) => item.key === key);
      setAltText(asset?.alt ?? "");
      setFilenameText(asset?.filename ?? "");
    },
    [assets],
  );

  const selectAsset = useCallback(
    (key: string) => {
      anchorOn(key);
      if (isMultiple) setSelectedKeys([key]);
    },
    [anchorOn, isMultiple],
  );

  const toggleAsset = useCallback(
    (key: string) => {
      if (selectedKeys.includes(key)) {
        const next = selectedKeys.filter((item) => item !== key);
        setSelectedKeys(next);
        anchorOn(next.at(-1) ?? key);
        return;
      }
      // The anchor moves even when the cap refuses the add.
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
          setError(err instanceof Error ? err.message : "Failed to save alt text");
        }
      }, 400);
    },
    [selectedKey],
  );

  /** Display name only: the object key, and so every embedded URL, never changes. Blank isn't saved. */
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

  /** In pick order; the anchor's alt comes from local state, which may be ahead of a pending save. */
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
