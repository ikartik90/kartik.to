import { Fragment } from "react";
import { articleHighlight } from "../../../styled-system/recipes";

/** `text` with what's between `*`s highlighted, as an article highlights it. */
export function Marked({ text }: { text: string }) {
  return text.split("*").map((part, i) =>
    i % 2 ? (
      <mark key={i} className={articleHighlight()}>
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
