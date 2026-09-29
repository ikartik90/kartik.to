"use client";

import { cx } from "../../styled-system/css";
import { selectionPopover, toolbar } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
import type { HeadingNode } from "@/domain/nodes";
import FontSizeIcon from "@/assets/icons/font-size.svg";
import HeadingEyebrowIcon from "@/assets/icons/heading-eyebrow.svg";
import IndentLeftIcon from "@/assets/icons/indent-left.svg";
import IndentRightIcon from "@/assets/icons/indent-right.svg";

const toolbarClass = cx(toolbar(), selectionPopover({ align: "start" }));
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

/** Off removes the field, so an untouched heading saves exactly as before. */
function withFlag(
  block: HeadingNode,
  field: "large" | "indentLeft" | "indentRight",
  on: boolean,
): HeadingNode {
  const { [field]: _, ...rest } = block;
  return on ? { ...rest, [field]: true } : rest;
}

function withEyebrow(block: HeadingNode, on: boolean): HeadingNode {
  const { caption: _, ...rest } = block;
  return on ? { ...rest, caption: "" } : rest;
}

interface HeadingToolbarProps {
  /** The pressed reorder handle, relative to the article. */
  rect: PopoverRect;
  block: HeadingNode;
  onChange: (block: HeadingNode) => void;
  onDismiss: () => void;
}

export function HeadingToolbar({
  rect,
  block,
  onChange,
  onDismiss,
}: HeadingToolbarProps) {
  const eyebrow = block.caption !== undefined;
  const large = block.large === true;
  const indentLeft = block.indentLeft === true;
  const indentRight = block.indentRight === true;

  return (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Heading options">
          <OptionList.Option
            aria-label="Eyebrow"
            pressed={eyebrow}
            onClick={() => onChange(withEyebrow(block, !eyebrow))}
          >
            <HeadingEyebrowIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option
            aria-label="Large"
            pressed={large}
            onClick={() => onChange(withFlag(block, "large", !large))}
          >
            <FontSizeIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Divider />
          <OptionList.Option
            aria-label="Indent left"
            pressed={indentLeft}
            onClick={() => onChange(withFlag(block, "indentLeft", !indentLeft))}
          >
            <IndentLeftIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option
            aria-label="Indent right"
            pressed={indentRight}
            onClick={() =>
              onChange(withFlag(block, "indentRight", !indentRight))
            }
          >
            <IndentRightIcon aria-hidden />
          </OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>
    </Popover>
  );
}
