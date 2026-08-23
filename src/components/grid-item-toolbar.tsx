"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { inlineEditRow, menuIcon, toolbar } from "../../styled-system/recipes";
import { OptionList } from "@/components/ui/input/option-list";
import { PROPERTIES_TRIGGER_ATTR } from "@/components/ui/properties-panel";
import {
  aspectCounterpart,
  isPortraitAspect,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";
import PinIcon from "@/assets/icons/pin.svg";
import MoveBackIcon from "@/assets/icons/move-back.svg";
import MoveForwardIcon from "@/assets/icons/move-forward.svg";
import AddColumnIcon from "@/assets/icons/add-column.svg";
import RemoveColumnIcon from "@/assets/icons/remove-column.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import CustomizeIcon from "@/assets/icons/slider.svg";
import AspectRatioIcon from "@/assets/icons/aspect-ratio.svg";
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
// The controls that appear over a grid card while the grid is being edited
// (Figma 978:1981).
//
// Built entirely out of the chrome the editor's own toolbars already wear —
// `toolbar()` for the rail, `OptionList.Toolbar` for the buttons, and
// `OptionList.Divider` between the groups. That is not just reuse for its own
// sake: the rail's md size is a 40px box with a 4px gap and an 8px corner,
// which is the design's 40/4/8, and a pressed option already paints `field.bg.active` — brand orange at 25% in dark, which is the
// design's `rgba(255,171,111,0.25)` for the pinned pin. Restating either as a
// local style would be a second copy that drifts the first time the palette
// moves.
//
// Two deliberate differences from the Figma frame, both of them the shared
// chrome winning over a single frame's numbers. The separators there are
// neutral-500 at 25%, while `border.divider` is 25% in light and 50% in dark:
// this toolbar shares a screen with the selection toolbar and the slash menu,
// and a separator that is uniquely lighter here would read as a mistake in the
// one place it differs rather than as an intention. And the frame insets its
// buttons 8px from the ends where the rail now insets them 6 — a change made
// on the recipe, so every toolbar in the app moved together.
//
// Pin is a TOGGLE (`aria-pressed`) and keeps its label in both states, rather
// than relabelling to "Unpin" — a toggle that renames itself is read out twice
// by a screen reader, once as the state and once as the name, and the two
// disagree about which way round they are.
// ---------------------------------------------------------------------------

export interface GridItemToolbarProps {
  /** Whether this card currently holds a seat of its own. */
  pinned: boolean;
  /**
   * Whether the pinned card can still go that way, or is already at an end of
   * the grid. Only consulted when the card is pinned — an unpinned one is not
   * offered the moves at all.
   */
  canMoveBack?: boolean;
  canMoveForward?: boolean;
  onTogglePin: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  /**
   * Whether the card can still get wider or narrower.
   *
   * Two booleans rather than the span itself, so this component never has to
   * know how many columns the grid has — that is the caller's arithmetic, and
   * it changes with the number of cards on the page.
   */
  canAddColumn?: boolean;
  canRemoveColumn?: boolean;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  /**
   * The shape the card is drawn at.
   *
   * A property of the CARD, not of its placement — a component's own `aspect`
   * column, a post's — so unlike the pin and the span it travels with the
   * record rather than describing where the record happens to sit.
   */
  aspect: DemoFrameAspectRatio;
  onAspectChange: (aspect: DemoFrameAspectRatio) => void;
  /**
   * Whether THIS card's properties panel is the one currently open — the
   * PANEL's state, not the card's, which is why it is a prop where the shape
   * picker's `mode` is local: the panel is a single docked surface shared by
   * every cell in the grid, so only its owner knows which card has it.
   */
  propertiesOpen?: boolean;
  /** Opens the panel — or closes it, if this card's is the one already open. */
  onToggleProperties: () => void;
  /**
   * Components only, and the reason this is optional rather than a boolean: an
   * article is unpublished from its own page, so a card for one must not offer
   * a second route to it. Passing no handler is what makes the control absent.
   */
  onUnpublish?: () => void;
}

const positionStyle = css({
  position: "absolute",
  // Centred on the card's TOP EDGE — half above it, half over it (Figma
  // 974:1863, `top: -20.5px` on a 40px rail).
  //
  // Expressed as "put my centre on the edge" rather than as a -20px offset, so
  // it stays correct if the rail's height ever changes; the frame's extra half
  // pixel is its own 0.5px card border, which ours does not have.
  //
  // Straddling only works because the CELL does not clip. The card inside it
  // does — it has to, to hold its cover to the rounded corners — which is
  // exactly why this toolbar is a sibling of the card rather than a child.
  insetBlockStart: 0,
  insetInlineStart: "half",
  transform: "translate(-50%, -50%)",
  // Above the cover plate, which is itself positioned.
  zIndex: 1,

  // What floating costs — the hairline, the elevation, the clip — in the same
  // values `selectionPopover` spends on it, because this is the second piece of
  // chrome in the app to float over content and the two should not separate
  // from the page by different amounts. That recipe itself cannot be composed
  // in: it is `position: fixed` on a CSS anchor, which is right for a menu
  // pinned to a text selection and wrong for a control that belongs to a card.
  //
  // The Figma frame carries none of this, and does not need to: the card behind
  // it there is a transparent box, so a `bg.surface` chip already reads as
  // raised. Ours is a real card whose cover is a flat `bg.surface` plate until
  // posters land — the identical colour — so without an edge the toolbar simply
  // disappears into it. The elevation is also what will keep it legible once
  // the cover is a photograph and its ground is whatever the picture happens to
  // be under those 40 pixels.
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "hidden",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

const iconStyle = menuIcon();
// The Esc hint, borrowed slot-wise from the shared inline-edit shell so the
// grid's picker and the editor's link field wear the SAME hint rather than two
// that drift. Only the three hint slots are used — the recipe's `root` is a
// field row, which this is not.
const hint = inlineEditRow();

/** Which face the rail is showing. */
type ToolbarMode = "placement" | "aspect";

/**
 * The six shapes the picker offers, in landscape form and in the order the
 * design lists them (Figma 1022:1906).
 *
 * Six rather than all eleven because the other five ARE these five, turned
 * over: the rail shows one orientation at a time and the leading control flips
 * between them, which is half the buttons for the same reach. Not sorted by
 * ratio, deliberately — this is the order a designer chose, and re-deriving it
 * from the numbers would put 16:9 between 3:2 and 2:1 where nobody looks for it.
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
 * over the ratio union so the compiler, rather than a reviewer, is what notices a
 * twelfth ratio arriving without a glyph.
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
  // Which face the rail is wearing, and — while it is the picker — which
  // orientation's shapes are on it.
  //
  // Local, unlike the selection toolbar's `mode`, which is a prop. That one is
  // lifted because the EDITOR decides it: a caret landing inside a link puts
  // the rail into link-view without anyone pressing anything. Nothing outside
  // this component has any say in whether a card's shape picker is open, so
  // lifting it would be a prop that only ever travels back down.
  const [mode, setMode] = useState<ToolbarMode>("placement");
  const [portrait, setPortrait] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    // Opens on the orientation the card is ALREADY in, so the shape it has is
    // the one on screen rather than one flip away.
    setPortrait(isPortraitAspect(aspect));
    setMode("aspect");
  };

  const flipOrientation = () => {
    setPortrait((was) => !was);
    // The card turns over with the list. Flipping only the view would strand
    // the current shape in the orientation you just left, leaving nothing
    // pressed and making "make this portrait" a two-step job. A square has no
    // other side, so this is a no-op for 1:1 and only the list changes.
    onAspectChange(aspectCounterpart(aspect));
  };

  // Esc leaves the picker. On the document rather than the rail, because the
  // rail is revealed by HOVER as often as by focus: a pointer user who opened
  // the picker has focus nowhere near it, and a handler bound to the element
  // would never see the key.
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

  // Opening the picker destroys the button that was pressed to open it, which
  // for a keyboard user drops focus onto the body and strands them outside a
  // rail they cannot see. Hand focus to the shape the card is already at — the
  // nearest thing to "where you were" — the same way the link editor focuses
  // its field on the way in.
  useEffect(() => {
    if (mode !== "aspect") return;
    railRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      ?.focus();
  }, [mode]);

  return (
    <div
      // Marks this as one of the grid cell's editing controls, which is what
      // the cell fades in on hover. An explicit contract rather than the cell
      // reaching in by class name, which would break the moment Panda renames
      // one.
      data-grid-controls
      ref={railRef}
      className={`${toolbar({ size: "md", tone: "surface", fit: "hug" })} ${positionStyle}`}
    >
      {mode === "aspect" ? (
        <AspectRail
          aspect={aspect}
          portrait={portrait}
          onPick={onAspectChange}
          onFlip={flipOrientation}
        />
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

            {/* Absent, not disabled, until the card is pinned. A card with no
                seat has nothing to move, and a permanently greyed pair of
                arrows on every unpinned card is a control that only ever
                explains why you cannot use it. */}
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

            {/* The SHAPE group (Figma 978:1941): what the card is, as opposed
                to where it goes. Aspect ratio leads it because it is the one
                that changes the card's own record — a component's `aspect`
                override, a post's — while the width pair either side of it is
                a fact about the grid.

                The width pair is disabled at its ends rather than removed,
                which is the opposite of what the moves do a group back, and
                the difference is real rather than an inconsistency. A card
                with no seat has NO position to move, so the moves are
                inapplicable and go. A card is always some number of columns
                wide, so this pair always applies; only one end of it is
                momentarily unavailable, and a control that disappeared at full
                width would resize the rail every time you resized the card,
                right under the pointer that is pressing it. */}
            <OptionList.Divider />
            <OptionList.Option aria-label="Aspect ratio" onClick={openPicker}>
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

            {/* Everything about the card the rail cannot say in icons, in the
                docked inspector the collection editor already uses for a
                picture's properties (Figma 845:7223) — for a logging component
                that is whether its log output is on show.

                A group of its own, between the edits and the retirement,
                because it is a different KIND of control: every other button
                here changes the card on the spot, where this one opens a
                surface to change it from. Present on every card, including the
                ones whose panel is currently near-empty — what a card's
                properties are differs by kind, that it has some does not.

                Pressed while its own panel is open — the state it reports is
                the panel's, not the card's — and marked as the panel's trigger
                so that second press actually closes it rather than reopening
                it on the way out. See PROPERTIES_TRIGGER_ATTR. */}
            <OptionList.Divider />
            <OptionList.Option
              {...PROPERTIES_TRIGGER_ATTR}
              aria-label="Customize"
              pressed={propertiesOpen}
              onClick={onToggleProperties}
            >
              <CustomizeIcon className={iconStyle} />
            </OptionList.Option>

            {/* Last, and alone. Retiring a card is not a layout edit, and a
                destructive control sitting among the ones you press repeatedly
                while nudging a grid into shape is a control you will
                eventually press by accident. */}
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

/**
 * The rail's second face: pick a shape, or turn the card over (Figma
 * 1022:1906).
 *
 * A replacement for the placement rail rather than a menu hanging off it, which
 * is the same metamorphosis the selection toolbar performs for the link editor
 * — and for the same reason. The rail already floats over a card in a grid of
 * near-identical cards; a popover opening off a popover would be a second thing
 * to place, a second thing to dismiss, and one more layer between the control
 * and the card it is about.
 */
function AspectRail({
  aspect,
  portrait,
  onPick,
  onFlip,
}: {
  aspect: DemoFrameAspectRatio;
  portrait: boolean;
  onPick: (aspect: DemoFrameAspectRatio) => void;
  onFlip: () => void;
}) {
  const shown = portrait ? PICKER_RATIOS.map(aspectCounterpart) : PICKER_RATIOS;
  const FlipIcon = portrait ? ToLandscapeIcon : ToPortraitIcon;

  return (
    <OptionList direction="inline">
      <OptionList.Toolbar aria-label="Aspect ratio">
        {/* Named for what it DOES, not for the state it is in: "Switch to
            portrait" is unambiguous read alone, where a button called
            "Landscape" is either a statement or an instruction depending on who
            is reading it. */}
        <OptionList.Option
          aria-label={portrait ? "Switch to landscape" : "Switch to portrait"}
          onClick={onFlip}
        >
          <FlipIcon className={iconStyle} />
        </OptionList.Option>
        <OptionList.Divider />

        {shown.map((ratio) => {
          const RatioIcon = RATIO_ICONS[ratio];
          return (
            <OptionList.Option
              key={ratio}
              aria-label={ratioLabel(ratio)}
              pressed={ratio === aspect}
              onClick={() => onPick(ratio)}
            >
              <RatioIcon className={iconStyle} />
            </OptionList.Option>
          );
        })}

        <OptionList.Divider />
        {/* The only way out, so it is spelled out rather than left to be
            discovered — there is no close button and clicking away does not
            dismiss it, because the rail lives on a card the pointer is already
            hovering. */}
        <div className={hint.hint} aria-hidden>
          <span className={hint.hintKey}>Esc</span>
          <span className={hint.hintLabel}>to exit</span>
        </div>
      </OptionList.Toolbar>
    </OptionList>
  );
}
