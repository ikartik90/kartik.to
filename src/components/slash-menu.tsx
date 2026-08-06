"use client";

import { slashMenuPopover } from "../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
import CollectionIcon from "@/assets/icons/collection.svg";
import ComponentIcon from "@/assets/icons/component.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CodeIcon from "@/assets/icons/code.svg";
import BorderIcon from "@/assets/icons/border.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import MetricIcon from "@/assets/icons/metric.svg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// `media`, `collection` and `component` are menu vocabulary, not terminal
// blocks: selecting one commits the block type and hands off to a dialog (image
// picker / Insert Component overlay) that fills the remaining field (src /
// items / componentId). All three ride the same onSelect(type) channel as every
// other item — the editor decides which types need a follow-up dialog.
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
  | "code_block"
  | "horizontal_rule";

export interface SlashMenuEntry {
  type: SlashMenuBlockType;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface SlashMenuProps {
  /** Characters typed after the "/" — used to filter menu items. */
  query?: string;
  /**
   * When provided, only items whose type is in this set are shown.
   * Used to hide non-text blocks (media, horizontal_rule, component) when the
   * menu is opened on an existing text block that needs type conversion.
   */
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>;
  /** The type of the block currently being edited — hidden from the list. */
  excludeType?: SlashMenuBlockType;
  onSelect: (type: SlashMenuBlockType) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

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
  { type: "code_block", label: "Code Block", Icon: CodeIcon },
  { type: "horizontal_rule", label: "Horizontal Rule", Icon: BorderIcon },
];

/**
 * Pure filter helper — exported so parent components can check whether a given
 * query/context would produce any results without mounting <SlashMenu>.
 */
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

// ---------------------------------------------------------------------------
// Component
//
// A thin domain wrapper over the shared Popover + OptionList primitives. The
// wrapper owns slash-specific data (allowedTypes/excludeType filtering); the
// OptionList owns cursor/keyboard/hover. Filtering is pre-applied here
// (non-matching options are absent from the DOM, not merely hidden), so the
// authored children ARE the filtered set and the highlight re-homes to the first
// survivor when the active one drops out.
//
// `externalKeys` keeps focus in the editor: ArrowUp/Down/Enter are captured at
// the document to drive the highlight and commit, and the option under the
// pointer is preselected on open. `tone="plain"` because the slashMenuPopover
// owns the surface. `fit="content"` because the menu IS the vocabulary — the
// shared 7-row cap belongs to lists you browse, not to one you read whole.
// Element-anchored: the editor sets `data-slash-anchor` (→ `--slash-menu`) and
// the recipe positions against it.
// ---------------------------------------------------------------------------

export function SlashMenu({
  query = "",
  allowedTypes,
  excludeType,
  onSelect,
  onDismiss,
}: SlashMenuProps) {
  const entries = getFilteredSlashMenu(query, allowedTypes, excludeType);

  return (
    <Popover className={slashMenuPopover()} onDismiss={onDismiss}>
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
