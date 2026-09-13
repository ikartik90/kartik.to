import { downloadNameFor, type IconAsset, type IconSettings } from "@/domain/icon";
import { serializeIconSvg, type IconSvg } from "@/utils/icon-svg";
import { uniqueEntryName, zipArchive, type ZipEntry } from "@/utils/zip-archive";

// ---------------------------------------------------------------------------
// Taking icons off the page.
//
// What leaves is what is on screen: every file is baked at the size and weight
// the sliders are set to, through the same `serializeIconSvg` the grid draws
// with, so a download can never disagree with the thing it was taken from.
//
// One icon comes out as an icon. Two or more come out as an archive — the
// distinction is the download itself rather than a setting, because a zip
// holding one file is a folder you have to open before you can use what you
// asked for.
//
// Split three ways on purpose: what the files ARE is pure, what the browser is
// handed is a Blob, and the click that saves it is four lines of DOM at the
// end. Only the last of those cannot be tested at a desk.
// ---------------------------------------------------------------------------

/** An icon and its parsed file — `null` while (or if) the fetch has not landed. */
export interface ChosenIcon {
  icon: IconAsset;
  /**
   * Absent while the file is still on its way, `null` if it will not parse —
   * and a download skips both. There is nothing to bake either way, and the
   * two are only told apart on screen (`IconEntry`).
   */
  svg?: IconSvg | null;
}

export interface DownloadPlan {
  filename: string;
  blob: Blob;
}

/**
 * The chosen icons as files, named for the settings they were baked at.
 *
 * An icon whose source never arrived is skipped rather than written empty: a
 * zip with a 0-byte `check.svg` in it looks like a working download until the
 * moment it is used.
 */
export function iconFilesFor(
  chosen: ChosenIcon[],
  settings: IconSettings,
): ZipEntry[] {
  const taken = new Set<string>();
  const files: ZipEntry[] = [];

  for (const { icon, svg } of chosen) {
    if (!svg) continue;
    files.push({
      name: uniqueEntryName(downloadNameFor(icon.name, settings), taken),
      text: serializeIconSvg(svg, settings),
    });
  }

  return files;
}

/** What the archive is called — the set, and the settings it was taken at. */
export function archiveNameFor(settings: IconSettings): string {
  return `icons-${settings.size}-${settings.stroke}.zip`;
}

/** The file the browser is about to be handed, or nothing to hand it. */
export function downloadPlanFor(
  files: ZipEntry[],
  archiveName = "icons.zip",
): DownloadPlan | null {
  if (files.length === 0) return null;

  if (files.length === 1) {
    return {
      filename: files[0].name,
      blob: new Blob([files[0].text], { type: "image/svg+xml" }),
    };
  }

  return {
    filename: archiveName,
    // A fresh buffer, because `Blob` will not take a view over a larger one
    // and the archive is exactly its own length anyway.
    blob: new Blob([zipArchive(files).slice().buffer], { type: "application/zip" }),
  };
}

/**
 * Hand the plan to the browser. The object URL is released on the next tick —
 * the click has already been dispatched by then, and holding it would keep the
 * whole archive in memory for the life of the page.
 */
export function saveDownload(plan: DownloadPlan): void {
  const url = URL.createObjectURL(plan.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = plan.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
