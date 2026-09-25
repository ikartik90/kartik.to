import React from "react";
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
  articleStrikethrough,
  articleHighlight,
  articleSidenote,
  articleSidenoteText,
  articleSidenoteRef,
  articleBlockquote,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleBlockquoteMark,
  articleBlockquoteShell,
  articleHeadingShell,
  articleSubheadingCaption,
  articleListItemShell,
  listMarkerBox,
  listMarker,
  listBullet,
  listBulletIcon,
  listBulletCircle,
  articleListItemContent,
  articleMetric,
  articleMetricCaption,
  articleMetricValue,
  articleMetricLabel,
  codeBlock,
  articleShowcase,
  horizontalRule,
} from "../../styled-system/recipes";
import { css, cx } from "../../styled-system/css";
import { ArticleComponentBlock } from "@/components/article-component-block";
import {
  ButtonLink,
  buttonLinkRowStyle,
  buttonLinkStickyRowStyle,
} from "@/components/button-link";
import { CollectionShowcase } from "@/components/collection-showcase";
import { MediaShowcase } from "@/components/media-showcase";
import {
  computeListNumbering,
  type ListItemNumbering,
} from "@/utils/list-numbering";
import { SidenoteLayer } from "@/components/sidenote-layer";
import { collectSidenotes, sidenoteAnchorName } from "@/utils/sidenotes";
import type { Document } from "@/domain/post";
import {
  type BlockNode,
  type InlineNode,
  type Mark,
} from "@/domain/nodes";

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

/** Apply a node's marks as nested elements; `highlight` is applied at the run level. */
function renderStyledNode(node: InlineNode, index: number): React.ReactNode {
  const { text, marks } = node;
  if (!marks || marks.length === 0) {
    return <React.Fragment key={index}>{text}</React.Fragment>;
  }

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
      case "strikethrough":
        content = <s className={articleStrikethrough()}>{content}</s>;
        break;
      case "link":
        content = (
          <a
            href={mark.href}
            className={articleLink()}
            {...(mark.newTab && {
              target: "_blank",
              rel: "noopener noreferrer",
            })}
          >
            {content}
          </a>
        );
        break;
    }
  }

  return <React.Fragment key={index}>{content}</React.Fragment>;
}

const isHighlighted = (n: InlineNode) =>
  (n.marks ?? []).some((m) => m.type === "highlight");

const sidenoteMarkOf = (n: InlineNode): Extract<Mark, { type: "sidenote" }> | null => {
  const mark = (n.marks ?? []).find((m) => m.type === "sidenote");
  return mark?.type === "sidenote" ? mark : null;
};

/** Render a run of non-sidenote nodes, coalescing consecutive highlights into one <mark>. */
function renderRun(nodes: InlineNode[], base: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    if (isHighlighted(nodes[i])) {
      const start = i;
      const run: React.ReactNode[] = [];
      while (i < nodes.length && isHighlighted(nodes[i])) {
        run.push(renderStyledNode(nodes[i], base + i));
        i++;
      }
      out.push(
        <mark key={`hl-${base + start}`} className={articleHighlight()}>
          {run}
        </mark>,
      );
    } else {
      out.push(renderStyledNode(nodes[i], base + i));
      i++;
    }
  }
  return out;
}

function renderInlineNodes(
  nodes: InlineNode[],
  numberOf: Map<string, number>,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const sidenote = sidenoteMarkOf(nodes[i]);
    if (sidenote) {
      const start = i;
      while (i < nodes.length && sidenoteMarkOf(nodes[i])?.id === sidenote.id) {
        i++;
      }
      out.push(
        <span
          key={`sn-${start}`}
          className={articleSidenote()}
          data-sidenote-id={sidenote.id}
          style={
            { anchorName: sidenoteAnchorName(sidenote.id) } as React.CSSProperties
          }
        >
          {/* The ordinal is a sibling so the underline never runs under it. */}
          <span className={articleSidenoteText()}>
            {renderRun(nodes.slice(start, i), start)}
          </span>
          {/* Numbered at SSR so no ordinal flashes in on hydrate. */}
          <sup
            className={articleSidenoteRef()}
            data-sidenote-number={numberOf.get(sidenote.id)}
            aria-hidden
          />
        </span>,
      );
    } else {
      const start = i;
      while (i < nodes.length && !sidenoteMarkOf(nodes[i])) i++;
      out.push(...renderRun(nodes.slice(start, i), start));
    }
  }
  return out;
}

/** Page-supplied content for furniture nodes; a node without a slot renders nothing. */
export type FurnitureSlots = Partial<
  Record<"project_grid" | "social_links", React.ReactNode>
>;

