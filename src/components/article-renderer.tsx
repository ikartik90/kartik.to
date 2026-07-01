import React from "react";
import { Typography, type TypographyTag, type TypographyType } from "./ui/typography";
import { HighlightedCode } from "@/components/highlighted-code";
import { inlineCode, articleLink, codeBlock, articleShowcase, articleImg, horizontalRule } from "../../styled-system/recipes";
import { ArticleComponentBlock } from "@/components/article-component-block";
import type { Document } from "@/domain/post";
import type { BlockNode, InlineNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Heading level → Typography tag + type
// ---------------------------------------------------------------------------

const HEADING_MAP: Record<number, { tag: TypographyTag; type: TypographyType }> = {
  1: { tag: "h1", type: "title" },
  2: { tag: "h2", type: "subheading" },
  3: { tag: "h3", type: "caption" },
  4: { tag: "h4", type: "caption" },
  5: { tag: "h5", type: "caption" },
  6: { tag: "h6", type: "caption" },
};


// ---------------------------------------------------------------------------
// Inline node renderer — applies marks as nested elements
// ---------------------------------------------------------------------------

function renderInlineNode(node: InlineNode, index: number): React.ReactNode {
  const { text, marks } = node;
  if (!marks || marks.length === 0) return text;

  let content: React.ReactNode = text;

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        content = <strong>{content}</strong>;
        break;
      case "italic":
        content = <em>{content}</em>;
        break;
      case "code":
        content = (
          <code className={inlineCode()}>
            {content}
          </code>
        );
        break;
      case "link":
        content = (
          <a href={mark.href} className={articleLink()}>
            {content}
          </a>
        );
        break;
    }
  }

  return <React.Fragment key={index}>{content}</React.Fragment>;
}

// ---------------------------------------------------------------------------
// Block node renderer
// ---------------------------------------------------------------------------

function renderBlockNode(node: BlockNode, index: number): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <Typography key={index} tag="p" type="paragraph">
          {node.children.map(renderInlineNode)}
        </Typography>
      );

    case "heading": {
      const { tag, type } = HEADING_MAP[node.level] ?? HEADING_MAP[2];
      return (
        <Typography key={index} tag={tag} type={type}>
          {node.children.map(renderInlineNode)}
        </Typography>
      );
    }

    case "blockquote":
      return (
        <Typography key={index} tag="blockquote" type="quote">
          {node.children.map(renderInlineNode)}
        </Typography>
      );

    case "code_block":
      return (
        <pre key={index} className={codeBlock()}>
          <HighlightedCode
            code={node.children.map((child) => child.text).join("")}
            language={node.language}
          />
        </pre>
      );

    case "horizontal_rule":
      return <hr key={index} className={horizontalRule()} />;

    case "image":
      return (
        <figure key={index} className={articleShowcase()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.src}
            alt={node.alt ?? ""}
            className={articleImg()}
            loading="lazy"
          />
          {node.caption && (
            <Typography tag="figcaption" type="caption">
              {node.caption}
            </Typography>
          )}
        </figure>
      );

    case "component":
      return (
        <ArticleComponentBlock
          key={index}
          componentId={node.componentId}
          caption={node.caption}
        />
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// ArticleRenderer
// ---------------------------------------------------------------------------

interface ArticleRendererProps {
  content: Document;
}

export function ArticleRenderer({ content }: ArticleRendererProps) {
  return <>{content.content.map(renderBlockNode)}</>;
}
