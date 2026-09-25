import type { MediaShape } from "@/domain/nodes";

/** Lets Satori round the picture, not its letterbox; null when the shape was never recorded. */
export function containedSize(
  shape: MediaShape,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } | null {
  const { width, height } = shape;
  if (!width || !height) return null;
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
}
