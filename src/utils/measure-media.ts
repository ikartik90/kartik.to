import { mediaKindOf } from "@/domain/media";

export interface MediaDimensions {
  width: number;
  height: number;
}

const MEASURE_TIMEOUT_MS = 3000;

/** Never rejects: an upload isn't worth failing over a measurement. */
export function measureMediaFile(file: File): Promise<MediaDimensions | null> {
  const isClip = mediaKindOf(file.type) === "video";
  const url = URL.createObjectURL(file);

  return new Promise<MediaDimensions | null>((resolve) => {
    const element = document.createElement(isClip ? "video" : "img");

    // `done` is hoisted: it and the timer refer to each other, and both run after this line.
    const abandon = setTimeout(() => done(null), MEASURE_TIMEOUT_MS);
    function done(dimensions: MediaDimensions | null) {
      clearTimeout(abandon);
      URL.revokeObjectURL(url);
      resolve(dimensions);
    }

    element.addEventListener("error", () => done(null), { once: true });
    element.addEventListener(
      isClip ? "loadedmetadata" : "load",
      () => {
        const width = isClip
          ? (element as HTMLVideoElement).videoWidth
          : (element as HTMLImageElement).naturalWidth;
        const height = isClip
          ? (element as HTMLVideoElement).videoHeight
          : (element as HTMLImageElement).naturalHeight;
        // Zero means nothing decoded (e.g. an SVG with no intrinsic size); the schema refuses it.
        done(width && height ? { width, height } : null);
      },
      { once: true },
    );

    if (isClip) (element as HTMLVideoElement).preload = "metadata";
    element.src = url;
  });
}
