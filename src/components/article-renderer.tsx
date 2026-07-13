import React from "react";
import Image from "next/image";
import {
  Typography,
  type TypographyTag,
  type TypographyType,
} from "./ui/typography";
import { HighlightedCode } from "@/components/highlighted-code";
import {
  inlineCode,
  articleLink,
  articleUnderline,
  articleWavyUnderline,
  articleStrikethrough,
  articleBlockquote,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleBlockquoteMark,
  articleBlockquoteShell,
  articleHeadingShell,
  articleSubheadingCaption,
  articleList,
  articleListItemShell,
  listMarker,
  listBullet,
  listBulletIcon,
  listBulletCircle,
  menuIcon,
  articleListItemContent,
  articleMetric,
  articleMetricValue,
  articleMetricLabel,
  codeBlock,
  articleShowcase,
  articleImg,
  horizontalRule,
} from "../../styled-system/recipes";
import { ArticleComponentBlock } from "@/components/article-component-block";
import {
  computeListNumbering,
  type ListItemNumbering,
} from "@/utils/list-numbering";
import CheckSmallIcon from "@/assets/icons/check-small.svg";
import CrossSmallIcon from "@/assets/icons/cross-small.svg";
import type { Document } from "@/domain/post";
import type { BlockNode, InlineNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// Heading level → Typography tag + type
// ---------------------------------------------------------------------------

const HEADING_MAP: Record<
  number,
  { tag: TypographyTag; type: TypographyType }
> = {
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
        content = <code className={inlineCode()}>{content}</code>;
        break;
      case "underline":
        content = <u className={articleUnderline()}>{content}</u>;
        break;
      case "wavy_underline":
        content = <u className={articleWavyUnderline()}>{content}</u>;
        break;
      case "strikethrough":
        content = <s className={articleStrikethrough()}>{content}</s>;
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
        <Typography
          key={index}
          tag="p"
          type="paragraph"
          data-indented={node.indent ? "" : undefined}
        >
          {node.children.map(renderInlineNode)}
        </Typography>
      );

    case "heading": {
      const { tag, type } = HEADING_MAP[node.level] ?? HEADING_MAP[2];
      // A captionless heading is its own block root; a captioned one is wrapped
      // in the shell. Put the indent marker on whichever is the outer element.
      if (!node.caption)
        return (
          <Typography
            key={index}
            tag={tag}
            type={type}
            data-indented={node.indent ? "" : undefined}
          >
            {node.children.map(renderInlineNode)}
          </Typography>
        );
      return (
        <div
          key={index}
          className={articleHeadingShell()}
          data-indented={node.indent ? "" : undefined}
        >
          <span className={articleSubheadingCaption()}>{node.caption}</span>
          <Typography tag={tag} type={type}>
            {node.children.map(renderInlineNode)}
          </Typography>
        </div>
      );
    }

    case "blockquote":
      return (
        <div
          key={index}
          className={articleBlockquoteShell()}
          data-indented={node.indent ? "" : undefined}
        >
          <Image
            src="/assets/quote-light.png"
            alt=""
            width={52}
            height={52}
            className={articleBlockquoteMark({ theme: "light" })}
            aria-hidden
          />
          <Image
            src="/assets/quote-dark.png"
            alt=""
            width={52}
            height={52}
            className={articleBlockquoteMark({ theme: "dark" })}
            aria-hidden
          />
          <div className={articleBlockquoteBody()}>
            <blockquote className={articleBlockquote()}>
              {node.children.map(renderInlineNode)}
            </blockquote>
            {node.caption && (
              <cite className={articleBlockquoteCite()}>{node.caption}</cite>
            )}
          </div>
        </div>
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

    case "metric":
      return (
        <div
          key={index}
          className={articleMetric()}
          data-indented={node.indent ? "" : undefined}
        >
          <span className={articleMetricValue()}>
            {node.children.map(renderInlineNode)}
          </span>
          {node.caption && (
            <span className={articleMetricLabel()}>{node.caption}</span>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Lists — consecutive list items render as one <ol> (numbered) or <ul> (bulleted)
// ---------------------------------------------------------------------------

type ListItemNode = Extract<BlockNode, { type: "list_item" }>;
type BulletListItemNode = Extract<BlockNode, { type: "bullet_list_item" }>;

function renderNumberedList(
  items: ListItemNode[],
  numbering: ListItemNumbering[],
  key: React.Key,
): React.ReactNode {
  return (
    <ol
      key={key}
      className={articleList()}
      start={numbering[0]?.ordinal ?? 1}
    >
      {items.map((item, i) => (
        <li
          key={i}
          className={articleListItemShell()}
          value={numbering[i]?.ordinal}
        >
          <span className={listMarker()} aria-hidden>
            {numbering[i]?.label ?? String(i + 1)}
          </span>
          <span className={articleListItemContent()}>
            {item.children.map(renderInlineNode)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function renderBulletList(
  items: BulletListItemNode[],
  key: React.Key,
): React.ReactNode {
  return (
    <ul key={key} className={articleList()}>
      {items.map((item, i) => (
        <li key={i} className={articleListItemShell()}>
          {item.marker ? (
            <span className={listBulletIcon()} aria-hidden>
              <span className={listBulletCircle()}>
                {item.marker === "check" ? (
                  <CheckSmallIcon className={menuIcon()} />
                ) : (
                  <CrossSmallIcon className={menuIcon()} />
                )}
              </span>
            </span>
          ) : (
            <span className={listBullet()} aria-hidden />
          )}
          <span className={articleListItemContent()}>
            {item.children.map(renderInlineNode)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// ArticleRenderer
// ---------------------------------------------------------------------------

interface ArticleRendererProps {
  content: Document;
}

export function ArticleRenderer({ content }: ArticleRendererProps) {
  const nodes = content.content;
  const output: React.ReactNode[] = [];
  // Resolve ordinals/labels for the whole document so "continue numbering"
  // across separate lists lines up with the editor.
  const numbering = computeListNumbering(nodes);

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.type === "list_item") {
      let j = i;
      while (j < nodes.length && nodes[j].type === "list_item") j++;
      output.push(
        renderNumberedList(
          nodes.slice(i, j) as ListItemNode[],
          numbering.slice(i, j) as ListItemNumbering[],
          `list-${i}`,
        ),
      );
      i = j;
    } else if (node.type === "bullet_list_item") {
      let j = i;
      while (j < nodes.length && nodes[j].type === "bullet_list_item") j++;
      output.push(
        renderBulletList(
          nodes.slice(i, j) as BulletListItemNode[],
          `bullet-${i}`,
        ),
      );
      i = j;
    } else {
      output.push(renderBlockNode(node, i));
      i++;
    }
  }

  return <>{output}</>;
}
