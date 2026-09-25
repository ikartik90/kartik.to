// Only an opening "> " (space required) starts command mode. Nothing is evaluated:
// the text is looked up by exact name in `data/palette-commands.ts`.

export const COMMAND_PREFIX = "> ";

/** Null for an ordinary search; "" is command mode with nothing named yet. */
export function parseCommandLine(input: string): string | null {
  if (!input.startsWith(COMMAND_PREFIX)) return null;
  return input.slice(COMMAND_PREFIX.length).trim();
}
