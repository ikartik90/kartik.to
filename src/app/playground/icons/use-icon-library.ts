"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIconUploadUrl,
  deleteIcon,
  finalizeIconUpload,
  listIcons,
  setIconLabels,
  setIconReview,
} from "@/app/actions/icon-set";
import { MAX_ICON_BYTES, type IconAsset } from "@/domain/icon";
import { readIconSvg, type IconSvg } from "@/utils/icon-svg";
import type { IconLabelEdit } from "./icon-labels-group";

// ---------------------------------------------------------------------------
// The set, loaded: what is in the bucket, and the file behind each one.
//
// Two reads rather than one, because they answer different questions and one
// of them cannot be answered by the server. `listIcons` says what the set IS —
// names, grids, review states, and which of them this visitor may see. The
// files themselves are then fetched straight off the public bucket and parsed
// here, because the page does not DRAW the bytes it was sent: it redraws every
// icon at whatever size and weight the sliders are on, which needs the
// geometry rather than the file. Parsing in the browser is also what makes the
// upload measurements honest — the same `readIconSvg` reads a file being
// uploaded and a file being shown, so an icon cannot be listed as something it
// would not draw as.
//
// Sources are cached by key and never re-fetched: an object key is immutable
// (a re-upload mints a new uuid), so a file that has arrived once is the file
// forever. A refresh after an upload or a delete therefore costs one action
// call and one fetch for whatever is new.
// ---------------------------------------------------------------------------

/**
 * An icon and its parsed file, in three states that have to stay three:
 *
 *   undefined  the file has not arrived yet. Two hundred objects come down one
 *              request each, so this is the state most of the set is in for
 *              the first second or two of a visit.
 *   null       it arrived and is not an icon. A fact about the object.
 *   IconSvg    drawable.
 *
 * They were two for a while — `sources[key] ?? null` collapsed the first into
 * the second — and the whole sheet spent those seconds drawn as broken files.
 */
export interface IconEntry {
  icon: IconAsset;
  svg?: IconSvg | null;
}

export interface IconLibrary {
  entries: IconEntry[];
  /** True until the first listing has landed — nothing is known before it. */
  loading: boolean;
  /**
   * True until the set is DRAWABLE — the listing plus every file behind it.
   * Latched once, so a later upload fills a tile in rather than sending the
   * whole sheet back behind the preloader.
   */
  preloading: boolean;
  /** How much of the set has arrived, 0–1. Real, not a trickle: one per file. */
  progress: number;
  busy: boolean;
  /** The last thing that went wrong, in words a person can act on. */
  problem: string | null;
  upload: (files: File[]) => Promise<void>;
  /** Name icons, and give them the words they can be found under. */
  rename: (edits: IconLabelEdit[]) => Promise<void>;
  approve: (keys: string[]) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useIconLibrary(): IconLibrary {
  const [icons, setIcons] = useState<IconAsset[]>([]);
  const [sources, setSources] = useState<Record<string, IconSvg | null>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Which keys have been asked for, so a re-render or a second listing cannot
  // set the same fetch going twice. A ref rather than state: it is bookkeeping
  // about requests in flight, and nothing on screen reads it.
  const asked = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Re-read the listing. It reports its OWN failure and says nothing on
   * success — deliberately: every action below re-lists in a `finally`, so a
   * refresh that cleared the problem on the way past would wipe the message
   * the action had just set and an upload of the wrong file type would fail
   * silently.
   */
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

  // The set is read on MOUNT, not on the server, and it has to be: the page is
  // public and statically rendered, but what the listing contains depends on
  // who is asking — the author sees the held icons and nobody else does. A
  // server read would have to make the route dynamic for every visitor to
  // answer a question only one person's answer differs on. One read per visit,
  // since the page outlives every client navigation within it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Fetch and parse whatever has appeared in the listing since last time. A
  // file that will not parse is recorded as `null` rather than retried: it is
  // a fact about the object, not a flaky request, and the tile says so.
  //
  // Recorded ONE AT A TIME rather than in a single `Promise.all`, so the
  // preloader has something true to count. Batched, the set went from nothing
  // to everything in one commit and any progress drawn from it would have been
  // a guess. The extra renders are free where they land: while the set is
  // still coming, the only thing mounted is the bar.
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
   * Read, measure and store one file, in three steps that have to be three.
   *
   * The measuring is the gate: an upload is refused here if it is not a square
   * SVG, so the set cannot come to hold an object the grid has no way to draw.
   *
   * The measurements are then sent AFTER the bytes rather than with them, and
   * that ordering is not a preference. Metadata signed into a presigned PUT is
   * hoisted into the query string, and R2 answers such a PUT with a 200 and
   * stores none of it — so an upload that measured its file perfectly well
   * still landed as a bare object, and a bare object reads as `held`. Which is
   * how a set of ordinary stroked icons all arrived marked for review.
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

    // The type the URL was signed with, not the one the operating system
    // guessed: Content-Type is part of the signature, and a file picked from a
    // system that reports no type for `.svg` would otherwise fail to upload
    // with a signature error that says nothing about why.
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

    // What the file IS, onto the object that now holds it. The server decides
    // the review state from `flattened`; nothing here can name it.
    await finalizeIconUpload({ key, native: svg.viewBox, flattened: svg.flattened });
  }, []);

  /**
   * Upload a batch, in order, stopping at the first failure. In order because
   * a set is uploaded a folder at a time and a hundred parallel PUTs is a
   * denial of service on your own bucket; stopping because the failures worth
   * reporting (a wrong file type, a missing CORS rule) are true of the rest of
   * the batch too.
   */
  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      setProblem(null);
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

  /**
   * What icons are called, and the words they answer to — one write each, one
   * re-read at the end.
   *
   * Takes a LIST because an alias is a tag: adding one to twelve icons is one
   * act, and re-listing the set after each of the twelve would be twelve
   * listings for one press. The writes go one at a time rather than through
   * `Promise.all` so a bucket that starts refusing does not have eleven more
   * requests already in flight.
   *
   * No `busy` flag around it, unlike publishing and deleting: those act on a
   * selection and leave the set changed under you, where this is a person
   * leaving a text field. Locking the panel on the way out of an input would
   * be felt as a stutter, and nothing about the write needs the guard.
   */
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

  // How much of the set is in hand, and whether the whole of it is.
  const arrived = icons.filter((icon) => icon.key in sources).length;
  const settled = !loading && (icons.length === 0 || arrived === icons.length);

  // Latched during render rather than in an effect — the same shape
  // `useTrickleProgress` uses to re-seed itself, and for the same reason: it
  // is state DERIVED from a transition, and an effect would both lag a paint
  // behind and trip `react-hooks/set-state-in-effect`.
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
