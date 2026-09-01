// ---------------------------------------------------------------------------
// Reading the search box as a command line.
//
// Two characters decide it: a `>` in the first position FOLLOWED BY A SPACE
// means the rest of the field NAMES something to run rather than describes
// something to find. Chosen because it is the prompt every console in the world
// already draws, and because nothing in this palette's own vocabulary starts
// with it — a search for "> " was never going to match a row.
//
// The space is required, not decoration. `>` on its own is half a prefix and
// could still be the start of an ordinary search, so the field stays a search
// until the space arrives and settles it; `>foo` is that search, not a command
// spelled impatiently. One rule, stated the way it is typed.
//
// And only the OPENING marker counts. A `>` further in is part of what is being
// searched for (a title, a quote), and treating it as a prompt would turn an
// ordinary search into a mode the reader never asked for. Leading whitespace is
// the same thing said differently: the prefix opens the field or it is not a
// prefix.
//
// Nothing here evaluates anything. The text is normalised into a NAME and the
// name is looked up in a table (`data/palette-commands.ts`); a command that
// nobody registered does not run, however valid its JavaScript. That is the
// whole security model of the feature, and it is why this file only ever
// returns strings.
// ---------------------------------------------------------------------------

/** What the field must open with for its text to be read as a command. */
export const COMMAND_PREFIX = "> ";

/**
 * What was typed after the prefix, or `null` when this is an ordinary search.
 *
 * An empty string is a real answer, not a missing one: `"> "` is command mode
 * with nothing named yet, which is what lets the palette list everything there
 * is to run.
 */
export function parseCommandLine(input: string): string | null {
  if (!input.startsWith(COMMAND_PREFIX)) return null;
  return input.slice(COMMAND_PREFIX.length).trim();
}

/**
 * The name a typed command keys against.
 *
 * `window.adminLogin()`, `window.adminLogin`, `adminLogin()` and `adminLogin`
 * are one command written four ways — the console form the author already knows
 * and the three shorthands they will reach for once they stop thinking about
 * it. Stripping the receiver and an EMPTY call reduces all four to the name.
 *
 * A call with arguments in it is left exactly as typed, because those parens
 * are not decoration: nothing in the table takes arguments, so the honest
 * outcome is that it matches nothing.
 */
export function commandKey(source: string): string {
  return source
    .trim()
    .replace(/^window\s*\./, "")
    .replace(/\(\s*\)$/, "")
    .trim();
}
