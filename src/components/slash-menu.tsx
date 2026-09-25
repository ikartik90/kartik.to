"use client";

import { css } from "../../styled-system/css";
import { Popover } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
import CollectionIcon from "@/assets/icons/collection.svg";
import ComponentIcon from "@/assets/icons/component.svg";
import LinkIcon from "@/assets/icons/link.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CodeIcon from "@/assets/icons/code.svg";
import BorderIcon from "@/assets/icons/border.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import MetricIcon from "@/assets/icons/metric.svg";
import ButtonIcon from "@/assets/icons/button.svg";

export type SlashMenuBlockType =
  | "heading"
  | "paragraph"
  | "media"
  | "collection"
  | "component"
  | "blockquote"
  | "list_item"
  | "bullet_list_item"
  | "metric"
  | "button_link"
  | "code_block"
  | "horizontal_rule"
  | "project_grid"
  | "social_links";

export interface SlashMenuEntry {
  type: SlashMenuBlockType;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface SlashMenuProps {
  query?: string;
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>;
  /** The type of the block being edited, hidden from the list. */
  excludeType?: SlashMenuBlockType;
  onSelect: (type: SlashMenuBlockType) => void;
  onDismiss: () => void;
}

const MENU_ITEMS: SlashMenuEntry[] = [
  { type: "heading", label: "Sub-heading", Icon: SubheadingIcon },
  { type: "paragraph", label: "Paragraph", Icon: ParagraphIcon },
  { type: "media", label: "Media", Icon: MediaIcon },
  { type: "collection", label: "Collection", Icon: CollectionIcon },
  { type: "component", label: "Component", Icon: ComponentIcon },
  { type: "blockquote", label: "Quote", Icon: QuoteIcon },
  { type: "list_item", label: "Numbered List", Icon: NumberedListIcon },
  { type: "bullet_list_item", label: "Bulleted List", Icon: BulletedListIcon },
  { type: "metric", label: "Metric", Icon: MetricIcon },
  { type: "button_link", label: "Button Link", Icon: ButtonIcon },
  { type: "code_block", label: "Code Block", Icon: CodeIcon },
  { type: "horizontal_rule", label: "Horizontal Rule", Icon: BorderIcon },
  { type: "project_grid", label: "Project Grid", Icon: ComponentIcon },
  { type: "social_links", label: "Social Links", Icon: LinkIcon },
];

/** Exported so a parent can check for results without mounting the menu. */
export function getFilteredSlashMenu(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
): SlashMenuEntry[] {
  const q = query.toLowerCase();
  return MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) &&
      (!allowedTypes || allowedTypes.includes(item.type)) &&
      item.type !== excludeType,
  );
}

export function slashMenuHasResults(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return getFilteredSlashMenu(query, allowedTypes, excludeType).length > 0;
}

// Fixed, not absolute, so flip-block measures overflow against the viewport.
const slashMenuPopoverStyle = css({
  position: "fixed",
  zIndex: 50,
  width: "200px",
  positionAnchor: "--slash-menu",
  top: "anchor(bottom)",
  left: "anchor(left)",
  marginTop: "xs",
  positionTryFallbacks: "flip-block",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default":
    "var(--colors-field-bg-default-on-surface)",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  display: "flex",
  flexDirection: "column",
  overflow: "visible",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

export function SlashMenu({
  query = "",
  allowedTypes,
  excludeType,
  onSelect,
  onDismiss,
}: SlashMenuProps) {
  const entries = getFilteredSlashMenu(query, allowedTypes, excludeType);

  return (
    <Popover className={slashMenuPopoverStyle} onDismiss={onDismiss}>
      <OptionList
        tone="plain"
        fit="content"
        onValueChange={(type) => onSelect(type as SlashMenuBlockType)}
      >
        <OptionList.Listbox externalKeys loop aria-label="Insert block">
          {entries.map(({ type, label, Icon }) => (
            <OptionList.Option key={type} value={type}>
              <Icon aria-hidden />
              {label}
            </OptionList.Option>
          ))}
        </OptionList.Listbox>
      </OptionList>
    </Popover>
  );
}
