// ---------------------------------------------------------------------------
// What KIND of thing a media src points at — guessed from its name.
//
// This used to be the answer. A document stored a picture and a clip
// identically — an `src` and an `alt`, nothing else — so the element to render
// one with had to be read back off the URL, and the argument against a schema
// field was that it would ask every document ever written to carry something
// the filename already answered.
//
// That argument was wrong in one direction it did not consider: the filename
// answers for documents already written, but it goes on answering for every
// document written AFTER, and the content type was in hand at upload the whole
// time (`MediaAssetSchema.contentType`). A media node now records it as `kind`
// (`MediaNodeSchema`), the insert path carries it there from the upload, and
// this file is left with exactly one caller:
//
//   • `withMediaKind`, backfilling documents authored before `kind` existed —
//     once each, on the way in. That one is permanent, because a document is
//     only rewritten if somebody edits it.
//
// Nothing renders off this any more. `Media` takes a required `kind` and does
// not look at the src at all, precisely so that a caller cannot fall back into
// guessing by forgetting to pass it.
//
// `sourceExtension` has a second caller, `formatCanCarryAlpha` in
// `image-transparency`, and the distinction it now rests on is worth stating
// because it did not hold when it was first written down. That function asks
// whether a picture's format could carry an alpha channel — is this a JPEG, or
// something that might be see-through — which is a question about a file
// already known to be a picture. It is NOT a picture-vs-clip test, and the
// claim that it never was would have been false: its opaque list carried
// `"mp4"`, put there so a clip would be excluded before the scan handed a video
// to `new Image()`. That made a render path decide the fork from a filename,
// which is the guess this whole field exists to retire, and it could not even
// do it — a clip under a bare R2 key has no extension, so the one case that
// mattered slipped through and got decoded as a picture anyway. The grid now
// filters on the item's `kind` before asking, the `"mp4"` is gone, and the two
// questions are finally separate.
//
// Neither caller is a reason to reach for this in new code. Anywhere a media
// node or an upload is in hand, its own word is the answer and this is the
// wrong question.
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
