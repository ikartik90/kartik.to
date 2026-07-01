import { refractor } from "refractor/core";
import css from "refractor/css";
import javascript from "refractor/javascript";
import json from "refractor/json";
import jsx from "refractor/jsx";
import markup from "refractor/markup";
import tsx from "refractor/tsx";
import typescript from "refractor/typescript";
import type { Element, Root, Text } from "hast";
import {
  CodeLanguageSchema,
  type CodeLanguage,
} from "@/domain/nodes";

export type { CodeLanguage };

export type SyntaxTokenRole = "primary" | "secondary" | "neutral" | "comment";

export interface HighlightToken {
  text: string;
  role: SyntaxTokenRole;
}

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  html: "HTML",
  css: "CSS",
  json: "JSON",
  javascript: "JavaScript",
  jsx: "JSX",
  typescript: "TypeScript",
  tsx: "TSX",
};

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  html: "html",
  markup: "html",
  css: "css",
  json: "json",
  javascript: "javascript",
  js: "javascript",
  jsx: "jsx",
  typescript: "typescript",
  ts: "typescript",
  tsx: "tsx",
};

const PRIMARY_TOKEN_TYPES = new Set([
  "atrule",
  "builtin",
  "class-name",
  "function",
  "important",
  "keyword",
  "property",
  "selector",
  "tag",
]);

const SECONDARY_TOKEN_TYPES = new Set([
  "attr-value",
  "boolean",
  "char",
  "constant",
  "inserted",
  "number",
  "regex",
  "string",
  "symbol",
]);

refractor.register(markup);
refractor.register(css);
refractor.register(json);
refractor.register(javascript);
refractor.register(jsx);
refractor.register(typescript);
refractor.register(tsx);

function mapTokenRole(tokenType: string): SyntaxTokenRole {
  if (tokenType === "comment") return "comment";
  if (PRIMARY_TOKEN_TYPES.has(tokenType)) return "primary";
  if (SECONDARY_TOKEN_TYPES.has(tokenType)) return "secondary";
  return "neutral";
}

function elementText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === "text") return child.value;
      if (child.type === "element") return elementText(child);
      return "";
    })
    .join("");
}

function nodesToTokens(nodes: Array<Element | Text>): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value) tokens.push({ text: node.value, role: "neutral" });
      continue;
    }

    const classNames = node.properties?.className;
    if (Array.isArray(classNames) && classNames.includes("token")) {
      const tokenType =
        classNames.find((name) => typeof name === "string" && name !== "token") ??
        "plain";
      tokens.push({
        text: elementText(node),
        role: mapTokenRole(String(tokenType)),
      });
      continue;
    }

    tokens.push(...nodesToTokens(node.children as Array<Element | Text>));
  }

  return tokens;
}

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

const CSS_DASHED_IDENT = /--[\w-]+/;
const CSS_DASHED_IDENT_GLOBAL = /--[\w-]+/g;
const CSS_CUSTOM_PROPERTY_NAME_PATTERN = /^--[\w-]+$/;

function isCssCustomPropertyName(token: HighlightToken): boolean {
  return (
    token.role === "primary" &&
    CSS_CUSTOM_PROPERTY_NAME_PATTERN.test(token.text.trim())
  );
}

function splitCssDashedIdents(
  text: string,
  baseRole: SyntaxTokenRole,
): HighlightToken[] {
  const parts: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CSS_DASHED_IDENT_GLOBAL)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, index),
        role: baseRole,
      });
    }

    parts.push({
      text: match[0],
      role: "secondary",
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      role: baseRole,
    });
  }

  return parts.length > 0 ? parts : [{ text, role: baseRole }];
}

/** Highlight dashed custom idents in CSS values, including var() and anchor names. */
export function promoteCssCustomIdents(tokens: HighlightToken[]): HighlightToken[] {
  const mergedVarCalls: HighlightToken[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.text === "var" && tokens[index + 1]?.text === "(") {
      const start = index;
      index += 2;
      let depth = 1;

      while (index < tokens.length && depth > 0) {
        depth += countChar(tokens[index].text, "(");
        depth -= countChar(tokens[index].text, ")");
        index += 1;
      }

      mergedVarCalls.push({
        text: tokens
          .slice(start, index)
          .map((part) => part.text)
          .join(""),
        role: "secondary",
      });
      continue;
    }

    mergedVarCalls.push(token);
    index += 1;
  }

  const result: HighlightToken[] = [];

  for (const token of mergedVarCalls) {
    if (token.role === "comment" || isCssCustomPropertyName(token)) {
      result.push(token);
      continue;
    }

    if (token.role === "secondary" && CSS_DASHED_IDENT.test(token.text)) {
      result.push(token);
      continue;
    }

    if (!CSS_DASHED_IDENT.test(token.text)) {
      result.push(token);
      continue;
    }

    result.push(...splitCssDashedIdents(token.text, token.role));
  }

  return result;
}

export function normalizeCodeLanguage(
  language: string | undefined,
): CodeLanguage | undefined {
  if (!language) return undefined;

  const normalized = LANGUAGE_ALIASES[language.trim().toLowerCase()];
  if (!normalized) return undefined;

  return CodeLanguageSchema.safeParse(normalized).success
    ? normalized
    : undefined;
}

export function highlightCode(
  code: string,
  language: string | undefined,
): HighlightToken[] {
  const normalized = normalizeCodeLanguage(language);
  if (!normalized) {
    return code ? [{ text: code, role: "neutral" }] : [];
  }

  try {
    const tree = refractor.highlight(code, normalized) as Root;
    let tokens = nodesToTokens(tree.children as Array<Element | Text>);
    if (normalized === "css") {
      tokens = promoteCssCustomIdents(tokens);
    }
    return tokens.length > 0 ? tokens : [{ text: code, role: "neutral" }];
  } catch {
    return [{ text: code, role: "neutral" }];
  }
}

export function splitLoggerJsonMessage(message: string): {
  prefix?: string;
  json?: string;
} {
  const newlineIndex = message.indexOf("\n");
  if (newlineIndex === -1) {
    return { prefix: message };
  }

  const prefix = message.slice(0, newlineIndex);
  const jsonCandidate = message.slice(newlineIndex + 1);

  try {
    JSON.parse(jsonCandidate);
    return { prefix, json: jsonCandidate };
  } catch {
    return { prefix: message };
  }
}
