"use client";

import { useState } from "react";
import { cx } from "../../styled-system/css";
import { selectionPopover, toolbar } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { LinkActions, LinkEditRow } from "@/components/link-toolbar";
import {
  ButtonLinkHrefSchema,
  type ButtonLinkColor,
  type ButtonLinkNode,
} from "@/domain/nodes";
import { normalizeLinkHref } from "@/utils/link-href";

const toolbarClass = cx(toolbar(), selectionPopover({ align: "start" }));
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

/** Off removes the field, so an untouched button saves exactly as before. */
function withFlag(
  block: ButtonLinkNode,
  flag: "newTab" | "sticky",
  on: boolean,
): ButtonLinkNode {
  const { [flag]: _, ...rest } = block;
  return on ? { ...rest, [flag]: true } : rest;
}

/** Neutral removes the field, as an off flag does. */
function withColor(
  block: ButtonLinkNode,
  color: ButtonLinkColor,
): ButtonLinkNode {
  const { color: _, ...rest } = block;
  return color === "neutral" ? rest : { ...rest, color };
}

interface ButtonLinkToolbarProps {
  rect: PopoverRect;
  block: ButtonLinkNode;
  onChange: (block: ButtonLinkNode) => void;
  onDelete: () => void;
  /** The address row closed, applied or not. */
  onEditEnd: () => void;
  onDismiss: () => void;
}

export function ButtonLinkToolbar({
  rect,
  block,
  onChange,
  onDelete,
  onEditEnd,
  onDismiss,
}: ButtonLinkToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const endEdit = () => {
    setEditing(false);
    setInvalid(false);
    onEditEnd();
  };

  const applyHref = (typed: string, newTab: boolean) => {
    const href = normalizeLinkHref(typed);
    if (!ButtonLinkHrefSchema.safeParse(href).success) {
      setInvalid(true);
      return;
    }
    onChange(withFlag({ ...block, href }, "newTab", newTab));
    endEdit();
  };

  return editing ? (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      role="toolbar"
      ariaLabel="Edit link"
      dismissOnOutsidePointer={false}
      onDismiss={endEdit}
    >
      <LinkEditRow
        href={block.href}
        newTab={block.newTab}
        invalid={invalid}
        onInput={() => setInvalid(false)}
        onApply={applyHref}
      />
    </Popover>
  ) : (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <LinkActions
        canOpen={block.href !== ""}
        removeLabel="Delete button link"
        sticky={block.sticky}
        onToggleSticky={() =>
          onChange(withFlag(block, "sticky", !block.sticky))
        }
        color={block.color}
        onColorChange={(color) => onChange(withColor(block, color))}
        onEdit={() => setEditing(true)}
        onOpen={() => window.open(block.href, "_blank", "noopener,noreferrer")}
        onRemove={onDelete}
      />
    </Popover>
  );
}
