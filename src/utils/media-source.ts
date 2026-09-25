// Guesses from a filename. Wherever a media node or an upload is in hand, use its `kind` instead.

const VIDEO_EXTENSIONS = ["mp4"];

/** `""` for a bare R2 key or a data URL; ignores any query and hash. */
export function sourceExtension(src: string): string {
  const path = src.split(/[?#]/, 1)[0];
  const file = path.slice(path.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot + 1).toLowerCase();
}

/** Biased to no: an unrecognised source renders as a picture. */
export function isVideoSource(src: string): boolean {
  return VIDEO_EXTENSIONS.includes(sourceExtension(src));
}
