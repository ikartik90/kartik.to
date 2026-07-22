"use client";

import { css } from "../../styled-system/css";
import {
  highlightCode,
  normalizeCodeLanguage,
  type SyntaxTokenRole,
} from "@/utils/syntax-highlight";

interface HighlightedCodeProps {
  code: string;
  language?: string;
  className?: string;
}

const syntaxPrimaryStyle = css({ color: "brand.pink" });
const syntaxSecondaryStyle = css({ color: "brand.orange" });
const syntaxNeutralStyle = css({ color: "text.default" });
const syntaxCommentStyle = css({ color: "text.body" });

const SYNTAX_ROLE_CLASS: Record<SyntaxTokenRole, string> = {
  primary: syntaxPrimaryStyle,
  secondary: syntaxSecondaryStyle,
  neutral: syntaxNeutralStyle,
  comment: syntaxCommentStyle,
};

export function HighlightedCode({
  code,
  language,
  className,
}: HighlightedCodeProps) {
  const normalized = normalizeCodeLanguage(language);

  if (!normalized) {
    return <code className={className}>{code}</code>;
  }

  const tokens = highlightCode(code, language);

  return (
    <code className={className}>
      {tokens.map((token, index) => (
        <span
          key={`${index}-${token.text.slice(0, 12)}`}
          className={SYNTAX_ROLE_CLASS[token.role]}
          data-syntax-role={token.role}
        >
          {token.text}
        </span>
      ))}
    </code>
  );
}
