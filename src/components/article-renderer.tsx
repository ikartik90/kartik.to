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
  articleList,
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
  articleImg,
  horizontalRule,
} from "../../styled-system/recipes";
import { ArticleComponentBlock } from "@/components/article-component-block";
import { CollectionShowcase } from "@/components/collection-showcase";
import { Media } from "@/components/media";
import {
  computeListNumbering,
  type ListItemNumbering,
} from "@/utils/list-numbering";
import { SidenoteLayer } from "@/components/sidenote-layer";
import { collectSidenotes, sidenoteAnchorName } from "@/utils/sidenotes";
import type { Document } from "@/domain/post";
import type { BlockNode, InlineNode, Mark } from "@/domain/nodes";

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
          <a href={mark.href} className={articleLink()}>
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

/**
 * Render a children array. Contiguous runs sharing a sidenote id are wrapped in
 * one span (carrying the note's anchor-name) holding a dotted-underline span of
 * the annotated prose followed by the superscript ordinal; everything else falls
 * through to the highlight-aware run.
 */
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
          {/* The annotated prose carries the dotted underline; the ordinal is a
              sibling, so the underline never runs under it AND the ordinal —
              a plain inline — cannot be wrapped away from the last word. */}
          <span className={articleSidenoteText()}>
            {renderRun(nodes.slice(start, i), start)}
          </span>
          {/* Ordinal is set at render (SSR) so no number flashes in on hydrate;
              SidenoteLayer keeps it live in the editor. */}
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

// ---------------------------------------------------------------------------
// Block node renderer
// ---------------------------------------------------------------------------

function renderBlockNode(
  node: BlockNode,
  index: number,
  numberOf: Map<string, number>,
): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <Typography
          key={index}
          tag="p"
          type="bodyLarge"
          data-indented={node.indent ? "" : undefined}
        >
          {renderInlineNodes(node.children, numberOf)}
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

    case "image":
      return (
        <figure key={index} className={articleShowcase()}>
          {/* A clip gets its transport here: this block IS the picture, at the
              article's full width, so there is no tile reading to protect and
              a reader who wants to stop a loop should be able to. */}
          <Media
            src={node.src}
            alt={node.alt ?? ""}
            className={articleImg()}
            loading="lazy"
            controls
          />
          {node.caption && (
            <Typography tag="figcaption" type="caption">
              {node.caption}
            </Typography>
          )}
        </figure>
      );

    case "collection":
      // An emptied collection is legal in the schema (the editor removes
      // images one at a time) but has nothing to publish.
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

// ---------------------------------------------------------------------------
// Lists — consecutive list items render as one <ol> (numbered) or <ul> (bulleted)
// ---------------------------------------------------------------------------

type ListItemNode = Extract<BlockNode, { type: "list_item" }>;
type BulletListItemNode = Extract<BlockNode, { type: "bullet_list_item" }>;

function renderNumberedList(
  items: ListItemNode[],
  numbering: ListItemNumbering[],
  key: React.Key,
  numberOf: Map<string, number>,
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

// Both glyph variants resolved STATICALLY. Panda's JIT extractor reads literal
// call sites, so `listBulletCircle({ glyph: item.marker })` emits no CSS for
// either variant — the mask never ships and the glyph renders blank in a
// production build, while dev looks fine.
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
    <ul key={key} className={articleList()}>
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
  // Document-order sidenote ordinal for each note id — drives the superscript
  // number (data-sidenote-number) and matches the aside card numbering.
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
      output.push(renderBlockNode(node, i, numberOf));
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
