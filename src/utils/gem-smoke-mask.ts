import { toProcessedGemSmoke } from "@paper-design/shaders";

// ---------------------------------------------------------------------------
// A GemSmoke mask, prepared once.
//
// `<GemSmoke image="…">` does NOT hand its image straight to the GPU. It first
// runs the shader's own pre-pass — a Poisson solve at 512², 32 iterations —
// turning the silhouette into the edge-gradient/alpha texture the fragment
// shader samples. That pre-pass is the expensive part of this effect (~100ms+
// each), and the component reruns it every time its `image` prop changes: with
// ONE shader moved between four icons, that is a stall and a visible flash on
// every hover, because until the pass finishes the shader renders against a
// transparent placeholder — i.e. unmasked, filling its whole box.
//
// So the pre-pass happens HERE instead, ahead of the hover and once per mask,
// and the shader is handed the finished texture. Two consequences worth
// keeping: the caller must not mount the shader until its mask is ready (there
// is no unmasked state to fall back to), and swapping icons afterwards costs
// one small texture upload.
//
// The source SVGs are rasterised to `MASK_PX` first. Handed an SVG directly,
// the pre-pass rasterises it at 4096² before downsampling — sixteen megapixels
// for a 20px icon. The icons draw at 40 device pixels, so 256 is already
// several times the resolution anything downstream can show.
// ---------------------------------------------------------------------------

const MASK_PX = 256;

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

/** The mask at `MASK_PX`, as a blob URL — or the original if it can't be drawn. */
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
      // The decoded image holds the pixels; the URL has done its job.
      URL.revokeObjectURL(processedUrl);
    }
  } finally {
    if (raster.own) URL.revokeObjectURL(raster.url);
  }
}

/**
 * The processed texture for `src`, computed once per mask and shared by every
 * caller. Concurrent requests for the same mask wait on the same pass.
 */
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

/** The mask, if it has already been prepared — no work, no promise. */
export function preparedGemSmokeMask(src: string): HTMLImageElement | null {
  return prepared.get(src) ?? null;
}

/** Test-only: forget prepared masks so cases start cold. */
export function __resetGemSmokeMasks(): void {
  prepared.clear();
  inFlight.clear();
}
