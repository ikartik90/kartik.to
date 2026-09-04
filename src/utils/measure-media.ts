import { mediaKindOf } from "@/domain/media";

// ---------------------------------------------------------------------------
// How big is this file, really — asked once, of the file itself, at upload.
//
// A media object's SHAPE is the one thing a surface needs before the source has
// arrived and the one thing an unloaded source cannot be asked for. Without it
// a box sized by its picture is zero pixels tall until the bytes land and then
// jolts open under whatever is below it (`mediaReservationStyle`). The answer
// exists exactly once, at the moment a file is picked: the browser holds the
// file, so it can decode it and read the size straight off the element.
//
// So it is read there and written down — into the object's own metadata, and
// from there into every node that ever points at it. The alternative is
// measuring on every paint, which is precisely what the measurement is supposed
// to make unnecessary: by the time an element can report a size it has already
// loaded, and the box it should have been holding is a box it no longer needs.
//
// The picture/clip fork is the CONTENT TYPE's, the same one `mediaKindOf`
// answers for the element a document renders with. An <img> cannot decode an
// mp4, so guessing wrong here is not a slightly worse measurement — it is no
// measurement at all, for every clip in the library.
// ---------------------------------------------------------------------------

export interface MediaDimensions {
  width: number;
  height: number;
}

/**
 * How long to wait for a decode before giving the file up as unmeasurable.
 *
 * A guard, not a budget. A local file resolves in a frame or two, and the two
 * outcomes this exists for — a decoder that stalls, or a source that fires
 * neither `load` nor `error` — would otherwise hold the upload open forever
 * for the sake of an optimisation. The picture still uploads; it just reserves
 * its box at the house ratio, exactly as everything already in the bucket does.
 */
const MEASURE_TIMEOUT_MS = 3000;

/**
 * The file's intrinsic size, or `null` if the browser will not tell us.
 *
 * Never throws and never rejects. The dimensions are an optimisation — a box
 * reserved at the right shape rather than at the house one — so a source that
 * will not decode is uploaded without them and falls back to the placeholder,
 * exactly as every file uploaded before this existed does. An upload is not
 * worth failing over a measurement.
 */
export function measureMediaFile(file: File): Promise<MediaDimensions | null> {
  const isClip = mediaKindOf(file.type) === "video";
  const url = URL.createObjectURL(file);

  return new Promise<MediaDimensions | null>((resolve) => {
    const element = document.createElement(isClip ? "video" : "img");

    // The two refer to each other — the settler clears the timer, the timer
    // settles — so `done` is a hoisted declaration rather than a const. Every
    // path into it runs off an event or the timer, both of which are later
    // than this line, so the timer is always assigned by the time it is read.
    const abandon = setTimeout(() => done(null), MEASURE_TIMEOUT_MS);
    function done(dimensions: MediaDimensions | null) {
      clearTimeout(abandon);
      URL.revokeObjectURL(url);
      resolve(dimensions);
    }

    element.addEventListener("error", () => done(null), { once: true });
    // `loadedmetadata` for a clip and `load` for a picture: the header is all a
    // measurement needs, and waiting for a frame would mean fetching one.
    element.addEventListener(
      isClip ? "loadedmetadata" : "load",
      () => {
        const width = isClip
          ? (element as HTMLVideoElement).videoWidth
          : (element as HTMLImageElement).naturalWidth;
        const height = isClip
          ? (element as HTMLVideoElement).videoHeight
          : (element as HTMLImageElement).naturalHeight;
        // Zero is what an element that decoded NOTHING reports — an SVG with no
        // intrinsic size among them — and it is the one value that must not
        // reach the document: a stored `0` is a claim no picture can satisfy,
        // and the schema refuses it in any case.
        done(width && height ? { width, height } : null);
      },
      { once: true },
    );

    if (isClip) (element as HTMLVideoElement).preload = "metadata";
    element.src = url;
  });
}
