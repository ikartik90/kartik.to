"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { menuIcon, toolbar } from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { PROPERTIES_TRIGGER_ATTR } from "@/components/ui/properties-panel";
import { AspectRail } from "@/components/aspect-rail";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import PinIcon from "@/assets/icons/pin.svg";
import MoveBackIcon from "@/assets/icons/move-back.svg";
import MoveForwardIcon from "@/assets/icons/move-forward.svg";
import AddColumnIcon from "@/assets/icons/add-column.svg";
import RemoveColumnIcon from "@/assets/icons/remove-column.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import CustomizeIcon from "@/assets/icons/slider.svg";
import AspectRatioIcon from "@/assets/icons/aspect-ratio.svg";

export interface GridItemToolbarProps {
  pinned: boolean;
  canMoveBack?: boolean;
  canMoveForward?: boolean;
  onTogglePin: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  canAddColumn?: boolean;
  canRemoveColumn?: boolean;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  aspect: DemoFrameAspectRatio;
  onAspectChange: (aspect: DemoFrameAspectRatio) => void;
  propertiesOpen?: boolean;
  onToggleProperties: () => void;
  /** Components only; omitting it removes the control. */
  onUnpublish?: () => void;
}

const positionStyle = css({
  position: "absolute",
  // Straddles the card's top edge; works only because the cell, unlike the card, does not clip.
  insetBlockStart: 0,
  insetInlineStart: "half",
  transform: "translate(-50%, -50%)",
  // Above the cover plate, which is itself positioned.
  zIndex: 1,

  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "hidden",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

const iconStyle = menuIcon();

type ToolbarMode = "placement" | "aspect";

export function GridItemToolbar({
  pinned,
  canMoveBack = true,
  canMoveForward = true,
  canAddColumn = true,
  canRemoveColumn = true,
  aspect,
  onTogglePin,
  onMoveBack,
  onMoveForward,
  onAddColumn,
  onRemoveColumn,
  onAspectChange,
  propertiesOpen = false,
  onToggleProperties,
  onUnpublish,
}: GridItemToolbarProps) {
  const [mode, setMode] = useState<ToolbarMode>("placement");
  const railRef = useRef<HTMLDivElement>(null);

  // On the document: a pointer user who opened the picker has focus elsewhere.
  useEffect(() => {
    if (mode !== "aspect") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMode("placement");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  // Opening the picker unmounts the pressed button, so focus moves to the current shape.
  useEffect(() => {
    if (mode !== "aspect") return;
    railRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      ?.focus();
  }, [mode]);

  return (
    <div
      // The cell fades its editing controls in by this attribute.
      data-grid-controls
      ref={railRef}
      className={`${toolbar({ size: "md", tone: "surface", fit: "hug" })} ${positionStyle}`}
    >
      {mode === "aspect" ? (
        <AspectRail aspect={aspect} onPick={onAspectChange} exitHint />
      ) : (
        <OptionList direction="inline">
          <OptionList.Toolbar aria-label="Card placement and shape">
            <OptionList.Option
              aria-label="Pin"
              pressed={pinned}
              onClick={onTogglePin}
            >
              <PinIcon className={iconStyle} />
            </OptionList.Option>

            {pinned && (
              <>
                <OptionList.Divider />
                <OptionList.Option
                  aria-label="Move back"
                  disabled={!canMoveBack}
                  onClick={onMoveBack}
                >
                  <MoveBackIcon className={iconStyle} />
                </OptionList.Option>
                <OptionList.Option
                  aria-label="Move forward"
                  disabled={!canMoveForward}
                  onClick={onMoveForward}
                >
                  <MoveForwardIcon className={iconStyle} />
                </OptionList.Option>
              </>
            )}

            {/* The width pair is disabled at its ends, not removed, so the rail never resizes under the pointer. */}
            <OptionList.Divider />
            <OptionList.Option
              aria-label="Aspect ratio"
              onClick={() => setMode("aspect")}
            >
              <AspectRatioIcon className={iconStyle} />
            </OptionList.Option>
            <OptionList.Option
              aria-label="Add column"
              disabled={!canAddColumn}
              onClick={onAddColumn}
            >
              <AddColumnIcon className={iconStyle} />
            </OptionList.Option>
            <OptionList.Option
              aria-label="Remove column"
              disabled={!canRemoveColumn}
              onClick={onRemoveColumn}
            >
              <RemoveColumnIcon className={iconStyle} />
            </OptionList.Option>

            {/* Marked as the panel's trigger so a second press closes it; see PROPERTIES_TRIGGER_ATTR. */}
            <OptionList.Divider />
            <OptionList.Option
              {...PROPERTIES_TRIGGER_ATTR}
              aria-label="Customize"
              pressed={propertiesOpen}
              onClick={onToggleProperties}
            >
              <CustomizeIcon className={iconStyle} />
            </OptionList.Option>

            {onUnpublish && (
              <>
                <OptionList.Divider />
                <OptionList.Option aria-label="Unpublish" onClick={onUnpublish}>
                  <UnpublishIcon className={iconStyle} />
                </OptionList.Option>
              </>
            )}
          </OptionList.Toolbar>
        </OptionList>
      )}
    </div>
  );
}
