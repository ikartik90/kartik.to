import { z } from "zod";

// ---------------------------------------------------------------------------
// An icon in the set, and the two scales it is looked at on.
//
// The set is a bucket prefix rather than a table: an icon has no relations, no
// slug, no draft, and nothing to say about itself that is not in its own file
// — so the objects under `icons/` ARE the set, and everything the listing
// needs that cannot be read from the bytes rides along as object metadata. The
// two facts that qualify are `native` (the grid the drawing was made on) and
// `flattened` (whether its outline was converted to fills), both measured in
// the browser at upload by `readIconSvg`, and `review`, which is the only one
// the server has an opinion about — see `reviewForUpload`.
//
// The stroke width is not among them. It is read off the file every time it is
// drawn, because the file is fetched anyway and a number stored beside it
// could go stale against its own bytes.
// ---------------------------------------------------------------------------

/**
 * The boxes an icon is drawn in, and the weights it is drawn at.
 *
 * The house pairings are still in here — 16 at 1, 20 at 1.25, 24 at 1.5 are
 * one optical weight at three scales, which is why the two halves of the set
 * can sit in one grid — but they are no longer the only stops. The set is
 * looked at far past the sizes it ships in: an icon at 64 is where a bad
 * join or an off-grid curve becomes obvious, and a weight at 0.5 or 2.5 is
 * how you find out whether a drawing survives a lighter or heavier line
 * before anyone commits to one.
 *
 * Two independent controls, because seeing a 16px icon carry a 2.5px line is
 * exactly the sort of thing this page is for.
 *
 * Evenly stepped on purpose (4px and 0.25px, the whole way), which is what
 * lets both be real sliders rather than segmented controls dressed as scales:
 * a thumb halfway along says a value halfway along.
 */
export const ICON_SIZES = [
  16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
] as const;
export const ICON_STROKES = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5,
] as const;

/**
 * The grid's magnifying glass, which never leaves the screen — it multiplies
 * what is drawn and has no effect on what a download contains.
 *
 * Half a multiple at a time, 1 to 4. It doubled (1, 2, 4) while it was a
 * segmented control, and that jump is exactly what a slider cannot express
 * honestly — a thumb halfway along a track that reads 1, 2, 4 is lying about
 * where it is. Halves because the step from 1 to 2 is the one that matters
 * most: it is where a 16-grid icon stops being a smudge, and landing on 1.5
 * is often enough.
 *
 * Written with its unit in the panel (`1.5x`), since a bare number beside a
 * size and a stroke reads as a third measurement rather than a multiplier.
 */
export const ICON_ZOOMS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

export interface IconSettings {
  size: number;
  stroke: number;
}

export interface IconViewSettings extends IconSettings {
  zoom: number;
}

/**
 * The middle of both scales, at true size.
 *
 * 20 at 1.25 because that is what the set is authored to — a 16-grid icon
 * shown at 20 is the same drawing at the same optical weight, which is the
 * whole reason the two halves of the set can sit in one grid. Zoom starts at
 * 1: the grid's job is to show what actually ships, and magnifying by default
 * would make every icon look better than it is.
 */
export const DEFAULT_ICON_SETTINGS: IconViewSettings = {
  size: 20,
  stroke: 1.25,
  zoom: 1,
};

/**
 * Whether an icon is on show.
 *
 *   approved  in the set, and visible to everyone.
 *   held      uploaded, kept, and shown to nobody but the author.
 *
 * An icon is held when its outline has been flattened into filled paths, since
 * the stroke slider cannot touch such a file and a set where the weight
 * control silently skips three tiles is a broken set. Holding is not a
 * rejection — plenty of marks are legitimately solid — it is a queue, and one
 * press moves it.
 */
export const IconReviewSchema = z.enum(["held", "approved"]);

export type IconReview = z.infer<typeof IconReviewSchema>;

/**
 * How many words an icon may be findable under, past its own name.
 *
 * A cap because the list arrives from a client and lands in a column: not a
 * design opinion so much as a floor under how wrong a request may be. Twelve
 * is far past what any real icon needs — the mark that needs a thirteenth
 * word is usually two marks.
 */
export const MAX_ICON_ALIASES = 12;

