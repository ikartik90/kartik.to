import { adminLogin } from "@/utils/admin-login";
import { commandKey } from "@/utils/palette-command";

// ---------------------------------------------------------------------------
// Everything the palette's `>` line is willing to run.
//
// An allowlist, and deliberately nothing cleverer. The field looks like a
// console and reads like one, but the resemblance stops at the prompt: what is
// typed is a NAME to be found in this table, never source to be evaluated. So
// `> fetch('/api/…')` does not reach the network, and a table with one row can
// only do one thing.
//
// The row's own logic is not here either — `adminLogin` is a call away, and the
// half of it worth protecting is a server action behind that. This file's whole
// job is the mapping: which words reach which function. Adding a command means
// adding a line, and the palette does not change.
//
// Keyed by the bare name, labelled by the console form, because the console is
// where the author learned it: `window.adminLogin()` is the thing they have
// typed a hundred times, and a palette that answers to a different name for it
// is a second thing to remember.
// ---------------------------------------------------------------------------

export interface PaletteCommand {
  /** The console form — what the row says, and what the author already types. */
  label: string;
  /** Do it. Never throws; a command owns its own failure. */
  run: () => void | Promise<void>;
}

export const PALETTE_COMMANDS: Record<string, PaletteCommand> = {
  adminLogin: { label: "window.adminLogin()", run: adminLogin },
};

/**
 * The commands `source` could be naming — everything for an empty line, so a
 * bare `>` shows what there is rather than nothing at all.
 *
 * Prefix matching on the normalised name, so the list narrows as the name is
 * typed instead of waiting for the closing paren.
 */
export function matchPaletteCommands(source: string): PaletteCommand[] {
  const typed = commandKey(source).toLowerCase();
  return Object.entries(PALETTE_COMMANDS)
    .filter(([key]) => key.toLowerCase().startsWith(typed))
    .map(([, command]) => command);
}
