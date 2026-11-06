import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export interface SegmentEntry {
  /** The page, or not-found page, which imports `sheet`. */
  entry: string;
  /** The layouts it renders inside, outermost first, then itself: what its sheet is made from. */
  files: string[];
  sheet: string;
}

// Layouts have no sheet: each page's holds its layouts' styles, and a 404 brings the not-found page's.
const ENTRY = /^(page|not-found)\.tsx$/;

/** Every page and not-found page under `appDir`, each with the stylesheet that sits beside it. */
export function segmentEntries(appDir: string): SegmentEntry[] {
  const files = readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((file) => file.isFile() && !file.parentPath.split(sep).includes("__tests__"))
    .map((file) => join(file.parentPath, file.name));
  const layouts = new Set(files.filter((file) => file.endsWith(`${sep}layout.tsx`)));

  return files
    .filter((file) => ENTRY.test(file.slice(file.lastIndexOf(sep) + 1)))
    .map((entry) => {
      const parts = relative(appDir, dirname(entry)).split(sep).filter(Boolean);
      const above = [appDir, ...parts.map((_, i) => join(appDir, ...parts.slice(0, i + 1)))]
        .map((folder) => join(folder, "layout.tsx"))
        .filter((layout) => layouts.has(layout));
      return { entry, files: [...above, entry], sheet: entry.replace(/\.tsx$/, ".styles.css") };
    })
    .sort((a, b) => a.entry.localeCompare(b.entry));
}
