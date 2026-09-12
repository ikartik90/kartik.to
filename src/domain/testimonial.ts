import { z } from "zod";

// ---------------------------------------------------------------------------
// Testimonial — a few words somebody who has worked with me agreed to put their
// name to, collected through a form at `/vouch` rather than over email.
//
// The one thing worth saying up front is WHO WRITES THIS. Every other table in
// this schema is written by the author, from an admin surface, behind a session
// the proxy has already checked. This one is written by strangers, through a
// link handed out by hand, with no account and no session to check them
// against — so this file is not a formality on the way to the column, it is the
// only thing standing between the form and the database.
//
// TWO FIELDS, and it briefly had three. A LinkedIn URL was collected as proof
// of who was speaking, and it was also the table's natural key: unique, so a
// second send from one profile corrected the first instead of duplicating it.
// Dropping the field dropped the key with it, and nothing here replaces it —
// `name` would be far worse than nothing, because a unique name lets anybody
// overwrite somebody else's words by typing their name. So a submission is
// simply a row, two sends make two rows, and the honeypot is what stands
// between an open link and a full table. Sized to the stake: the list is short
// and read by hand.
//
// SHORT ON PURPOSE. A testimonial is capped at 280 characters, which is not a
// storage limit — Postgres would take a novel — but an editorial one: the cap
// is the brief. A quote that has to earn its length reads better on a page than
// three paragraphs nobody finishes, and a small box tells the writer that
// without a word of instruction.
// ---------------------------------------------------------------------------

/** The brief, in characters. The form's counter reads this, so the box and the
 *  column can never disagree about what fits. */
export const TESTIMONIAL_QUOTE_MAX_LENGTH = 280;

/** Long enough for a full name with titles; short enough to refuse a paragraph
 *  pasted into the wrong box. */
export const TESTIMONIAL_NAME_MAX_LENGTH = 80;

/**
 * Room for a role and the place it is held — "Senior Product Designer at
 * Shyft" — and not for a sentence. The same cap as the name, because it is the
 * same kind of value: one line under another, on a card sized for the words
 * above it.
 */
export const TESTIMONIAL_TAGLINE_MAX_LENGTH = 80;

/**
 * What the form at `/vouch` posts, and the only shape allowed to become a row.
 *
 * Trimmed BEFORE it is measured, so trailing whitespace can neither smuggle a
 * blank field past `min(1)` nor push a legal quote over the cap on a technicality.
 *
 * Unknown keys are stripped, which is Zod's default and is load-bearing here
 * rather than incidental: this schema decides what a row IS, so a caller that
 * posts a retired field (the LinkedIn URL) or an invented one cannot widen the
 * write.
 */
export const TestimonialSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Add your name.")
    .max(TESTIMONIAL_NAME_MAX_LENGTH, "That name is too long."),
  quote: z
    .string()
    .trim()
    .min(1, "Write a line or two.")
    .max(
      TESTIMONIAL_QUOTE_MAX_LENGTH,
      `Keep it to ${TESTIMONIAL_QUOTE_MAX_LENGTH} characters.`,
    ),
});

export type TestimonialSubmission = z.infer<typeof TestimonialSubmissionSchema>;

/**
 * A stored testimonial, as the admin board reads it back — both halves of the
 * row: the two fields the submitter wrote, and the two I added afterwards.
 *
 * The author's two are `string | null` rather than optional, because the column
 * is nullable and a row ALWAYS answers the question — "no picture yet" is an
 * answer, and an absent key would be a third state the board would have to
 * think about.
 */
export interface Testimonial extends TestimonialSubmission {
  id: string;
  createdAt: Date;
  /** A picture from the media library, put there by me. See below. */
  avatarUrl: string | null;
  /**
   * What they do, in my words, under their name — "Senior Product Designer at
   * Shyft".
   *
   * MINE to write, like the other three, and for a reason worth saying: the
   * form asks for a name and a quote and nothing else, so a role is something
   * I know about the person rather than something they told me. It is also why
   * this is not part of `name`: people put their title in that box themselves
   * ("Lalit Arya - Senior UX Designer"), and a field of its own is what lets
   * the card draw the two as two lines instead of one long one.
   */
  tagline: string | null;
  /** Their profile, typed by me. NOT collected from them — see below. */
  linkedinUrl: string | null;
  /** The portion of `quote` a card shows, or null for all of it. See below. */
  excerpt: string | null;
  /**
   * When these words went onto the homepage, or null if they have not.
   *
   * THE ONE FIELD HERE THAT IS ABOUT THE READER rather than about the row, and
   * the only reason it exists is who writes this table. Everywhere else on this
   * site I am the author, so a published flag would be ceremony; here the form
   * is open to anyone holding the link, and a homepage that simply read the
   * table would put the next stranger's submission in front of every visitor
   * the moment it was sent.
   *
   * A DATE and not a boolean, the same spelling `Post.publishedAt` uses — two
   * tables answering the same question should not answer it in two shapes.
   * Nothing orders by it (the wall reads newest-first by `createdAt`, as the
   * board does); it is read as a yes/no and kept as a date because the date is
   * free and occasionally worth knowing.
   */
  publishedAt: Date | null;
}

