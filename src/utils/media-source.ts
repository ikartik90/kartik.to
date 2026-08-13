// ---------------------------------------------------------------------------
// What KIND of thing a media src points at.
//
// A document stores a picture and a clip identically — an `src` and an `alt`,
// nothing else (see `ImageNodeSchema`) — so the element to render one with has
// to be read back off the URL. The content type is known at UPLOAD time and
// nowhere afterwards: it lives on the R2 object, and the renderer has only the
// public URL. Adding a `kind` to the schema would ask every document ever
// written to carry a field that the filename already answers.
// ---------------------------------------------------------------------------

/** The extensions rendered as a `<video>`; everything else is a picture. */
const VIDEO_EXTENSIONS = ["mp4"];

/**
 * The lowercase extension of a src, or `""` for one without — a bare R2 key,
 * or a data URL. Reads past the query and hash a CDN url may carry.
 */
export function sourceExtension(src: string): string {
  const path = src.split(/[?#]/, 1)[0];
  const file = path.slice(path.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot + 1).toLowerCase();
}

/**
 * Whether this src should be played rather than shown.
 *
 * Biased towards NO: an unrecognised source renders as a picture, which is
 * what every src written before videos were accepted actually is. A wrong
 * guess this way shows a broken image; the other way would silently turn every
 * extensionless legacy key into an empty video element.
 */
export function isVideoSource(src: string): boolean {
  return VIDEO_EXTENSIONS.includes(sourceExtension(src));
}
