import { toProcessedGemSmoke } from "@paper-design/shaders";

// Runs GemSmoke's costly pre-pass once per mask, ahead of hover. Don't mount the
// shader until its mask is ready: there is no unmasked fallback.
const MASK_PX = 256; // Rasterised first: handed an SVG, the pre-pass works at 4096².

const prepared = new Map<string, HTMLImageElement>();
const inFlight = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Could not load shader mask at ${src}`));
    image.src = src;
  });
}

async function rasterize(src: string): Promise<{ url: string; own: boolean }> {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_PX;
  canvas.height = MASK_PX;
  const context = canvas.getContext("2d");
  if (!context) return { url: src, own: false };

  const source = await loadImage(src);
  context.drawImage(source, 0, 0, MASK_PX, MASK_PX);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return { url: src, own: false };
  return { url: URL.createObjectURL(blob), own: true };
}

async function prepare(src: string): Promise<HTMLImageElement> {
  const raster = await rasterize(src);
  try {
    const { pngBlob } = await toProcessedGemSmoke(raster.url);
    const processedUrl = URL.createObjectURL(pngBlob);
    try {
      return await loadImage(processedUrl);
    } finally {
      URL.revokeObjectURL(processedUrl);
    }
  } finally {
    if (raster.own) URL.revokeObjectURL(raster.url);
  }
}

export function prepareGemSmokeMask(src: string): Promise<HTMLImageElement> {
  const done = prepared.get(src);
  if (done) return Promise.resolve(done);

  let work = inFlight.get(src);
  if (!work) {
    work = prepare(src)
      .then((image) => {
        prepared.set(src, image);
        inFlight.delete(src);
        return image;
      })
      .catch((error) => {
        inFlight.delete(src); // allow a retry on the next hover
        throw error;
      });
    inFlight.set(src, work);
  }
  return work;
}

export function preparedGemSmokeMask(src: string): HTMLImageElement | null {
  return prepared.get(src) ?? null;
}

/** Test-only. */
export function __resetGemSmokeMasks(): void {
  prepared.clear();
  inFlight.clear();
}
