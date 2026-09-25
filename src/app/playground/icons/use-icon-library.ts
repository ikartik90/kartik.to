"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIconUploadUrl,
  deleteIcon,
  finalizeIconUpload,
  listHeldIcons,
  listIcons,
  setIconLabels,
  setIconReview,
} from "@/app/actions/icon-set";
import type { PrerenderedIcon } from "@/lib/icons";
import { MAX_ICON_BYTES, type IconAsset } from "@/domain/icon";
import { readIconSvg, type IconSvg } from "@/utils/icon-svg";
import type { IconLabelEdit } from "./icon-labels-group";

/** `svg` is undefined until the file arrives and null if it is not an icon; never merge the two. */
export interface IconEntry {
  icon: IconAsset;
  svg?: IconSvg | null;
}

export interface IconLibrary {
  entries: IconEntry[];
  /** True until the first listing has landed — nothing is known before it. */
  loading: boolean;
  /** True until the listing and every file are in; latched, so a later upload does not re-show the preloader. */
  preloading: boolean;
  /** Share of files arrived, 0–1. */
  progress: number;
  busy: boolean;
  problem: string | null;
  upload: (files: File[]) => Promise<void>;
  rename: (edits: IconLabelEdit[]) => Promise<void>;
  approve: (keys: string[]) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The SVGs in a batch, by MIME type or extension: Finder drops files with an empty `type`. */
export function svgFilesFrom(files: File[]): File[] {
  return files.filter(
    (file) =>
      file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"),
  );
}

function skippedMessage(skipped: File[]): string | null {
  const [first, ...rest] = skipped;
  if (!first) return null;
  return rest.length === 0
    ? `${first.name} is not an SVG`
    : `${first.name} and ${rest.length} more are not SVGs`;
}

export function useIconLibrary(
  prerendered: readonly PrerenderedIcon[] = [],
): IconLibrary {
  // An initialiser, not an effect: the first render must match the server's tiles.
  const [seeded] = useState(() => ({
    icons: prerendered.map((entry) => entry.icon),
    sources: Object.fromEntries(
      prerendered.map((entry) => [entry.icon.key, entry.svg]),
    ) as Record<string, IconSvg | null>,
  }));

  const [icons, setIcons] = useState<IconAsset[]>(seeded.icons);
  const [sources, setSources] = useState<Record<string, IconSvg | null>>(seeded.sources);
  const [loading, setLoading] = useState(seeded.icons.length === 0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const asked = useRef(new Set<string>(seeded.icons.map((icon) => icon.key)));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Re-reads the listing. Never clears `problem`: actions re-list in `finally` and would lose their message. */
  const refresh = useCallback(async () => {
    try {
      const listed = await listIcons();
      if (!alive.current) return;
      setIcons(listed);
    } catch (error) {
      if (!alive.current) return;
      setProblem(messageOf(error, "The icon set could not be read"));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  const addHeld = useCallback(async () => {
    try {
      const held = await listHeldIcons();
      if (!alive.current || held.length === 0) return;
      setIcons((current) => {
        const known = new Set(current.map((icon) => icon.key));
        return [...current, ...held.filter((icon) => !known.has(icon.key))].sort(
          (a, b) => a.name.localeCompare(b.name),
        );
      });
    } catch {
      // Not the author. Nothing to add and nothing to say.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (seeded.icons.length === 0) void refresh();
    void addHeld();
  }, [refresh, addHeld, seeded.icons.length]);

  // Recorded one at a time, not via `Promise.all`, so the preloader has something true to count.
  useEffect(() => {
    const wanted = icons.filter((icon) => !asked.current.has(icon.key));
    if (wanted.length === 0) return;

    for (const icon of wanted) asked.current.add(icon.key);

    for (const icon of wanted) {
      void (async () => {
        let parsed: IconSvg | null = null;
        try {
          const response = await fetch(icon.url);
          if (response.ok) parsed = readIconSvg(await response.text());
        } catch {
          parsed = null;
        }
        if (!alive.current) return;
        setSources((current) => ({ ...current, [icon.key]: parsed }));
      })();
    }
  }, [icons]);

  /**
   * Measures, uploads, then finalizes. Metadata goes after the bytes: R2 stores
   * none of the metadata signed into a presigned PUT.
   */
  const uploadOne = useCallback(async (file: File) => {
    if (file.size > MAX_ICON_BYTES) {
      throw new Error(`${file.name} is too big to be an icon`);
    }

    const source = await file.text();
    const svg = readIconSvg(source);
    if (!svg) {
      throw new Error(`${file.name} is not a square SVG icon`);
    }

    const { key, uploadUrl } = await createIconUploadUrl({
      filename: file.name,
      size: file.size,
    });

    // The signed type, not `file.type`: Content-Type is part of the signature.
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: file,
    });

    if (!response.ok) {
      throw new Error(
        `${file.name} could not be stored — check the bucket's CORS policy allows PUT from this origin`,
      );
    }

    await finalizeIconUpload({ key, native: svg.viewBox, flattened: svg.flattened });
  }, []);

  /** Uploads the batch's SVGs in order, stopping at the first failure; non-SVGs are named and skipped. */
  const upload = useCallback(
    async (batch: File[]) => {
      const files = svgFilesFrom(batch);
      const skipped = skippedMessage(batch.filter((file) => !files.includes(file)));
      if (files.length === 0 && !skipped) return;

      setBusy(true);
      setProblem(skipped);
      try {
        for (const file of files) await uploadOne(file);
      } catch (error) {
        if (alive.current) setProblem(messageOf(error, "Upload failed"));
      } finally {
        await refresh();
        if (alive.current) setBusy(false);
      }
    },
    [refresh, uploadOne],
  );

  const approve = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      setBusy(true);
      setProblem(null);
      try {
        for (const key of keys) await setIconReview({ key, review: "approved" });
      } catch (error) {
        if (alive.current) setProblem(messageOf(error, "Could not publish"));
      } finally {
        await refresh();
        if (alive.current) setBusy(false);
      }
    },
    [refresh],
  );

  /** Writes one at a time, not via `Promise.all`, then re-reads once. */
  const rename = useCallback(
    async (edits: IconLabelEdit[]) => {
      if (edits.length === 0) return;
      setProblem(null);
      try {
        for (const edit of edits) await setIconLabels(edit);
      } catch (error) {
        if (alive.current) setProblem(messageOf(error, "Could not rename"));
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (keys: string[]) => {
      if (keys.length === 0) return;
      setBusy(true);
      setProblem(null);
      try {
        for (const key of keys) await deleteIcon({ key });
      } catch (error) {
        if (alive.current) setProblem(messageOf(error, "Could not delete"));
      } finally {
        await refresh();
        if (alive.current) setBusy(false);
      }
    },
    [refresh],
  );

  const arrived = icons.filter((icon) => icon.key in sources).length;
  const settled = !loading && (icons.length === 0 || arrived === icons.length);

  // Latched during render, not in an effect (`react-hooks/set-state-in-effect`).
  const [everSettled, setEverSettled] = useState(false);
  if (settled && !everSettled) setEverSettled(true);

  return {
    entries: icons.map((icon) => ({ icon, svg: sources[icon.key] })),
    loading,
    preloading: !everSettled,
    progress: icons.length === 0 ? 0 : arrived / icons.length,
    busy,
    problem,
    upload,
    rename,
    approve,
    remove,
  };
}
