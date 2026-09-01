import { describe, it, expect } from "vitest";
import { commandKey, parseCommandLine } from "../palette-command";

describe("parseCommandLine", () => {
  it("returns null for ordinary search text, which is not a command", () => {
    expect(parseCommandLine("shader")).toBeNull();
  });

  it("returns null for nothing typed at all", () => {
    expect(parseCommandLine("")).toBeNull();
  });

  it("returns what follows the marker and its space", () => {
    expect(parseCommandLine("> window.adminLogin()")).toBe(
      "window.adminLogin()",
    );
  });

  it("wants the space: a marker jammed against the command is not one", () => {
    expect(parseCommandLine(">window.adminLogin()")).toBeNull();
  });

  it("is not yet command mode on the marker alone — the space completes it", () => {
    expect(parseCommandLine(">")).toBeNull();
  });

  it("returns an empty command once the space arrives, nothing named yet", () => {
    expect(parseCommandLine("> ")).toBe("");
  });

  it("wants the marker first: whitespace ahead of it is an ordinary search", () => {
    expect(parseCommandLine("  > adminLogin")).toBeNull();
  });

  it("ignores a marker typed mid-search — only the opening one counts", () => {
    expect(parseCommandLine("edit > page")).toBeNull();
  });

  it("keeps a marker inside the command itself", () => {
    expect(parseCommandLine("> a > b")).toBe("a > b");
  });
});

describe("commandKey", () => {
  it("keys a bare name to itself", () => {
    expect(commandKey("adminLogin")).toBe("adminLogin");
  });

  it("drops the call parentheses, so typing the call and the name agree", () => {
    expect(commandKey("adminLogin()")).toBe("adminLogin");
  });

  it("drops the window receiver the console form carries", () => {
    expect(commandKey("window.adminLogin()")).toBe("adminLogin");
    expect(commandKey("window.adminLogin")).toBe("adminLogin");
  });

  it("ignores whitespace around and inside the call", () => {
    expect(commandKey("  window.adminLogin ( ) ")).toBe("adminLogin");
  });

  it("leaves an unknown shape alone rather than guessing at it", () => {
    expect(commandKey("fetch('/x')")).toBe("fetch('/x')");
  });

  it("keys nothing to nothing", () => {
    expect(commandKey("")).toBe("");
  });
});
