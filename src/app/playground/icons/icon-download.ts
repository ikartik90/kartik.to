import { downloadNameFor, type IconAsset, type IconSettings } from "@/domain/icon";
import { serializeIconSvg, type IconSvg } from "@/utils/icon-svg";
import { uniqueEntryName, zipArchive, type ZipEntry } from "@/utils/zip-archive";

export interface ChosenIcon {
  icon: IconAsset;
  /** Absent while in flight; `null` if it will not parse. */
  svg?: IconSvg | null;
}

export interface DownloadPlan {
  filename: string;
  blob: Blob;
}

/** The chosen icons as files named for their settings; icons with no parsed file are skipped. */
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

export function archiveNameFor(settings: IconSettings): string {
  return `icons-${settings.size}-${settings.stroke}.zip`;
}

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
    // A fresh buffer: the view's own may be larger than the archive.
    blob: new Blob([zipArchive(files).slice().buffer], { type: "application/zip" }),
  };
}

/** Hands the plan to the browser; the object URL is revoked on the next tick. */
export function saveDownload(plan: DownloadPlan): void {
  const url = URL.createObjectURL(plan.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = plan.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
