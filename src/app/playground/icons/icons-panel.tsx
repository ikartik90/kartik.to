"use client";

import { useId } from "react";
import { css } from "../../../../styled-system/css";
import DownloadIcon from "@/assets/icons/download.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import AddIcon from "@/assets/icons/add.svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { IconLabelsGroup } from "./icon-labels-group";
import { Tooltip } from "@/components/ui/tooltip";
import {
  type IconAsset,
  ICON_SIZES,
  ICON_STROKES,
  ICON_ZOOMS,
  type IconViewSettings,
} from "@/domain/icon";

// ---------------------------------------------------------------------------
// The icon set's properties, in the docked inspector — the same sidebar the
// shader playground and the holo card are tuned from, composed out of the same
// parts.
//
// Three groups, and the split is what each one acts on.
//
//   Actions   the things you do TO the set. First, because they are what the
//             page is FOR: the sliders are how you decide, and this is where
//             the deciding is spent. Adding sits against the heading, since
//             it acts on the set whatever is selected; everything else acts
//             on the SELECTION and so stands beside the line that names it.
//
//   Icon      the drawing: the box it is in and the weight of its line. Both
//             leave the set changed on screen and in a download, because what
//             a download contains is what the grid is showing.
//
//   Preview   how far in you are LOOKING. The zoom stood among the two above
//             it while all three were sliders, which made a magnifying glass
//             look like a property of the icons; it multiplies what is drawn
//             and changes nothing about the files.
//
// NO CHIP IS EVER SHOWN INERT. Download stands against the count of what is
// on screen; Delete appears when something is taken; Publish appears only
// when what is taken includes something held back, since that is the only
// case where pressing it would move anything. A row of greyed buttons is a
// row of questions the panel already knows the answer to.
//
// Adding, publishing and deleting are the author's and are not rendered at
// all for a visitor. Nothing here is what enforces that: every one of those
// actions asks the server again.
//
// All three sliders step evenly — 4px, 0.25px and half a multiple — which is
// what lets them be sliders rather than segmented controls dressed as scales.
// Every control commits on change.
// ---------------------------------------------------------------------------

// The set's own line: what you are looking at, and what can be done to it.
//
// A row of its own rather than a labelled control, because the label column
// is 80px and "3 icons selected" is not an 80px word — and because the chips
// are a group rather than the one action a row's third track reserves room
// for. It ends where the heading strip's chips end (both insets are `lg`),
// so the two sit in one column down the panel's right edge.
//
// The height is held at a chip's, so the line does not jump as chips come and
// go with the selection.
const selectionRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "sm",
  minHeight: "token(sizes.toolbarButton)",
});

/** The chips at the row's end, spaced as the heading strip spaces its own. */
const rowActionsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
  flexShrink: 0,
});

export interface IconsPanelProps {
  settings: IconViewSettings;
  onChange: (settings: IconViewSettings) => void;
  /** How many icons the set holds, and how many the search leaves on screen. */
  total: number;
  shown: number;
  /** How many of them nobody but the author sees. */
  held: number;
  /** The current selection: what download, publish and delete all act on. */
  selected: number;
  /** How many of the selected are held — what Publish would actually do. */
  selectedHeld: number;
  onDownload: () => void;
  isAdmin: boolean;
  busy: boolean;
  problem: string | null;
  onUpload: (files: File[]) => void;
  onPublish: () => void;
  onDelete: () => void;
  /**
   * The one icon being named, where there is exactly one — the page decides,
   * because "exactly one, and I am the author" is a fact about the selection
   * rather than about this panel. Null the rest of the time, and the section
   * is then not rendered at all.
   */
  named: IconAsset | null;
  onRename: (key: string, title: string, aliases: string[]) => void;
  onDismiss: () => void;
}