/**
 * The name of the field no human ever sees.
 *
 * A honeypot, and the crudest spam defence there is — which is now the ONLY
 * one, since the unique profile URL that used to collapse repeat sends into a
 * single row went with the LinkedIn field. It is still the right size for the
 * threat: the form is reachable by anyone holding the link, so the realistic
 * nuisance is not a person with a grudge but a bot walking the page and filling
 * every input it finds. One input that is hidden from sight and from assistive
 * technology, left blank by every real submission and completed by an
 * indiscriminate filler, separates the two at no cost to the person actually
 * writing.
 *
 * Named like an ordinary field on purpose: a bot decides what to fill from the
 * name, and nothing takes the bait like `website`.
 */
export const TESTIMONIAL_HONEYPOT_FIELD = "website";

// ---------------------------------------------------------------------------
// THE AUTHOR'S HALF OF A ROW.
//
// Everything above this line is written by a stranger through the form. What
// follows is written by me, from the admin board, about a row that already
// exists — a face to put beside the words, a profile to say who said them, the
// portion worth quoting, and a tidied spelling of their name.
//
// THE ONE LINE THAT MATTERS IS THE QUOTE. A submission cannot reach the
// author's fields (they are not in `TestimonialSubmissionSchema`) and this
// cannot reach `quote` (it is not in here) — and neither is a matter of which
// caller remembers to be careful, because both schemas strip what they do not
// name. `name` sits on my side of that line and `quote` never will: a name is a
// label on an attribution, which I am entitled to tidy on my own page; the
// quote is the thing somebody actually said.
//
// A WORD ON `linkedinUrl`, WHICH LOOKS LIKE A REVERSAL AND IS NOT. The form
// once asked for a profile URL and the column was dropped before it ever held
// a row — see the migration. What is coming back is not that field:
//
//   * It is MINE to fill, not theirs. Nothing about the submitter's experience
//     changes, and `/vouch` gains no box.
//   * It is NULLABLE, because a row arrives without one and may keep none.
//   * It is NOT UNIQUE, and must never be again. The unique index was the old
//     field's real job — the table's natural key, so a second send corrected
//     the first. Restoring that on a column I type by hand would make my own
//     typo collide with somebody else's row. Two sends are still two rows.
//
// The picture is stored as the URL of something already in the media library
// rather than as bytes of its own. It is picked through the same dialog every
// other picture on this site is picked through, so there is no second upload
// path, no second prefix and no second admin door to get wrong.
// ---------------------------------------------------------------------------

/** Where a profile lives, once the spellings have been collapsed into one. */
const LINKEDIN_HOST = "www.linkedin.com";

/** Said by every way the field can be wrong, because they are one mistake to
 *  the person typing: this box wants a LinkedIn profile and has not got one. */
const NOT_LINKEDIN = "That does not look like a LinkedIn URL.";

/**
 * Nothing, in the one spelling the row stores.
 *
 * A cleared box posts `""`, an untouched row holds `null`, and a box holding
 * spaces is a cleared box that got away — three ways to say the same thing,
 * which the column may only hear one of. Null rather than the empty string
 * because SQL already has a word for absent, and two of them would mean every
 * later read had to test for both.
 */
const blank = z
  .string()
  .trim()
  .refine((value) => value === "")
  .transform(() => null);

/**
 * A profile URL, as typed and as stored.
 *
 * TYPED is whatever the address bar handed over: no scheme, a country
 * subdomain, a trailing slash, and forty characters of `?trk=` that LinkedIn
 * adds to its own share links. STORED is one canonical spelling. Normalising on
 * the way in rather than on the way out means the value is comparable, and that
 * the same profile pasted twice from two different places is recognisably the
 * same profile.
 *
 * The host is CHECKED, not merely parsed, and that is what makes the label
 * honest — a field called LinkedIn that accepts any URL at all is a link field
 * that is lying about what it holds. Checked against the parsed `hostname`, so
 * `linkedin.com.example.net` is the impostor it looks like rather than a suffix
 * match that got lucky.
 */
