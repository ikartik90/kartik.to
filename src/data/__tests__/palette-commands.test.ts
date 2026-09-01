import { describe, it, expect, vi, beforeEach } from "vitest";

// The registry's entries are what they delegate TO, so the delegate is stood in
// for: this file is about which typed text reaches which command, never about
// what that command then does.
const { mockAdminLogin } = vi.hoisted(() => ({ mockAdminLogin: vi.fn() }));

vi.mock("@/utils/admin-login", () => ({ adminLogin: () => mockAdminLogin() }));

const { PALETTE_COMMANDS, resolvePaletteCommand } = await import(
  "../palette-commands"
);

const ADMIN_LOGIN = PALETTE_COMMANDS.find(
  (command) => command.name === "window.adminLogin()",
);

describe("resolvePaletteCommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers the admin login under the console form, exactly", () => {
    expect(ADMIN_LOGIN).toBeDefined();
  });

  it("resolves that form and runs it", async () => {
    expect(resolvePaletteCommand("window.adminLogin()")).toBe(ADMIN_LOGIN);

    await resolvePaletteCommand("window.adminLogin()")?.run();
    expect(mockAdminLogin).toHaveBeenCalledTimes(1);
  });

  // Exactly, and nothing near it. A shorthand is a second name for a hidden
  // thing, and every extra name is another way to stumble onto it — so the
  // command answers to what it is called and to nothing else.
  it("does not answer to a shorthand of its name", () => {
    for (const shorthand of [
      "adminLogin",
      "adminLogin()",
      "window.adminLogin",
      "window.adminLogin( )",
      "window .adminLogin()",
    ]) {
      expect(resolvePaletteCommand(shorthand)).toBeNull();
    }
  });

  it("does not answer to a different case", () => {
    expect(resolvePaletteCommand("window.adminlogin()")).toBeNull();
    expect(resolvePaletteCommand("WINDOW.ADMINLOGIN()")).toBeNull();
  });

  it("stays silent on a partial name, however close it gets", () => {
    for (const partial of ["w", "window.", "window.admin", "window.adminLogin("]) {
      expect(resolvePaletteCommand(partial)).toBeNull();
    }
  });

  it("does not answer to a name with something appended to it", () => {
    expect(resolvePaletteCommand("window.adminLogin()!")).toBeNull();
    expect(resolvePaletteCommand("window.adminLogin();")).toBeNull();
  });

  it("has nothing to say to an empty line — there is no menu to open", () => {
    expect(resolvePaletteCommand("")).toBeNull();
  });

  it("returns null for a command nobody registered", () => {
    expect(resolvePaletteCommand("window.dropDatabase()")).toBeNull();
  });

  it("gives every command a name to be typed and shown by", () => {
    for (const command of PALETTE_COMMANDS) {
      expect(command.name.length).toBeGreaterThan(0);
    }
  });
});
