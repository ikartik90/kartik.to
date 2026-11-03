// The code view's colours, for the code `fileOf` writes: its keywords (before the JSX starts), strings, the function's
// name, tags and their attributes, and comments.

export type Token = { kind: "plain" | "keyword" | "string" | "name" | "tag" | "attribute" | "comment"; text: string };

const KEYWORDS = new Set(["import", "from", "export", "function", "return", "default", "null"]);
const PATTERN = /(\{\/\*.*?\*\/\})|("(?:[^"\\]|\\.)*")|(<\/?)([A-Za-z][\w.]*)|([A-Za-z_$][\w$-]*)|([\s\S])/g;

type State = { inTag: boolean; depth: number; jsx: boolean };

function lineOf(line: string, state: State): Token[] {
  const tokens: Token[] = [];
  const push = (kind: Token["kind"], text: string) => {
    const last = tokens.at(-1);
    if (last?.kind === kind) last.text += text;
    else tokens.push({ kind, text });
  };
  let afterFunction = false;
  for (const [, comment, string, open, tag, word, char] of line.matchAll(PATTERN)) {
    if (comment) push("comment", comment);
    else if (string) push("string", string);
    else if (open && state.depth === 0) {
      push("plain", open);
      push("tag", tag);
      state.inTag = state.jsx = true;
    } else if (open) push("plain", open + tag);
    else if (word) {
      const kind = afterFunction ? "name" : state.inTag && state.depth === 0 ? "attribute" : !state.jsx && KEYWORDS.has(word) ? "keyword" : "plain";
      afterFunction = word === "function";
      push(kind, word);
    } else {
      // Braces count once the JSX starts, so its tags are told from what's inside an attribute's expression.
      if (state.jsx && char === "{") state.depth++;
      if (state.jsx && char === "}") state.depth--;
      if (char === ">" && state.depth === 0) state.inTag = false;
      push("plain", char);
    }
  }
  return tokens;
}

/** `code`'s lines, each as its coloured runs. */
export function highlight(code: string): Token[][] {
  const state: State = { inTag: false, depth: 0, jsx: false };
  return code.split("\n").map((line) => lineOf(line, state));
}
