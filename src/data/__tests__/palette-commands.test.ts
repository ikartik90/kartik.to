import { describe, it, expect, vi, beforeEach } from "vitest";

// The registry's entries are what they delegate TO, so the delegate is stood in
// for: this file is about which typed text reaches which command, never about
// what that command then does.
const { mockAdminLogin } = vi.hoisted(() => ({ mockAdminLogin: vi.fn() }));

vi.mock("@/utils/admin-login", () => ({ adminLogin: () => mockAdminLogin() }));

const { PALETTE_COMMANDS, matchPaletteCommands } = await import(
  "../palette-commands"
);

const names = (source: string) =>
  matchPaletteCommands(source).map((command) => command.label);

describe("matchPaletteCommands", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers every command for a bare marker, so they can be found at all", () => {
    expect(names("")).toEqual(
      Object.values(PALETTE_COMMANDS).map((command) => command.label),
    );
  });

  it("recognises the console form the author already knows", () => {
    expect(names("window.adminLogin()")).toEqual(["window.adminLogin()"]);
  });

  it("recognises it without the call, and without the receiver", () => {
    expect(names("window.adminLogin")).toEqual(["window.adminLogin()"]);
    expect(names("adminLogin()")).toEqual(["window.adminLogin()"]);
    expect(names("adminLogin")).toEqual(["window.adminLogin()"]);
  });

  it("narrows as the name is typed, rather than waiting for the whole of it", () => {
    expect(names("admin")).toEqual(["window.adminLogin()"]);
  });

  it("does not mind the case of what was typed", () => {
    expect(names("ADMINLOGIN")).toEqual(["window.adminLogin()"]);
  });

  it("matches nothing for a command nobody registered", () => {
    expect(names("dropDatabase()")).toEqual([]);
  });

  it("runs the matched command, and nothing else", async () => {
    await matchPaletteCommands("window.adminLogin()")[0].run();

    expect(mockAdminLogin).toHaveBeenCalledTimes(1);
  });

  it("names every command by the console form that invokes it", () => {
    for (const [key, command] of Object.entries(PALETTE_COMMANDS)) {
      expect(command.label).toBe(`window.${key}()`);
    }
  });
});
