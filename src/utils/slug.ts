/**
 * Derives a URL-safe slug from a title string.
 * Falls back to a timestamp-based slug for untitled content.
 */
export function generateSlug(title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) {
    const slug = trimmed
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (slug) return slug;
  }
  return `untitled-${Date.now()}`;
}
