import { adminLogin } from "@/utils/admin-login";

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
// arrangement exists to not have. So the table answers nothing at all until a
// name arrives: no menu, no narrowing as you type, and no "no such command" to
// tell a stranger there is something here to find.
//
// And the name it answers to is EXACT — character for character, case and all.
// Not out of pedantry: a shorthand is a second name for a hidden thing, and
// every extra name is another way to stumble onto it. One command, one spelling,
// the one already typed into the console a hundred times.
//
// The row's own logic is not here either — `adminLogin` is a call away, and the
// half of it worth protecting is a server action behind that. This file's whole
// job is the mapping: which words reach which function. Adding a command means
// adding a line, and the palette does not change.
// ---------------------------------------------------------------------------

export interface PaletteCommand {
  /** Exactly what has to be typed after `> `, and what the row then says. */
  name: string;
  /** Do it. Never throws; a command owns its own failure. */
  run: () => void | Promise<void>;
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: "window.adminLogin()", run: adminLogin },
];

/**
 * The command `source` names, or null — the answer to anything that is not the
 * name written out in full.
 */
export function resolvePaletteCommand(source: string): PaletteCommand | null {
  return PALETTE_COMMANDS.find((command) => command.name === source) ?? null;
}
