"use client";

import { useState } from "react";
import { css } from "../../styled-system/css";
import { inlineEditRow, menuIcon } from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { UnsavedDot } from "@/components/unsaved-dot";
import {
  aspectCounterpart,
  isPortraitAspect,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";
import ToLandscapeIcon from "@/assets/icons/to-landscape.svg";
import ToPortraitIcon from "@/assets/icons/to-portrait.svg";
import Ratio11Icon from "@/assets/icons/ratio-1-1.svg";
import Ratio21Icon from "@/assets/icons/ratio-2-1.svg";
import Ratio12Icon from "@/assets/icons/ratio-1-2.svg";
import Ratio32Icon from "@/assets/icons/ratio-3-2.svg";
import Ratio23Icon from "@/assets/icons/ratio-2-3.svg";
import Ratio43Icon from "@/assets/icons/ratio-4-3.svg";
import Ratio34Icon from "@/assets/icons/ratio-3-4.svg";
import Ratio65Icon from "@/assets/icons/ratio-6-5.svg";
import Ratio56Icon from "@/assets/icons/ratio-5-6.svg";
import Ratio169Icon from "@/assets/icons/ratio-16-9.svg";
import Ratio916Icon from "@/assets/icons/ratio-9-16.svg";

/** The six landscape shapes in design order; deliberately not sorted by ratio. */
const PICKER_RATIOS = [
  "1/1",
  "2/1",
  "3/2",
  "4/3",
  "6/5",
  "16/9",
] as const satisfies readonly DemoFrameAspectRatio[];

const RATIO_ICONS: Record<
  DemoFrameAspectRatio,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  "1/1": Ratio11Icon,
  "2/1": Ratio21Icon,
  "1/2": Ratio12Icon,
  "3/2": Ratio32Icon,
  "2/3": Ratio23Icon,
  "4/3": Ratio43Icon,
  "3/4": Ratio34Icon,
  "6/5": Ratio65Icon,
  "5/6": Ratio56Icon,
  "16/9": Ratio169Icon,
  "9/16": Ratio916Icon,
};

const ratioLabel = (aspect: DemoFrameAspectRatio) => aspect.replace("/", ":");

const iconStyle = menuIcon();

// Positioned so each mark hangs from its own option, and unclipped because the option recipe clips.
const markAnchorStyle = css({ position: "relative", overflow: "visible" });

// The list clips too.
const rowStyle = css({ overflow: "visible" });

// Hangs below the rail; the consumer must not clip it (see the playground's `aspectRailStyle`).
const markStyle = css({
  insetBlockStart: "calc(token(spacing.full) + token(spacing.lg))",
});

const Mark = () => <UnsavedDot className={markStyle} />;

const hint = inlineEditRow();

export interface AspectRailProps {
  aspect: DemoFrameAspectRatio;
  onPick: (aspect: DemoFrameAspectRatio) => void;
  /** Draws "Esc to exit" at the end of the row. */
  exitHint?: boolean;
  ariaLabel?: string;
  /** Shapes with unsaved work, marked with a dot; an off-row one marks the flip control. */
  markedAspects?: readonly DemoFrameAspectRatio[];
}

export function AspectRail({
  aspect,
  onPick,
  exitHint = false,
  ariaLabel = "Aspect ratio",
  markedAspects,
}: AspectRailProps) {
  // The side last shown for a square, never a flip count: a toggle drifts.
  const [squarePortrait, setSquarePortrait] = useState(false);
  const portrait = aspect === "1/1" ? squarePortrait : isPortraitAspect(aspect);

  const shown: readonly DemoFrameAspectRatio[] = portrait
    ? PICKER_RATIOS.map(aspectCounterpart)
    : PICKER_RATIOS;
  const FlipIcon = portrait ? ToLandscapeIcon : ToPortraitIcon;

  // Derived from `shown`, not orientation, because the square is in both lists.
  const marked = markedAspects ?? [];
  const markedOffRow = marked.some((ratio) => !shown.includes(ratio));

  const flip = () => {
    setSquarePortrait(!portrait);
    onPick(aspectCounterpart(aspect));
  };

  // Recorded on every pick, not just 1:1, so a square lands on the side on screen.
  const pick = (ratio: DemoFrameAspectRatio) => {
    setSquarePortrait(portrait);
    onPick(ratio);
  };

  return (
    <OptionList direction="inline" className={rowStyle}>
      <OptionList.Toolbar aria-label={ariaLabel}>
        <OptionList.Option
          className={markAnchorStyle}
          aria-label={portrait ? "Switch to landscape" : "Switch to portrait"}
          onClick={flip}
        >
          <FlipIcon className={iconStyle} />
          {markedOffRow && <Mark />}
        </OptionList.Option>
        <OptionList.Divider />

        {shown.map((ratio) => {
          const RatioIcon = RATIO_ICONS[ratio];
          return (
            <OptionList.Option
              key={ratio}
              className={markAnchorStyle}
              aria-label={ratioLabel(ratio)}
              pressed={ratio === aspect}
              onClick={() => pick(ratio)}
            >
              <RatioIcon className={iconStyle} />
              {marked.includes(ratio) && <Mark />}
            </OptionList.Option>
          );
        })}

        {exitHint && (
          <>
            <OptionList.Divider />
            <div className={hint.hint} aria-hidden>
              <span className={hint.hintKey}>Esc</span>
              <span className={hint.hintLabel}>to exit</span>
            </div>
          </>
        )}
      </OptionList.Toolbar>
    </OptionList>
  );
}
