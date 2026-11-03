import { Fragment, type ReactNode } from "react";
import { articleHighlight, inlineCode } from "../../../../styled-system/recipes";
import type { InlineNode } from "@/domain/nodes";

/** Prose: `*`s mark what's highlighted, backticks what's code. */
export function runs(text: string): InlineNode[] {
  let highlighted = false;
  return text.split(/(`[^`]*`|\*)/).flatMap((part): InlineNode[] => {
    if (part === "*") highlighted = !highlighted;
    if (part === "*" || !part) return [];
    const code = part.startsWith("`");
    const marks = [...(code ? [{ type: "code" as const }] : []), ...(highlighted ? [{ type: "highlight" as const }] : [])];
    return [{ type: "text", text: code ? part.slice(1, -1) : part, ...(marks.length ? { marks } : {}) }];
  });
}

/** `text` with what's between `*`s highlighted and between backticks set as code, as an article sets them. */
export function Marked({ text }: { text: string }) {
  return runs(text).map(({ text: part, marks = [] }, i) => {
    let content: ReactNode = part;
    if (marks.some((mark) => mark.type === "code")) content = <code className={inlineCode()}>{content}</code>;
    if (marks.some((mark) => mark.type === "highlight")) content = <mark className={articleHighlight()}>{content}</mark>;
    return <Fragment key={i}>{content}</Fragment>;
  });
}