export const LinkedInProfileUrlSchema = z
  .string()
  .trim()
  // ONE transform, not a parse-then-refine-then-format chain, because the three
  // steps share a value: the parsed `URL` is what the check reads and what the
  // canonical spelling is built from. Split across `.refine()` the object would
  // have to be either re-parsed or carried along as possibly-null, and the last
  // step would be asserting away a case the step before it had already ruled
  // out.
  .transform((value, ctx) => {
    // Added rather than demanded. `new URL` needs a scheme and a person pasting
    // a profile has none; refusing them over it would be refusing the exact
    // string a browser puts on the clipboard.
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      ctx.addIssue({ code: "custom", message: NOT_LINKEDIN });
      return z.NEVER;
    }

    // Against the parsed `hostname`, so `linkedin.com.example.net` is the
    // impostor it looks like rather than a substring match that got lucky.
    const host = url.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      ctx.addIssue({ code: "custom", message: NOT_LINKEDIN });
      return z.NEVER;
    }

    // The path and nothing else: the subdomain is a redirect waiting to happen,
    // the query is tracking, and the trailing slash is noise.
    return `https://${LINKEDIN_HOST}${url.pathname.replace(/\/+$/, "")}`;
  });

/**
 * What the board writes back about one row.
 *
 * The `id` is the only part of the row this schema will name, and it is
 * REQUIRED rather than optional: an update with nowhere to land is not a
 * partial update, it is a bug that would otherwise reach Prisma as a query
 * against `undefined`.
 *
 * Unknown keys are stripped, as they are on the way in — so this stays the
 * author's door onto the author's two fields, and a caller that posts a `quote`
 * alongside them cannot edit somebody else's words through it.
 */
export const TestimonialDetailsSchema = z.object({
  id: z.string().trim().min(1),
  /**
   * A corrected name, written over theirs.
   *
   * THE ONE SUBMITTED FIELD THIS SCHEMA MAY TOUCH, and the line is drawn where
   * it is on purpose. A name here is a label on an attribution — people put job
   * titles in it ("Lalit Arya - Senior UX Designer"), misspell themselves, or
   * give a first name where the card wants both — and tidying that is editorial
   * work on my own page. The QUOTE is what somebody actually said, and stays
   * absent from this object no matter how convenient a box for it would be.
   *
   * Written IN PLACE rather than as an override beside `name`, which was the
   * alternative: the submitted spelling is not kept. Chosen deliberately for the
   * simpler column, and the cost is real — a correction cannot be undone back to
   * what they typed.
   *
   * Cannot be CLEARED, unlike the other three. The column is NOT NULL and a
   * testimonial credited to nobody is not a state worth having, so an emptied
   * box is a mistake to answer rather than an instruction to obey — hence
   * `.min(1)` and no `blank` arm.
   */
  name: z
    .string()
    .trim()
    .min(1, "A testimonial needs a name on it.")
    .max(TESTIMONIAL_NAME_MAX_LENGTH, "That name is too long.")
    .optional(),
  /** A picture already in the media library, or none. */
  avatarUrl: z.union([blank, z.url()]).nullable(),
  /**
   * Their role, under the name — or nothing.
   *
   * THREE states, like the excerpt and unlike the two beside it: absent means
   * "leave whatever is stored alone", null (or a blank box) clears it, and a
   * string replaces it. The board sends the whole row today, so two would do;
   * three costs one `if` in the action and makes a partial write from anywhere
   * else safe by construction rather than by habit.
   */
  tagline: z
    .union([
      blank,
      z.string().trim().min(1).max(TESTIMONIAL_TAGLINE_MAX_LENGTH),
    ])
    .nullish(),
  linkedinUrl: z.union([blank, LinkedInProfileUrlSchema]).nullable(),
  /**
   * SHAPE only — that this is some text or nothing. Whether it is a legitimate
   * excerpt cannot be decided here, because the answer depends on the `quote`
   * it is supposed to come out of and this schema has never seen it. The action
   * reads the row and asks {@link isExcerptOfQuote}.
   *
   * THREE states, not two, and no `.default()` for exactly that reason:
   * ABSENT means "leave whatever is stored alone", NULL (or a blank string)
   * means "clear it, show the whole quote again", and a string means "show
   * this". A default would collapse the first into the second, so editing only
   * the picture would silently throw away a chosen excerpt.
   */
  excerpt: z.union([blank, z.string().trim().min(1)]).nullish(),
  /**
   * Whether these words are on the homepage.
   *
   * A BOOLEAN here and a TIMESTAMP in the column, and the asymmetry is
   * deliberate: a switch has two positions, and what the rail knows is which
   * one it is in. Turning the answer into an instant is the action's job, so a
   * caller cannot hand the column a publication date of its own choosing.
   *
   * STRICTLY a boolean — no coercion. `z.coerce.boolean()` would read the
   * string "false" as `true`, which on this particular field means publishing
   * something nobody asked to publish; a gate that can be opened by a typo is
   * not a gate.
   *
   * OPTIONAL, with the same three-state rule as the excerpt and the tagline,
   * and it matters more here than on either of them: a board writing a picture
   * says nothing about publication, and must not take a testimonial off the
   * homepage as a side effect of an unrelated edit. Absent means "leave it
   * where it is"; `false` is the only thing that unpublishes.
   */
  published: z.boolean().optional(),
});