function renderBlockNode(
  node: BlockNode,
  index: number,
  numberOf: Map<string, number>,
  slots: FurnitureSlots = {},
): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <Typography
          key={index}
          tag="p"
          type="bodyLarge"
          data-indented={node.indent ? "" : undefined}
          data-align={node.align}
          wrap={node.align === "center" ? "balance" : undefined}
        >
          {renderInlineNodes(node.children, numberOf)}
        </Typography>
      );

    case "heading": {
      const { tag, type } = HEADING_MAP[node.level] ?? HEADING_MAP[2];
      // The indent marker goes on the outer element: the heading, or the caption shell.
      if (!node.caption)
        return (
          <Typography
            key={index}
            tag={tag}
            type={type}
            data-indented={node.indent ? "" : undefined}
          >
            {renderInlineNodes(node.children, numberOf)}
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
            {renderInlineNodes(node.children, numberOf)}
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
          <span className={articleBlockquoteMark()} aria-hidden />
          <div className={articleBlockquoteBody()}>
            <blockquote className={articleBlockquote()}>
              {renderInlineNodes(node.children, numberOf)}
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

    case "media":
      return (
        <figure key={index} className={articleShowcase()}>
          <MediaShowcase item={node} />
          {node.caption && (
            <Typography tag="figcaption" type="caption">
              {node.caption}
            </Typography>
          )}
        </figure>
      );

    case "collection":
      if (node.items.length === 0) return null;
      return (
        <figure key={index} className={articleShowcase()}>
          <CollectionShowcase items={node.items} />
          {node.caption && (
            <Typography tag="figcaption" type="caption">
              {node.caption}
            </Typography>
          )}
        </figure>
      );

    case "button_link": {
      const label = node.text.trim();
      if (!label || !node.href) return null;
      return (
        <div
          key={index}
          data-button-link=""
          data-sticky={node.sticky ? "" : undefined}
          className={cx(
            buttonLinkRowStyle,
            node.sticky && buttonLinkStickyRowStyle,
          )}
        >
          <ButtonLink
            href={node.href}
            newTab={node.newTab}
            color={node.color}
          >
            {label}
          </ButtonLink>
        </div>
      );
    }

    case "project_grid":
    case "social_links":
      // `data-furniture` opts out of the `article > *` text-column clamp in globals.css.
      return slots[node.type] ? (
        <div key={index} data-furniture={node.type}>
          {slots[node.type]}
        </div>
      ) : null;

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
          {node.caption && (
            <span className={articleMetricCaption()}>{node.caption}</span>
          )}
          <span className={articleMetricValue()}>
            {renderInlineNodes(node.children, numberOf)}
          </span>
          {node.subtext && (
            <span className={articleMetricLabel()}>{node.subtext}</span>
          )}
        </div>
      );

    default:
      return null;
  }
}

type ListItemNode = Extract<BlockNode, { type: "list_item" }>;
type BulletListItemNode = Extract<BlockNode, { type: "bullet_list_item" }>;

const articleListStyle = css({
  listStyle: "none",
  margin: "none",
  padding: "none",
  display: "flex",
  flexDirection: "column",
  gap: "xl",
});

function renderNumberedList(
  items: ListItemNode[],
  numbering: ListItemNumbering[],
  key: React.Key,
  numberOf: Map<string, number>,
): React.ReactNode {
  return (
    <ol
      key={key}
      className={articleListStyle}
      start={numbering[0]?.ordinal ?? 1}
    >
      {items.map((item, i) => (
        <li
          key={i}
          className={articleListItemShell()}
          value={numbering[i]?.ordinal}
        >
          <span className={listMarkerBox()} aria-hidden>
            <span className={listMarker()}>
              {numbering[i]?.label ?? String(i + 1)}
            </span>
          </span>
          <span className={articleListItemContent()}>
            {renderInlineNodes(item.children, numberOf)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Resolved statically: Panda only extracts literal call sites, so a dynamic variant ships no CSS.
const BULLET_CIRCLE_CLASS = {
  check: listBulletCircle({ glyph: "check" }),
  cross: listBulletCircle({ glyph: "cross" }),
} as const;

function renderBulletList(
  items: BulletListItemNode[],
  key: React.Key,
  numberOf: Map<string, number>,
): React.ReactNode {
  return (
    <ul key={key} className={articleListStyle}>
      {items.map((item, i) => (
        <li key={i} className={articleListItemShell()}>
          {item.marker ? (
            <span className={listBulletIcon()} aria-hidden>
              <span className={BULLET_CIRCLE_CLASS[item.marker]} />
            </span>
          ) : (
            <span className={listBullet()} aria-hidden />
          )}
          <span className={articleListItemContent()}>
            {renderInlineNodes(item.children, numberOf)}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface ArticleRendererProps {
  content: Document;
  slots?: FurnitureSlots;
}

export function ArticleRenderer({ content, slots }: ArticleRendererProps) {
  const nodes = content.content;
  const output: React.ReactNode[] = [];
  const numbering = computeListNumbering(nodes);
  const sidenotes = collectSidenotes(nodes);
  const numberOf = new Map(sidenotes.map((e) => [e.id, e.number]));

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
          numberOf,
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
          numberOf,
        ),
      );
      i = j;
    } else {
      output.push(renderBlockNode(node, i, numberOf, slots));
      i++;
    }
  }

  return (
    <>
      {output}
      <SidenoteLayer entries={sidenotes} />
    </>
  );
}
