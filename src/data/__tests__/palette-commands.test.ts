import { describe, it, expect, vi, beforeEach } from "vitest";

// The registry's entries are what they delegate TO, so the delegate is stood in
// for: this file is about which typed text reaches which command, never about
// what that command then does.
const { mockAdminLogin } = vi.hoisted(() => ({ mockAdminLogin: vi.fn() }));

vi.mock("@/utils/admin-login", () => ({ adminLogin: () => mockAdminLogin() }));

const { PALETTE_COMMANDS, resolvePaletteCommand } = await import(
  "../palette-commands"
);

describe("resolvePaletteCommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recognises the console form the author already knows", () => {
    expect(resolvePaletteCommand("window.adminLogin()")).toBe(
      PALETTE_COMMANDS.adminLogin,
    );
  });

  it("recognises it without the call, and without the receiver", () => {
    for (const written of [
      "window.adminLogin",
      "adminLogin()",
      "adminLogin",
    ]) {
      expect(resolvePaletteCommand(written)).toBe(PALETTE_COMMANDS.adminLogin);
    }
  });

  it("does not mind the case of what was typed", () => {
    expect(resolvePaletteCommand("ADMINLOGIN")).toBe(
      PALETTE_COMMANDS.adminLogin,
    );
  });

  // Hidden, and hidden means hidden: a command answers to its whole name or it
  // does not answer. Prefix matching would hand the name to anyone patient
  // enough to type one letter at a time, which is the same as printing it.
  it("stays silent on a partial name, however close it gets", () => {
    for (const partial of ["a", "admin", "adminLogi", "window.admin"]) {
      expect(resolvePaletteCommand(partial)).toBeNull();
    }
  });

  it("has nothing to say to an empty line — there is no menu to open", () => {
    expect(resolvePaletteCommand("")).toBeNull();
    expect(resolvePaletteCommand("   ")).toBeNull();
  });

  it("returns null for a command nobody registered", () => {
    expect(resolvePaletteCommand("dropDatabase()")).toBeNull();
  });

  it("does not answer to a name with something appended to it", () => {
    expect(resolvePaletteCommand("adminLoginNow")).toBeNull();
  });

  it("runs the resolved command, and nothing else", async () => {
    await resolvePaletteCommand("window.adminLogin()")?.run();

    expect(mockAdminLogin).toHaveBeenCalledTimes(1);
  });

  it("names every command by the console form that invokes it", () => {
    for (const [key, command] of Object.entries(PALETTE_COMMANDS)) {
      expect(command.label).toBe(`window.${key}()`);
    }
  });
});
