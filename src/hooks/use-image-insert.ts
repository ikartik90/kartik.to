"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMediaUploadUrl,
  deleteMedia,
  listMediaAssets,
  updateMediaAlt,
} from "@/app/actions/media";
import {
  isAllowedImageContentType,
  MAX_IMAGE_UPLOAD_BYTES,
  type MediaAsset,
} from "@/domain/media";
import { PROGRESS_COMPLETE_HOLD_MS } from "@/components/ui/progress-bar";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ImageInsertPhase = "upload" | "uploading" | "library";

export interface UseImageInsertOptions {
  open: boolean;
  initialPhase?: ImageInsertPhase;
  onReset?: () => void;
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
  onReset,
}: UseImageInsertOptions) {
  const [phase, setPhase] = useState<ImageInsertPhase>("upload");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const altSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAsset =
    assets.find((asset) => asset.key === selectedKey) ?? null;

  const reset = useCallback(() => {
    setPhase("upload");
    setAssets([]);
    setSelectedKey(null);
    setAltText("");
    setUploadProgress(0);
    setIsDragOver(false);
    setError(null);
    setIsDeleting(false);
    if (altSaveTimer.current) {
      clearTimeout(altSaveTimer.current);
      altSaveTimer.current = null;
    }
    onReset?.();
  }, [onReset]);

  const refreshLibrary = useCallback(async (selectKey?: string) => {
    const list = await listMediaAssets();
    setAssets(list);
    const key = selectKey ?? list[0]?.key ?? null;
    setSelectedKey(key);
    const asset = list.find((item) => item.key === key);
    setAltText(asset?.alt ?? "");
    return list;
  }, []);

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

      if (!isAllowedImageContentType(file.type)) {
        setError("Unsupported file type");
        return;
      }

      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
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

  const selectAsset = useCallback(
    (key: string) => {
      setSelectedKey(key);
      const asset = assets.find((item) => item.key === key);
      setAltText(asset?.alt ?? "");
    },
    [assets],
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

  const deleteSelectedAsset = useCallback(async () => {
    if (!selectedKey) return;

    setError(null);
    setIsDeleting(true);
    const keyToDelete = selectedKey;

    if (altSaveTimer.current) {
      clearTimeout(altSaveTimer.current);
      altSaveTimer.current = null;
    }

    try {
      await deleteMedia({ key: keyToDelete });
      const remaining = assets.filter((item) => item.key !== keyToDelete);
      setAssets(remaining);

      const nextKey = remaining[0]?.key ?? null;
      setSelectedKey(nextKey);
      setAltText(remaining.find((item) => item.key === nextKey)?.alt ?? "");

      if (remaining.length === 0) {
        setPhase("upload");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setIsDeleting(false);
    }
  }, [assets, selectedKey]);

  const getInsertPayload = useCallback(() => {
    if (!selectedAsset) return null;
    return {
      src: selectedAsset.url,
      alt: altText.trim() || undefined,
    };
  }, [selectedAsset, altText]);

  const isBusy = phase === "uploading" || isDeleting;

  return {
    phase,
    assets,
    hasLibraryImages: assets.length > 0,
    selectedKey,
    selectedAsset,
    altText,
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
    deleteSelectedAsset,
    getInsertPayload,
    reset,
  };
}
