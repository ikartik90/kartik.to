import { adminLogin } from "@/utils/admin-login";

// An exact-match allowlist: input is looked up by name, never evaluated. Commands are
// never listed or hinted (no menu, no "not found"), so the admin login stays hidden.

export interface PaletteCommand {
  name: string;
  /** Must not throw; a command handles its own failure. */
  run: () => void | Promise<void>;
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: "window.adminLogin()", run: adminLogin },
];

export function resolvePaletteCommand(source: string): PaletteCommand | null {
  return PALETTE_COMMANDS.find((command) => command.name === source) ?? null;
}
