const IMAGE_TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG Image",
  "image/jpeg": "JPEG Image",
  "image/jpg": "JPEG Image",
  "image/gif": "GIF Image",
  "image/webp": "WEBP Image",
  "image/svg+xml": "SVG Image",
};

/** Human-readable byte size for media metadata rows. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short label derived from a MIME type, e.g. "GIF Image". */
export function formatImageType(contentType: string): string {
  return IMAGE_TYPE_LABELS[contentType.toLowerCase()] ?? "Image";
}