/** The longest an alias, or a name, may be. Enough for a phrase, not a note. */
export const MAX_ICON_TITLE_LENGTH = 80;

/** No icon is a hundred kilobytes. Anything that big is a drawing. */
export const MAX_ICON_BYTES = 128 * 1024;

export const IconAssetSchema = z.object({
  /** The object key, which is immutable once anything points at it. */
  key: z.string().min(1),
  url: z.string().url(),
  /** The upload's own name, and what a download is named after. */
  name: z.string().min(1),
  /** The square grid the drawing was made on: 16 and 20, here. */
  native: z.number().int().positive(),
  flattened: z.boolean(),
  review: IconReviewSchema,
  /**
   * What the icon is CALLED, which is not what its file is called. Falls back
   * to {@link iconTitleFrom} of the filename, so every icon has one from the
   * moment it lands and none of them needs a row to exist. It is what the
   * tooltip says.
   */
  title: z.string().min(1),
  /**
   * The other words it answers to. Tags, not names: two icons may share one,
   * and an icon with none is the ordinary case.
   */
  aliases: z.array(z.string().min(1)),
});

export type IconAsset = z.infer<typeof IconAssetSchema>;

/**
 * What signing an upload needs, and it is only two things: a name to mint the
 * key from, and a size to refuse on.
 *
 * The measurements are NOT here. They cannot ride along on a presigned PUT —
 * see `createR2UploadUrl` — so they are sent once the bytes have landed, by
 * the schema below, and asking for them twice would mean the server holding a
 * claim it has no object to write onto yet.
 */
export const CreateIconUploadInputSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive().max(MAX_ICON_BYTES),
});

export type CreateIconUploadInput = z.infer<typeof CreateIconUploadInputSchema>;

/**
 * What the browser reports about a file once it is stored: the grid it is
 * drawn on and whether its outline was flattened, both measured by
 * `readIconSvg` from the same bytes that were uploaded.
 *
 * No review state and no filename. The first is the server's alone
 * (`reviewForUpload`), and the second is recovered from the key the server
 * itself minted — a client that could name the stored file could name any
 * file.
 */
export const FinalizeIconUploadInputSchema = z.object({
  key: z.string().min(1),
  native: z.number().int().positive(),
  flattened: z.boolean(),
});

export type FinalizeIconUploadInput = z.infer<typeof FinalizeIconUploadInputSchema>;

export const IconKeyInputSchema = z.object({ key: z.string().min(1) });

export const SetIconReviewInputSchema = z.object({
  key: z.string().min(1),
  review: IconReviewSchema,
});

/**
 * What the author may say about an icon that its file cannot: the name it is
 * called by, and the words it can be found under.
 *
 * The two travel together because they are edited together — one panel, one
 * row, one write — and because a row holding a name with no aliases and a row
 * holding aliases with no name are the same row with different columns filled.
 * The title is trimmed to non-empty: clearing the field means "go back to the
 * filename", which the ACTION decides by deleting the row, not by storing an
 * empty string that would then have to be told apart from an unset one.
 */
export const SetIconLabelsInputSchema = z.object({
  key: z.string().min(1),
  title: z.string().trim().max(MAX_ICON_TITLE_LENGTH),
  aliases: z.array(z.string().trim().max(MAX_ICON_TITLE_LENGTH)).max(MAX_ICON_ALIASES),
});

export type SetIconLabelsInput = z.infer<typeof SetIconLabelsInputSchema>;

/**
 * What an upload's review state starts as. The one rule the server keeps for
 * itself, and the reason it is a function rather than a field the client
 * sends: a client that could name its own review state could publish anything.
 */
export function reviewForUpload(flattened: boolean): IconReview {
  return flattened ? "held" : "approved";
}

/**
 * A name an object key can carry, always ending `.svg` — the extension is
 * appended rather than replaced, so a file that arrives called `check.png`
 * keeps the evidence of what it claimed to be.
 */
export function sanitizeIconFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[^\w.\-()+]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  if (cleaned.length === 0 || cleaned === "." || cleaned === "-") return "icon.svg";
  return cleaned.toLowerCase().endsWith(".svg") ? cleaned : `${cleaned}.svg`;
}

