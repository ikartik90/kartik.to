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
// Nothing in it is ever LISTED. The palette's rows are what a reader can do
// with the page in front of them; a command is something you already know the
// name of, and the one below is the console handle the stealth-auth
// arrangement rests on — a row offering it is the visible login button that
// arrangement exists to not have. So the table answers whole names only, and
// answers nothing at all otherwise: no menu, no narrowing as you type, and no
// "no such command" to tell a stranger there is something here to find.
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
 * The command `source` names, or null — which is the answer to anything short
 * of the whole name, including the empty line.
 *
 * Whole names only: a partial one resolving would hand the name over a letter
 * at a time, which is the same as publishing it. The normalisation `commandKey`
 * does is not a relaxation of that — `window.adminLogin()` and `adminLogin` are
 * the SAME whole name written two ways, and you have to know it either way.
 */
export function resolvePaletteCommand(source: string): PaletteCommand | null {
  const typed = commandKey(source).toLowerCase();
  if (!typed) return null;
  return (
    Object.entries(PALETTE_COMMANDS).find(
      ([key]) => key.toLowerCase() === typed,
    )?.[1] ?? null
  );
}
