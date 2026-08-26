"use client";

import { useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { toolbar } from "../../../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { Wireframe } from "@/components/ui/wireframe";
import BoldIcon from "@/assets/icons/bold.svg";
import ItalicIcon from "@/assets/icons/italic.svg";
import UnderlineSolidIcon from "@/assets/icons/underline-solid.svg";
import StrikethroughIcon from "@/assets/icons/strikethrough.svg";
import HighlightIcon from "@/assets/icons/highlight.svg";
import CodeIcon from "@/assets/icons/code.svg";
import LinkIcon from "@/assets/icons/link.svg";
import SidenoteIcon from "@/assets/icons/sidenote.svg";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import MetricIcon from "@/assets/icons/metric.svg";

// The shared toolbar rail, plus the hairline the floating popover adds to it,
// so the inline toolbar renders in the context it ships in. `sm` is the same
// rail shrink-wrapped onto its buttons — 28px, no inset, no gap.
const edge = css({
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
});
const pill = cx(toolbar(), edge);
const pillSmall = cx(toolbar({ size: "sm" }), edge);

// A panel that mimics the slashMenuPopover surface — NO internal padding; the
// OptionList.Listbox's own 4px inset is the only gap (its plain-tone root
// collapses via display:contents, so the listbox sits directly in the panel).
const panel = css({
  width: "200px",
  backgroundColor: "bg.surface",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
});

const SLASH = [
  { value: "heading", label: "Sub-heading", Icon: SubheadingIcon },
  { value: "paragraph", label: "Paragraph", Icon: ParagraphIcon },
  { value: "blockquote", label: "Quote", Icon: QuoteIcon },
  { value: "list_item", label: "Numbered List", Icon: NumberedListIcon },
  { value: "bullet_list_item", label: "Bulleted List", Icon: BulletedListIcon },
  { value: "metric", label: "Metric", Icon: MetricIcon },
];

/** Local-only preview for the migrated Menu → OptionList toolbar + slash list. */
export default function MenuPreviewPage() {
  const [marks, setMarks] = useState<Set<string>>(new Set(["bold", "code"]));
  const toggle = (m: string) =>
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "5xl",
        padding: "5xl",
      })}
    >
      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Selection toolbar — inline OptionList.Toolbar (full converge)
        </h2>
        <div className={pill}>
          <OptionList direction="inline">
            <OptionList.Toolbar aria-label="Format selection">
              <OptionList.Option
                aria-label="Add link"
                pressed={marks.has("link")}
                onClick={() => toggle("link")}
              >
                <LinkIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Add sidenote"
                pressed={marks.has("sidenote")}
                onClick={() => toggle("sidenote")}
              >
                <SidenoteIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Divider />
              <OptionList.Option
                aria-label="Bold"
                pressed={marks.has("bold")}
                onClick={() => toggle("bold")}
              >
                <BoldIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Italic"
                pressed={marks.has("italic")}
                onClick={() => toggle("italic")}
              >
                <ItalicIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Underline"
                pressed={marks.has("underline")}
                onClick={() => toggle("underline")}
              >
                <UnderlineSolidIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Divider />
              <OptionList.Option
                aria-label="Strikethrough"
                pressed={marks.has("strikethrough")}
                onClick={() => toggle("strikethrough")}
              >
                <StrikethroughIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Highlight"
                pressed={marks.has("highlight")}
                onClick={() => toggle("highlight")}
              >
                <HighlightIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Code"
                pressed={marks.has("code")}
                onClick={() => toggle("code")}
              >
                <CodeIcon aria-hidden />
              </OptionList.Option>
            </OptionList.Toolbar>
          </OptionList>
        </div>
      </section>

      {/* The same rail at `size="sm"`: 28px tall, no inline inset, no gap, so
          the chips abut each other and reach its edges. The items go square and
          the rail keeps the only corner in the box, clipping the row's ends to
          it — so a pressed chip reads as a filled segment of one continuous
          bar rather than a rounded pill floating in a rounded box. */}
      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Small toolbar — size=&quot;sm&quot; (28px, no padding, no gap)
        </h2>
        <div className={pillSmall}>
          <OptionList direction="inline">
            <OptionList.Toolbar aria-label="Format selection (small)">
              <OptionList.Option
                aria-label="Bold"
                pressed={marks.has("bold")}
                onClick={() => toggle("bold")}
              >
                <BoldIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Italic"
                pressed={marks.has("italic")}
                onClick={() => toggle("italic")}
              >
                <ItalicIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Underline"
                pressed={marks.has("underline")}
                onClick={() => toggle("underline")}
              >
                <UnderlineSolidIcon aria-hidden />
              </OptionList.Option>
              <OptionList.Option
                aria-label="Code"
                pressed={marks.has("code")}
                onClick={() => toggle("code")}
              >
                <CodeIcon aria-hidden />
              </OptionList.Option>
            </OptionList.Toolbar>
          </OptionList>
        </div>
      </section>

      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Slash menu — plain-tone block OptionList.Listbox
        </h2>
        <div className={panel}>
          <OptionList tone="plain">
            <OptionList.Listbox aria-label="Insert block">
              {SLASH.map(({ value, label, Icon }) => (
                <OptionList.Option key={value} value={value}>
                  <Icon aria-hidden />
                  {label}
                </OptionList.Option>
              ))}
            </OptionList.Listbox>
          </OptionList>
        </div>
      </section>

      {/* Wireframe: the icon-only toolbar is unchanged — it holds no text, so
          there is nothing to bar, and a scope that blanket-greyed its subtree
          would have destroyed it. The slash list beside it keeps every glyph
          and bars only the labels. */}
      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Wireframed — an icon toolbar has no text to replace
        </h2>
        <Wireframe>
          <div className={pill}>
            <OptionList direction="inline">
              <OptionList.Toolbar aria-label="Format selection">
                <OptionList.Option aria-label="Bold" pressed>
                  <BoldIcon aria-hidden />
                </OptionList.Option>
                <OptionList.Option aria-label="Italic">
                  <ItalicIcon aria-hidden />
                </OptionList.Option>
                <OptionList.Divider />
                <OptionList.Option aria-label="Code">
                  <CodeIcon aria-hidden />
                </OptionList.Option>
              </OptionList.Toolbar>
            </OptionList>
          </div>
        </Wireframe>
      </section>

      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Wireframed slash menu — icons kept, labels barred
        </h2>
        <Wireframe>
          <div className={panel}>
            <OptionList tone="plain">
              <OptionList.Listbox aria-label="Insert block">
                {SLASH.map(({ value, label, Icon }) => (
                  <OptionList.Option key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </OptionList.Option>
                ))}
              </OptionList.Listbox>
            </OptionList>
          </div>
        </Wireframe>
      </section>

      <section className={css({ display: "flex", flexDirection: "column", gap: "lg" })}>
        <h2 className={css({ textStyle: "caption", color: "text.default/50" })}>
          Loading slash menu — rows whose labels are not known yet
        </h2>
        <Wireframe mode="loading">
          <div className={panel}>
            <OptionList tone="plain">
              <OptionList.Listbox aria-label="Insert block">
                {SLASH.map(({ value, label, Icon }) => (
                  <OptionList.Option key={value} value={value}>
                    <Icon aria-hidden />
                    {label}
                  </OptionList.Option>
                ))}
              </OptionList.Listbox>
            </OptionList>
          </div>
        </Wireframe>
      </section>
    </main>
  );
}
