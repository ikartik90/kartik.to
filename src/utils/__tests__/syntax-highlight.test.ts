import { describe, expect, it } from "vitest";
import {
  highlightCode,
  normalizeCodeLanguage,
  splitLoggerJsonMessage,
} from "../syntax-highlight";

describe("normalizeCodeLanguage", () => {
  it("normalizes common aliases", () => {
    expect(normalizeCodeLanguage("js")).toBe("javascript");
    expect(normalizeCodeLanguage("ts")).toBe("typescript");
    expect(normalizeCodeLanguage("markup")).toBe("html");
  });

  it("returns undefined for unknown languages", () => {
    expect(normalizeCodeLanguage("python")).toBeUndefined();
    expect(normalizeCodeLanguage(undefined)).toBeUndefined();
  });
});

describe("highlightCode", () => {
  it("returns neutral tokens when language is missing", () => {
    expect(highlightCode("const x = 1;", undefined)).toEqual([
      { text: "const x = 1;", role: "neutral" },
    ]);
  });

  it("highlights CSS selectors and quoted strings", () => {
    const tokens = highlightCode('.foo::before { content: "x"; }', "css");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
    expect(tokens.some((token) => token.role === "secondary")).toBe(true);
    expect(tokens.map((token) => token.text).join("")).toBe(
      '.foo::before { content: "x"; }',
    );
  });

  it("highlights JSON strings", () => {
    const tokens = highlightCode('{"status":"valid"}', "json");
    expect(tokens.some((token) => token.role === "secondary")).toBe(true);
    expect(tokens.map((token) => token.text).join("")).toBe('{"status":"valid"}');
  });

  it("highlights JavaScript keywords", () => {
    const tokens = highlightCode("const value = 'ok';", "javascript");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
    expect(tokens.some((token) => token.role === "secondary")).toBe(true);
  });

  it("highlights JSX tags", () => {
    const tokens = highlightCode("<Button />", "jsx");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
  });

  it("highlights TypeScript type keywords", () => {
    const tokens = highlightCode("type Status = 'ok';", "typescript");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
  });

  it("highlights TSX tags", () => {
    const tokens = highlightCode("<Card title=\"Hi\" />", "tsx");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
  });

  it("highlights HTML tags", () => {
    const tokens = highlightCode("<div class=\"app\"></div>", "html");
    expect(tokens.some((token) => token.role === "primary")).toBe(true);
  });

  it("highlights CSS dashed idents in values as secondary", () => {
    const declarationTokens = highlightCode(
      ":root { --color-text-default: #414244; }",
      "css",
    );
    const varNameToken = declarationTokens.find((token) =>
      token.text.includes("--color-text-default"),
    );
    expect(varNameToken?.role).toBe("primary");

    const varUsageTokens = highlightCode(
      ".btn { color: var(--color-text-default); }",
      "css",
    );
    const varCallToken = varUsageTokens.find((token) =>
      token.text.includes("var(--color-text-default)"),
    );
    expect(varCallToken?.role).toBe("secondary");

    const anchorTokens = highlightCode(
      ".trigger { anchor-name: --my-tooltip; position-anchor: --my-tooltip; }",
      "css",
    );
    const anchorValues = anchorTokens.filter((token) =>
      token.text.includes("--my-tooltip"),
    );
    expect(anchorValues.length).toBe(2);
    expect(anchorValues.every((token) => token.role === "secondary")).toBe(true);
  });
});

describe("splitLoggerJsonMessage", () => {
  it("splits a valid JSON payload from a status prefix", () => {
    const json = '{\n  "kind": "single",\n  "date": "2026-06-29"\n}';
    expect(splitLoggerJsonMessage(`✓ valid\n${json}`)).toEqual({
      prefix: "✓ valid",
      json,
    });
  });

  it("returns the full message when the trailing body is not JSON", () => {
    expect(splitLoggerJsonMessage("✕ invalid\nCould not parse input")).toEqual({
      prefix: "✕ invalid\nCould not parse input",
    });
  });

  it("returns the full message when there is no newline", () => {
    expect(splitLoggerJsonMessage("plain status")).toEqual({
      prefix: "plain status",
    });
  });
});
