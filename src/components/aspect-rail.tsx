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

// ---------------------------------------------------------------------------
// The shape picker: six ratios and the control that turns them over (Figma
// 1022:1906).
//
// The ROW only — no rail of its own. The two surfaces that hold it want
// different boxes: on a grid card it replaces the placement toolbar inside that
// toolbar's existing chrome, and in the cover playground it stands over the
// canvas in a rail of its own. What is shared is the CONTENT — which shapes,
// in which order, under which glyphs, and what flipping one means — and that is
// exactly what is worth having one copy of.
//
// Six buttons rather than all eleven because the other five ARE these five,
// turned over: the rail shows one orientation at a time and the leading control
// flips between them, which is half the buttons for the same reach.
// ---------------------------------------------------------------------------

/**
 * The six shapes, in landscape form and in the order the design lists them.
 *
 * Not sorted by ratio, deliberately — this is the order a designer chose, and
 * re-deriving it from the numbers would put 16:9 between 3:2 and 2:1 where
 * nobody looks for it.
 */
const PICKER_RATIOS = [
  "1/1",
  "2/1",
  "3/2",
  "4/3",
  "6/5",
  "16/9",
] as const satisfies readonly DemoFrameAspectRatio[];

/**
 * A glyph per shape.
 *
 * Written out rather than derived, and it is the one place in this feature that
 * has to be: an SVG import is resolved by the bundler at build time, so there is
 * no way to build the path from the ratio at runtime. Typed as a total `Record`
 * over the ratio union so the compiler, rather than a reviewer, is what notices
 * a twelfth ratio arriving without a glyph.
 */
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

/** `"16/9"` → `"16:9"`. The key is a CSS ratio; a label is read aloud. */
const ratioLabel = (aspect: DemoFrameAspectRatio) => aspect.replace("/", ":");

const iconStyle = menuIcon();

// Every option is the anchor its own mark hangs from, and has to let it out.
//
// Applied to ALL of them rather than only the marked ones, so the box a dot is
// measured against is the same box whether or not there is a dot in it — a
// button that became positioned only while marked would be one whose geometry
// depended on its state. `position: relative` with no offsets moves nothing.
//
// Without the anchor the dot resolves its percentage against the nearest
// positioned ancestor, which on the cover playground is the 80px gutter band —
// the dot then hangs 80px down the canvas instead of 12px under its button.
//
// `overflow` is the other half, and it is the half that is invisible to a test:
// the option recipe clips its own box, so a dot hung outside it is measurable
// in the DOM, correct in every assertion, and painted nowhere. Utilities outrank
// recipes in Panda, which is what lets this be undone per consumer rather than
// by a variant nobody else wants. Nothing in this rail's options needs clipping
// — each holds one icon.
const markAnchorStyle = css({ position: "relative", overflow: "visible" });

// And the list around them, which clips too. Scoped to this rail rather than
// loosened in the recipe, for the reason above.
const rowStyle = css({ overflow: "visible" });

// Where a rail's mark hangs: BELOW the button, and outside the rail entirely.
//
// Outside rather than tucked into the rail's own inset, because the rail is a
// row of controls and this is not one — it is a note about a control, and a
// note drawn inside the chrome reads as another thing to press.
//
// `100%` is the button's own bottom edge (see `markAnchorStyle`), and the 12px
// past it clears the 6px the `md` toolbar insets its buttons by and the rail's
// hairline, leaving the dot a few pixels clear in the band below. The consumer
// has to allow it out — see the cover playground's `aspectRailStyle`.
const markStyle = css({
  insetBlockStart: "calc(token(spacing.full) + token(spacing.lg))",
});

const Mark = () => <UnsavedDot className={markStyle} />;

// The Esc hint, borrowed slot-wise from the shared inline-edit shell so a
// picker and the editor's link field wear the SAME hint rather than two that
// drift. Only the three hint slots are used — the recipe's `root` is a field
// row, which this is not.
const hint = inlineEditRow();