/** The `<uuid>-` stamp every icon key carries, so two `check.svg` can coexist. */
const ICON_KEY_UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

/**
 * The upload name recovered from a key — only a fallback, since the name is
 * stored as metadata and can be read straight off the object. The uuid has to
 * be matched WHOLE: it is dash-separated itself, so splitting on the first
 * dash would leave most of it on the front of the name.
 */
export function iconNameFromKey(key: string): string {
  const last = key.split("/").pop() ?? key;
  return last.replace(ICON_KEY_UUID_PREFIX, "");
}

/**
 * A name reduced to the words in it: no extension, no case, and every
 * separator a space. `chevron-down.svg` and `Chevron Down` are the same three
 * words, which is what lets a search box take either.
 *
 * The extension goes because every icon shares it — a query of "svg" that
 * matched the whole set would be a filter that never filters.
 */
function iconNameWords(value: string): string {
  return value
    .replace(/\.svg$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Whether an icon answers to what was typed.
 *
 * Every term has to appear, and none of them has to be a whole word: typing
 * `chev` finds the chevrons before you have finished the word, and `down
 * chevron` finds `chevron-down` even though nothing is called that. An empty
 * query matches everything, which is what makes an empty box mean "the set"
 * rather than "nothing".
 */
export function matchesIconName(name: string, query: string): boolean {
  const terms = iconNameWords(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const words = iconNameWords(name);
  return terms.every((term) => words.includes(term));
}

/**
 * A filename as a NAME: `chevron-down.svg` becomes `Chevron Down`.
 *
 * The separators an icon is stored with are an artefact of being a file —
 * nothing about the drawing is hyphenated — so they go, and each word is
 * given its capital. Only the FIRST letter of each is touched: a file that
 * arrived `QR-code` or `myIcon` knows its own spelling better than a rule
 * about hyphens does, and levelling it would be the same mistake as setting
 * every stroke in an icon to one width.
 *
 * This is a starting point, not a fact: it is what the Icon name field is
 * filled with until somebody types something better, and what the tooltip
 * says in the meantime.
 */
export function iconTitleFrom(name: string): string {
  return name
    .replace(/\.svg$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * An alias list as it may be stored: trimmed, emptied of empties, and with no
 * word twice however it was cased.
 *
 * Within ONE icon a repeat says nothing the first did not — the add button
 * makes an empty row, and a row left empty is not an alias. Across icons a
 * repeat is the entire point: aliases are tags, and `arrow` naming eleven
 * marks is what makes typing it useful.
 */
export function cleanIconAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const alias of aliases) {
    const trimmed = alias.trim();
    const folded = trimmed.toLowerCase();
    if (!trimmed || seen.has(folded)) continue;
    seen.add(folded);
    kept.push(trimmed);
  }

  return kept.slice(0, MAX_ICON_ALIASES);
}

/**
 * Whether an icon answers to what was typed, under any of its names.
 *
 * One bag of words rather than three searches: the filename, the name it is
 * called by and every alias go in together, so `arrow caret` finds an icon
 * that is `arrow` under one alias and `caret` under another. Which is what a
 * tag is for — nothing is called both, and either should find it.
 */
export function matchesIcon(
  icon: { name: string; title: string; aliases: string[] },
  query: string,
): boolean {
  return matchesIconName(
    [icon.name, icon.title, ...icon.aliases].join(" "),
    query,
  );
}

/**
 * The icon's name as anything on screen says it: the stored filename without
 * the extension every icon in the set shares.
 *
 * Only the extension goes. It is NOT prettified into words — a label reading
 * "chevron down" over a file called `chevron-down.svg` is a small lie about
 * what a download will be called, and the whole reason to show a name here is
 * so you know which file you are looking at.
 */
export function iconLabelFor(name: string): string {
  return name.replace(/\.svg$/i, "");
}

/**
 * What a downloaded file is called. The settings are in the name because the
 * same icon is downloaded at several of them, and three files called
 * `check.svg` in a downloads folder tell you nothing about which is which.
 */
export function downloadNameFor(name: string, settings: IconSettings): string {
  return `${iconLabelFor(name)}-${settings.size}-${settings.stroke}.svg`;
}
