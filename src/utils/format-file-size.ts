const MEDIA_TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG Image",
  "image/jpeg": "JPEG Image",
  "image/jpg": "JPEG Image",
  "image/gif": "GIF Image",
  "image/webp": "WEBP Image",
  "image/svg+xml": "SVG Image",
  "video/mp4": "MP4 Video",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMediaType(contentType: string): string {
  return MEDIA_TYPE_LABELS[contentType.toLowerCase()] ?? "File";
}
