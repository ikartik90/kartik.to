"use client";

import { cx } from "../../styled-system/css";
import { selectionPopover, toolbar } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
import PropertiesIcon from "@/assets/icons/slider.svg";
import TrashIcon from "@/assets/icons/trash.svg";

const toolbarClass = cx(toolbar(), selectionPopover({ align: "start" }));
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

interface CarouselToolbarProps {
  /** The pressed reorder handle, relative to the article. */
  rect: PopoverRect;
  onOpenProperties: () => void;
  onDelete: () => void;
  onDismiss: () => void;
}

export function CarouselToolbar({
  rect,
  onOpenProperties,
  onDelete,
  onDismiss,
}: CarouselToolbarProps) {
  return (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Carousel options">
          <OptionList.Option
            aria-label="Carousel properties"
            onClick={onOpenProperties}
          >
            <PropertiesIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option aria-label="Delete carousel" onClick={onDelete}>
            <TrashIcon aria-hidden />
          </OptionList.Option>
        </OptionList.Toolbar>
      </OptionList>
    </Popover>
  );
}
