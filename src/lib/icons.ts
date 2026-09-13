import { DOMParser } from "@xmldom/xmldom";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { IconAssetSchema, iconTitleFrom, iconNameFromKey, type IconAsset } from "@/domain/icon";
import { listR2IconKeys, headR2Object, publicUrlForKey } from "@/lib/storage/r2";
import { readIconSvg, type IconSvg } from "@/utils/icon-svg";

// ---------------------------------------------------------------------------
// The icon set, read on the SERVER — what the playground is prerendered from.
//
// The page used to build itself in the browser: a listing on mount, then one
// request per icon straight to the bucket, two hundred and eighty of them, and
// a two-act preloader to have something honest to show while they landed. It
// worked, and it cost a second on a warm cache and four on a cold one, every
// visit, because none of it could be cached — `listIcons` reads the session to
// decide whether the author is asking, and a session read is what makes a
// route dynamic.
//
// The fix is to notice that only a SLICE of the answer depends on who is
// asking. The approved icons are the same set for everyone, so the read of
// them asks nothing, the page prerenders, and a visit costs no icon requests
// at all. The author's held icons are fetched separately, by the author's own
// browser, through an action that checks (`listHeldIcons`).
//
// This module is therefore deliberately session-blind. If anything here ever
// reaches for `isAdmin`, the page it feeds stops being static and the whole
// arrangement quietly reverts to what it replaced.
//
// It is NOT an action module: these run on the server only, called by the
// route and by `actions/icon-set`. An action would publish them as endpoints
// for no reason. Nothing marks it `server-only` because the package is not a
// dependency here — what keeps it off the client is `@/lib/prisma` and the R2
// client it reaches through, which are server modules already.
// ---------------------------------------------------------------------------

// The one parser, given a DOM to run in.
//
// `readIconSvg` is the SAME function the browser runs — on the upload that
// measures a file, and on the page that draws it. That is the property worth
// protecting: an icon cannot be listed as something it would not draw as. Node
// has no `DOMParser`, so rather than write a second parser for the server to
// disagree with, the server is given one.
//
// Checked rather than assumed: every file in the bucket was parsed with this
// and with jsdom, and the two agreed on all 281.
//
// Assigned once, at module load, because `readIconSvg` reaches for the global.
const globals = globalThis as { DOMParser?: unknown };
globals.DOMParser ??= DOMParser;

/** One object as an icon, from its key and whatever the table says about it. */
export interface IconLabels {
  title: string;
  aliases: string[];
}

/**
 * One object as an icon.
 *
 * The three metadata fields are all optional in practice, because an object
 * could have been put in the bucket by hand — and each falls back in the
 * direction that cannot mislead: the key's own name, the grid the set is
 * authored on, and `held`, which shows it to nobody until it has been looked
 * at.
 */
export async function keyToIcon(
  key: string,
  labels?: IconLabels,
): Promise<IconAsset | null> {
  const url = publicUrlForKey(key);
  if (!url) return null;

  const { metadata } = await headR2Object(key);
  const native = Number.parseInt(metadata.native ?? "", 10);
  const name = metadata.filename || iconNameFromKey(key);

  return IconAssetSchema.parse({
    key,
    url,
    name,
    native: Number.isInteger(native) && native > 0 ? native : 20,
    flattened: metadata.flattened === "1",
    review: metadata.review === "approved" ? "approved" : "held",
    // The row is the exception. An icon nobody has renamed is called what its
    // filename says, which is why nothing was ever backfilled into `Icon`.
    title: labels?.title || iconTitleFrom(name),
    aliases: labels?.aliases ?? [],
  });
}

/** The whole bucket as icons, in name order — approved and held alike. */
export async function listAllIcons(): Promise<IconAsset[]> {
  if (!env.R2_PUBLIC_BASE_URL) throw new Error("Icon storage is not configured");

  const keys = await listR2IconKeys();

  // ONE query for the set, against one HEAD per object — which is the reason
  // these two facts are in a table and not in the object's metadata: metadata
  // rides along with a HEAD but cannot be searched, and this listing is what
  // the search box filters. Keyed up front so the mapping below stays a
  // lookup rather than a scan per icon.
  const rows = await prisma.icon.findMany({ where: { key: { in: keys } } });
  const labels = new Map(
    rows.map((row) => [row.key, { title: row.title, aliases: row.aliases }]),
  );

  const icons = await Promise.all(keys.map((key) => keyToIcon(key, labels.get(key))));

  return icons
    .filter((icon): icon is IconAsset => icon !== null)
    // Sorted by NAME rather than by key or by upload date, because the key
    // carries a uuid and the date is invisible on screen: an icon grid that
    // reshuffles between visits is one you cannot learn the shape of.
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** An icon and the geometry the grid redraws it from. */
export interface PrerenderedIcon {
  icon: IconAsset;
  /** `null` when the file did not come or would not parse — the tile says so. */
  svg: IconSvg | null;
}

/**
 * The public half of the set, with every file already read and parsed.
 *
 * This is the page. Called from the route, it runs at build and at each
 * revalidation rather than on a visit, so what reaches a reader is HTML with
 * two hundred and seventy-nine drawings already in it.
 *
 * The files are fetched in PARALLEL and their failures kept rather than
 * thrown: one unreadable object is a fact about that object, and dropping its
 * tile would make a failed read look like a deleted icon.
 */
export async function listApprovedIconsWithSvg(): Promise<PrerenderedIcon[]> {
  const icons = (await listAllIcons()).filter((icon) => icon.review === "approved");

  return Promise.all(
    icons.map(async (icon) => {
      try {
        const response = await fetch(icon.url);
        if (!response.ok) return { icon, svg: null };
        return { icon, svg: readIconSvg(await response.text()) };
      } catch {
        return { icon, svg: null };
      }
    }),
  );
}
