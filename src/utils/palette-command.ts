// ---------------------------------------------------------------------------
// Reading the search box as a command line.
//
// One character decides it: a `>` in the first position means the rest of the
// field NAMES something to run rather than describes something to find. Chosen
// because it is the prompt every console in the world already draws, and
// because nothing in this palette's own vocabulary starts with it — a search for
// "> " was never going to match a row.
//
// Only the FIRST character counts. A `>` further in is part of what is being
// searched for (a title, a quote), and treating it as a prompt would turn an
// ordinary search into a mode the reader never asked for.
//
// Nothing here evaluates anything. The text is normalised into a NAME and the
// name is looked up in a table (`data/palette-commands.ts`); a command that
// nobody registered does not run, however valid its JavaScript. That is the
// whole security model of the feature, and it is why this file only ever
// returns strings.
// ---------------------------------------------------------------------------

/** The character that turns the search box into a prompt. */
export const COMMAND_MARKER = ">";

/**
 * What was typed after the marker, or `null` when this is an ordinary search.
 *
 * An empty string is a real answer, not a missing one: a bare `>` is command
 * mode with nothing named yet, which is what lets the palette list everything
 * there is to run.
 */
export function parseCommandLine(input: string): string | null {
  const line = input.trimStart();
  if (!line.startsWith(COMMAND_MARKER)) return null;
  return line.slice(COMMAND_MARKER.length).trim();
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