export function IconsPanel({
  settings,
  onChange,
  total,
  shown,
  held,
  selected,
  selectedHeld,
  onDownload,
  isAdmin,
  busy,
  problem,
  onUpload,
  onPublish,
  onDelete,
  named,
  onRename,
  onDismiss,
}: IconsPanelProps) {
  // A `useId` rather than a ref, because anything taken off a hook's result
  // and handed to a `ref` attribute makes the React Compiler read the whole
  // object as a ref — see the note in `.cursor/rules`. The handler finds the
  // input by id.
  const fileInputId = useId();

  const openFilePicker = () => {
    const input = document.getElementById(fileInputId);
    if (input instanceof HTMLInputElement) input.click();
  };

  // What each chip would do, in its own name — the whole of the selection
  // model, said by the label rather than by a second button that would be
  // inert whenever the first was not. "All" only when it really is all: with
  // a search narrowing the grid, Download takes what is on screen and says
  // how many that is rather than claiming the set.
  const downloadName =
    selected > 0
      ? `Download ${selected}`
      : shown < total
        ? `Download ${shown}`
        : "Download all";
  const publishName = `Publish ${selectedHeld}`;
  const deleteName = `Delete ${selected}`;

  // The line the chips stand against. It names what they would act on, which
  // is the selection the moment there is one and the set until then.
  const summary =
    selected > 0
      ? `${selected} ${selected === 1 ? "icon" : "icons"} selected`
      : [
          shown < total
            ? `${shown} of ${total}`
            : `${total} ${total === 1 ? "icon" : "icons"}`,
          held > 0 ? `${held} held` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <PropertiesPanel
      ariaLabel="Icon properties"
      // The panel IS the page's settings — it stands beside the grid it
      // configures, and every press on an icon would otherwise send it away.
      // Escape and its own button still do.
      dismissOnOutsidePointer={false}
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Icon Properties</PropertiesPanel.Header>

      <PropertiesPanel.Group
        title="Actions"
        // Adding is the one action that does not read the selection, so it is
        // the one that belongs on the strip: it acts on the set itself.
        actions={
          isAdmin ? (
            <Button
              variant="icon"
              aria-label="Add icons"
              disabled={busy}
              onClick={openFilePicker}
            >
              <AddIcon />
              <Button.Tooltip>
                <Tooltip.Text>Add icons</Tooltip.Text>
              </Button.Tooltip>
            </Button>
          ) : undefined
        }
      >
        <div className={selectionRowStyle}>
          {/* A `Field` holding nothing but a hint: the panel's own note
              style, rather than a second way to set small muted text. */}
          <Field>
            <Field.Hint>{summary}</Field.Hint>
          </Field>

          <div className={rowActionsStyle}>
            {(shown > 0 || selected > 0) && (
              <Button
                variant="icon"
                aria-label={downloadName}
                onClick={onDownload}
              >
                <DownloadIcon />
                <Button.Tooltip>
                  <Tooltip.Text>{downloadName}</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}

            {/* Only when it would move something. Publishing acts on the held
                icons INSIDE the selection, so a selection of six with one
                held publishes one — and a selection with none held has
                nothing for this press to mean. */}
            {isAdmin && selectedHeld > 0 && (
              <Button
                variant="icon"
                aria-label={publishName}
                disabled={busy}
                onClick={onPublish}
              >
                <PublishIcon />
                <Button.Tooltip>
                  <Tooltip.Text>{publishName}</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}

            {isAdmin && selected > 0 && (
              <Button
                variant="icon"
                aria-label={deleteName}
                disabled={busy}
                onClick={onDelete}
              >
                <TrashIcon />
                <Button.Tooltip>
                  <Tooltip.Text>{deleteName}</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}
          </div>
        </div>

        {problem && (
          <Field data-property-block>
            <Field.Hint>{problem}</Field.Hint>
          </Field>
        )}

        <input
          id={fileInputId}
          type="file"
          accept="image/svg+xml,.svg"
          multiple
          hidden
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Cleared so that choosing the SAME file twice in a row still
            // fires a change — the second pick is a re-upload, not a no-op.
            event.target.value = "";
            onUpload(files);
          }}
        />
      </PropertiesPanel.Group>

      {/* Keyed by the icon, so choosing another one REMOUNTS the fields with
          that icon's own name in them. A draft belongs to the icon it was
          typed about. */}
      {named && (
        <IconLabelsGroup key={named.key} icon={named} onSave={onRename} />
      )}

      <PropertiesPanel.Group title="Icon">
        <PropertiesPanel.Control label="Size">
          <Slider
            min={ICON_SIZES[0]}
            max={ICON_SIZES[ICON_SIZES.length - 1]}
            step={ICON_SIZES[1] - ICON_SIZES[0]}
            value={settings.size}
            onValueChange={(size) => onChange({ ...settings, size })}
          />
        </PropertiesPanel.Control>

        <PropertiesPanel.Control label="Stroke">
          <Slider
            min={ICON_STROKES[0]}
            max={ICON_STROKES[ICON_STROKES.length - 1]}
            step={ICON_STROKES[1] - ICON_STROKES[0]}
            value={settings.stroke}
            onValueChange={(stroke) => onChange({ ...settings, stroke })}
          />
        </PropertiesPanel.Control>
      </PropertiesPanel.Group>

      <PropertiesPanel.Group title="Preview">
        <PropertiesPanel.Control label="Zoom">
          {/* Spelled out only to reach the readout: a bare number beside a
              size and a stroke reads as a third measurement rather than as
              a multiplier, so the box says `1.5x`. */}
          <Slider
            min={ICON_ZOOMS[0]}
            max={ICON_ZOOMS[ICON_ZOOMS.length - 1]}
            step={ICON_ZOOMS[1] - ICON_ZOOMS[0]}
            value={settings.zoom}
            onValueChange={(zoom) => onChange({ ...settings, zoom })}
          >
            <Slider.Track />
            <Slider.Separator />
            <Slider.Output format={(zoom) => `${zoom}x`} />
          </Slider>
        </PropertiesPanel.Control>
      </PropertiesPanel.Group>

    </PropertiesPanel>
  );
}
