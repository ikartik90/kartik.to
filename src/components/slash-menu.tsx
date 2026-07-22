"use client";

import { css } from "../../styled-system/css";
import { menuIcon, slashMenuPopover } from "../../styled-system/recipes";
import { Popover } from "@/components/menu/popover";
import { Menu } from "@/components/menu/menu";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
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

export type SlashMenuBlockType =
  | "heading"
  | "paragraph"
  | "media"
  | "blockquote"
  | "list_item"
  | "bullet_list_item"
  | "metric"
  | "code_block"
  | "horizontal_rule";

interface SlashMenuBlockItem {
  kind: "block";
  type: SlashMenuBlockType;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface SlashMenuComponentItem {
  kind: "component";
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type SlashMenuEntry = SlashMenuBlockItem | SlashMenuComponentItem;

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
  /**
   * Invoked when the Component item is chosen. The picker (Insert Component
   * overlay) is responsible for choosing which component to insert, so no id
   * is passed here — this simply opens it, mirroring how Media opens the image
   * dialog.
   */
  onOpenComponentPicker: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

const BLOCK_ITEMS: SlashMenuBlockItem[] = [
  { kind: "block", type: "heading", label: "Sub-heading", Icon: SubheadingIcon },
  { kind: "block", type: "paragraph", label: "Paragraph", Icon: ParagraphIcon },
  { kind: "block", type: "media", label: "Media", Icon: MediaIcon },
  { kind: "block", type: "blockquote", label: "Quote", Icon: QuoteIcon },
  {
    kind: "block",
    type: "list_item",
    label: "Numbered List",
    Icon: NumberedListIcon,
  },
  {
    kind: "block",
    type: "bullet_list_item",
    label: "Bulleted List",
    Icon: BulletedListIcon,
  },
  { kind: "block", type: "metric", label: "Metric", Icon: MetricIcon },
  { kind: "block", type: "code_block", label: "Code Block", Icon: CodeIcon },
  {
    kind: "block",
    type: "horizontal_rule",
    label: "Horizontal Rule",
    Icon: BorderIcon,
  },
];

const COMPONENT_ITEM: SlashMenuComponentItem = {
  kind: "component",
  label: "Component",
  Icon: ComponentIcon,
};

/**
 * The Component item behaves like any other menu item: the query only decides
 * whether it appears in the list (matched against its own label), never which
 * components are available — that lives entirely in the Insert Component
 * overlay.
 */
function shouldShowComponent(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
) {
  if (allowedTypes) return false;
  return COMPONENT_ITEM.label.toLowerCase().includes(query.toLowerCase());
}

export interface SlashMenuFilterResult {
  entries: SlashMenuEntry[];
  showComponent: boolean;
}

/**
 * Pure filter helper — exported so parent components can check whether a given
 * query/context would produce any results without mounting <SlashMenu>.
 */
export function getFilteredSlashMenu(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
): SlashMenuFilterResult {
  const q = query.toLowerCase();
  const blocks = BLOCK_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) &&
      (!allowedTypes || allowedTypes.includes(item.type)) &&
      item.type !== excludeType,
  );

  const showComponent = shouldShowComponent(query, allowedTypes);
  const entries: SlashMenuEntry[] = showComponent
    ? [...blocks.slice(0, 3), COMPONENT_ITEM, ...blocks.slice(3)]
    : blocks;

  return { entries, showComponent };
}

/** @deprecated Use getFilteredSlashMenu — kept for call-site compatibility. */
export function getFilteredSlashItems(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return getFilteredSlashMenu(query, allowedTypes, excludeType).entries.filter(
    (entry): entry is SlashMenuBlockItem => entry.kind === "block",
  );
}

export function slashMenuHasResults(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return (
    getFilteredSlashMenu(query, allowedTypes, excludeType).entries.length > 0
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const iconStyle = menuIcon();

const componentLabelStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  textAlign: "left",
});

// ---------------------------------------------------------------------------
// Component
//
// A thin domain wrapper over the shared Popover + Menu.Listbox primitives. The
// wrapper owns slash-specific data (allowedTypes/excludeType filtering + the
// injected Component item); the registry owns cursor/keyboard/hover. Filtering
// is pre-applied here (non-matching options are absent from the DOM, not merely
// hidden) and `query` is also handed to Menu.Listbox so the cursor re-homes to
// the first result as the query changes.
//
// Element-anchored: the editor sets `data-slash-anchor` (→ `--slash-menu`) on
// the active block, and the slashMenuPopover recipe positions against it — so
// Popover renders no synthesized anchor and no inline geometry.
// ---------------------------------------------------------------------------

export function SlashMenu({
  query = "",
  allowedTypes,
  excludeType,
  onSelect,
  onOpenComponentPicker,
  onDismiss,
}: SlashMenuProps) {
  const { entries } = getFilteredSlashMenu(query, allowedTypes, excludeType);

  return (
    <Popover
      className={slashMenuPopover()}
      role="listbox"
      ariaLabel="Insert block"
      onDismiss={onDismiss}
    >
      <Menu.Listbox query={query} loop>
        {entries.map((entry) => {
          if (entry.kind === "component") {
            return (
              <Menu.Option
                key="component"
                id="component"
                value={entry.label}
                onSelect={onOpenComponentPicker}
              >
                <entry.Icon className={iconStyle} aria-hidden />
                <span className={componentLabelStyle}>{entry.label}</span>
              </Menu.Option>
            );
          }

          const { type, label, Icon } = entry;
          return (
            <Menu.Option
              key={type}
              id={type}
              value={label}
              onSelect={() => onSelect(type)}
            >
              <Icon className={iconStyle} aria-hidden />
              {label}
            </Menu.Option>
          );
        })}
      </Menu.Listbox>
    </Popover>
  );
}
