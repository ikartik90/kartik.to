"use client";

import type { Ref } from "react";
import { css } from "../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Typography } from "@/components/ui/typography";

// ---------------------------------------------------------------------------
// CardPropertiesPanel — everything about one card of the homepage grid that
// its toolbar cannot say in icons, in the docked inspector the collection
// editor already uses for a picture (Figma 845:7223).
//
// The same panel for every card, and deliberately so: a post, a project and a
// published demo are all cards, and giving each its own inspector would be
// three surfaces to open from one button. What differs is WHICH sections are
// on it, which is decided by what the card can actually carry — the log
// control is here only for a card that has log output to show.
//
// A live editor, not a form. Every control commits on change and the parent
// owns the value, exactly as `MediaPropertiesPanel` does, so the card behind
// the panel is always showing what the panel says. Nothing is written to the
// database on the way through: the grid is edited as a draft and the palette's
// two exits either commit it or throw it away.
//
// Most cards will grow properties of their own here. Until they do, a card
// whose sections are all absent gets a note saying so rather than a blank
// panel, which reads as one that failed to load.
// ---------------------------------------------------------------------------

/** The two states, in the drawn order — the affirmative first, as `FITS` is. */
const LOG_VISIBILITY = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
];

/** What a card's log output can be told to do, when it has any. */
export interface CardLoggerProperty {
  /** Whether the card is currently drawn with its log panel. */
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}

export interface CardPropertiesPanelProps {
  /**
   * The card's log output — absent when it has none.
   *
   * One optional object rather than a `supportsLogger` boolean beside a value
   * and a handler: the three are meaningless apart, and this way a card that
   * cannot log has no state to be half-specified with.
   */
  logger?: CardLoggerProperty;
  /** Fired once the panel has finished sliding out — see PropertiesPanel. */
  onDismiss: () => void;
  /** Handle for closing the panel from the control that opened it. */
  ref?: Ref<PropertiesPanelHandle>;
}

// Padded to the control panel's own inset, so the note sits where a first row
// of controls would — it is standing in for them.
const emptyNoteStyle = css({
  padding: "lg",
  color: "text.body",
});

export function CardPropertiesPanel({
  logger,
  onDismiss,
  ref,
}: CardPropertiesPanelProps) {
  return (
    <PropertiesPanel ref={ref} ariaLabel="Card properties" onDismiss={onDismiss}>
      <PropertiesPanel.Header>Card Properties</PropertiesPanel.Header>

      {/* Always on, and headerless with it: a demo that logs HAS log output
          whether or not it is on show, so there is nothing here for a section
          header's add/remove pair to mean — `enabled` is held true and the
          header left off, the way the media panel's layout section is (Figma
          885:1963). Showing and hiding it is a VALUE, and a value belongs in a
          labelled row rather than in a section that appears and disappears. */}
      {logger && (
        <PropertiesPanel.Section enabled>
          <PropertiesPanel.ControlPanel ariaLabel="Log output">
            <PropertiesPanel.Control label="Log Output">
              <SegmentedControl
                options={LOG_VISIBILITY}
                value={logger.shown ? "show" : "hide"}
                onValueChange={(value) =>
                  logger.onShownChange(value === "show")
                }
              />
            </PropertiesPanel.Control>
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      )}

      {!logger && (
        <Typography tag="p" type="bodySmall" className={emptyNoteStyle}>
          No properties for this card yet.
        </Typography>
      )}
    </PropertiesPanel>
  );
}
