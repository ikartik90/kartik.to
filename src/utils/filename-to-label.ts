/** Derive a display label from a kebab/snake-case filename stem. */
export function filenameToLabel(filename: string): string {
  return filename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