export type TestimonialDetails = z.infer<typeof TestimonialDetailsSchema>;

// ---------------------------------------------------------------------------
// THE EXCERPT.
//
// Most of these run to the 280-character cap, and a wall of six full ones is
// unreadable — so a card shows the PORTION worth quoting and the row keeps all
// of it. The whole testimonial is never edited, never shortened and never
// thrown away; the excerpt is a second, smaller field beside it that says which
// part to put on the card.
//
// WHY A SLICE AND NOT FREE TEXT. This is the only table here written by
// somebody else, and an excerpt field that accepted any string at all would be
// a box for putting words into other people's mouths — the one mistake this
// surface must make impossible rather than merely discourage. So an excerpt is
// valid only if it appears VERBATIM AND CONTIGUOUSLY inside the quote. Trimming
// it down is allowed; typing into it is not.
//
// WHY NOT OFFSETS. A start/end pair would be more canonical still — it could
// not drift from the quote even in principle. It was rejected as the worse
// trade: every read would have to re-slice the quote to show anything, and a
// number pair is unreadable in the database, in a log, or in a test. Storing
// the text and CHECKING it against the quote buys the same guarantee at the
// moment it matters — the write — and leaves a column you can simply read.
// ---------------------------------------------------------------------------

/** Said when an excerpt is not the writer's own words. */
export const TESTIMONIAL_EXCERPT_NOT_THEIRS =
  "An excerpt has to be their words. Trim the quote down rather than rewriting it.";

/**
 * Is this excerpt genuinely a piece of this quote?
 *
 * Trimmed before it is looked for, because a selection dragged with a mouse
 * collects the space either side of it — that is the tool's noise, not an edit,
 * and a trimmed slice of a string is still a slice of it.
 *
 * Plain `includes`, so the match is contiguous: two real fragments stitched
 * together with the middle removed would pass a looser test and is exactly the
 * kind of quote that changes what somebody said.
 */
export function isExcerptOfQuote(quote: string, excerpt: string): boolean {
  const trimmed = excerpt.trim();
  return trimmed.length > 0 && quote.includes(trimmed);
}

/**
 * What a card actually draws — the chosen portion, or all of it.
 *
 * Here rather than in the card, so that the card, a future public page and any
 * link preview cannot disagree about which words a testimonial shows.
 */
export function testimonialShown(
  testimonial: Pick<Testimonial, "quote" | "excerpt">,
): string {
  return testimonial.excerpt ?? testimonial.quote;
}

// ---------------------------------------------------------------------------
// WHAT A CARD DRAWS BESIDE THE WORDS.
//
// Both of these were written twice — once on the admin board's card and once on
// the homepage wall's — before being moved here, which is the honest place for
// them: they are questions about a testimonial, and there are now two surfaces
// that have to answer them identically. A board showing `in/ada` while the
// homepage shows the whole URL is not a styling difference, it is two
// components disagreeing about what the value IS.
// ---------------------------------------------------------------------------

/**
 * What to write in an empty avatar.
 *
 * The first CHARACTER, not the first letter of each word: initials would need
 * to know which parts of a name are given names, and no rule for that survives
 * contact with the names people actually have. One character is a placeholder
 * admitting to being one.
 *
 * Sliced by CODE POINT rather than by `charAt`, which would cut a surrogate
 * pair in half and draw the first half of a character. Names are not ASCII.
 */
export function testimonialInitial(name: string): string {
  return [...name.trim()][0] ?? "";
}

/**
 * A profile URL as the bit of it worth reading — `ada` out of forty characters
 * of scheme, host and routing.
 *
 * THE HANDLE ALONE. `in/` is LinkedIn's word for "the thing at the end of this
 * is a person", which is not news anywhere this is shown — it sits beside a
 * LinkedIn glyph, under a person's name — and it is not part of what anybody is
 * called. Everything else in the path stays: a company page shown as its bare
 * slug would be claiming to be somebody's handle.
 *
 * The URL is stored canonically ({@link LinkedInProfileUrlSchema}), so this is
 * a slice rather than a parse. Falls back to the whole value if it ever meets
 * one that is not, or one with nothing after the host: showing something odd
 * beats showing nothing, and the rail has the real value either way.
 */
export function linkedInHandle(url: string): string {
  const path = url
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^in\//i, "")
    .replace(/\/+$/, "");
  return path === "" ? url : path;
}