export interface AspectRailProps {
  /** The shape currently chosen — the one drawn pressed. */
  aspect: DemoFrameAspectRatio;
  onPick: (aspect: DemoFrameAspectRatio) => void;
  /**
   * Draws "Esc to exit" at the end of the row.
   *
   * For a rail that REPLACED something and has to say how to get back. A
   * permanent one has nothing to exit, and a hint about a key that does nothing
   * is worse than no hint.
   */
  exitHint?: boolean;
  /** Names the row. Defaults to what it is. */
  ariaLabel?: string;
  /**
   * Shapes carrying unsaved work, marked with a brand dot beneath them.
   *
   * OPT-IN, because the rail is shared: a grid card's placement toolbar picks a
   * shape and has nothing to leave unsaved, and a mark there would be a dot
   * that never lights. Only the cover playground has framing per shape.
   *
   * A shape in the orientation NOT on screen cannot carry its own mark, so the
   * flip control carries it instead — otherwise the one case these exist for
   * (work in a frame you are not looking at) is the one they would miss.
   */
  markedAspects?: readonly DemoFrameAspectRatio[];
}

export function AspectRail({
  aspect,
  onPick,
  exitHint = false,
  ariaLabel = "Aspect ratio",
  markedAspects,
}: AspectRailProps) {
  // Which orientation's shapes are shown is DERIVED from the chosen shape, not
  // held — so a picker whose aspect changes from outside it (a saved cover
  // loading into the playground a tick after mount) follows, instead of showing
  // a list with nothing pressed in it.
  //
  // The square is the one shape with no orientation to read, and it is the only
  // thing this state is for: flipping a 1:1 card turns the LIST over while the
  // card itself stays square, so that a square can be taken straight to 3:4.
  //
  // It holds the ORIENTATION LAST SHOWN, never a tally of flips — which is the
  // whole of the distinction, because a toggle drifts. Flipping a 9:16 already
  // changes the orientation through `aspect`, so counting that flip here as
  // well applied it twice, and the square then landed on whichever side the
  // parity happened to fall. Every writer below sets this to the side actually
  // on screen, so it cannot disagree with what the user is looking at.
  const [squarePortrait, setSquarePortrait] = useState(false);
  const portrait = aspect === "1/1" ? squarePortrait : isPortraitAspect(aspect);

  // Widened off `PICKER_RATIOS`'s own literal tuple, which is the landscape six
  // — the row holds either orientation, and `markedOffRow` below asks it about
  // shapes from both.
  const shown: readonly DemoFrameAspectRatio[] = portrait
    ? PICKER_RATIOS.map(aspectCounterpart)
    : PICKER_RATIOS;
  const FlipIcon = portrait ? ToLandscapeIcon : ToPortraitIcon;

  // A marked shape the row cannot show is the flip's to announce. Derived from
  // `shown` rather than from the orientation, so the square — which is in both
  // lists — can never send the mark to the flip and point at a button that is
  // already on screen.
  const marked = markedAspects ?? [];
  const markedOffRow = marked.some((ratio) => !shown.includes(ratio));

  // The card turns over with the list. Flipping only the view would strand the
  // current shape in the orientation you just left, leaving nothing pressed and
  // making "make this portrait" a two-step job. A square has no other side, so
  // `aspectCounterpart` is a no-op for 1:1 and only the list changes.
  const flip = () => {
    setSquarePortrait(!portrait);
    onPick(aspectCounterpart(aspect));
  };

  // Picking a shape carries the orientation across with it. It matters for
  // exactly one destination — 1:1, which cannot say which side it is on — but
  // it is recorded on EVERY pick rather than only that one, because the side
  // being carried is the side on screen right now, and that is knowable here
  // however the rail arrived at it: picked, flipped, or handed in from outside.
  // Reaching for it only when the square is chosen would mean reconstructing it
  // after the fact, which is the same mistake in a different place.
  const pick = (ratio: DemoFrameAspectRatio) => {
    setSquarePortrait(portrait);
    onPick(ratio);
  };

  return (
    <OptionList direction="inline" className={rowStyle}>
      <OptionList.Toolbar aria-label={ariaLabel}>
        {/* Named for what it DOES, not for the state it is in: "Switch to
            portrait" is unambiguous read alone, where a button called
            "Landscape" is either a statement or an instruction depending on who
            is reading it. */}
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
