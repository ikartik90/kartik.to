"use client";

import { useId } from "react";
import { css } from "../../../../styled-system/css";
import DownloadIcon from "@/assets/icons/download.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import AddIcon from "@/assets/icons/add.svg";
import LinkIcon from "@/assets/icons/link.svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { IconLabelsGroup, type IconLabelEdit } from "./icon-labels-group";
import { Tooltip } from "@/components/ui/tooltip";
import {
  type IconAsset,
  ICON_SIZES,
  ICON_STROKES,
  ICON_ZOOMS,
  iconSettingsLockedTo,
  type IconViewSettings,
} from "@/domain/icon";

const selectionRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "sm",
  minHeight: "token(sizes.toolbarButton)",
});

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
  selected: number;
  selectedHeld: number;
  onDownload: () => void;
  isAdmin: boolean;
  busy: boolean;
  problem: string | null;
  onUpload: (files: File[]) => void;
  /** Size and stroke move together. Owned by the page: the panel unmounts on dismiss. */
  locked: boolean;
  onLockedChange: (locked: boolean) => void;
  onPublish: () => void;
  onDelete: () => void;
  /** The icons being named; empty hides the section. */
  named: IconAsset[];
  onRename: (edits: IconLabelEdit[]) => void;
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
  locked,
  onLockedChange,
  onPublish,
  onDelete,
  named,
  onRename,
  onDismiss,
}: IconsPanelProps) {
  // An id, not a ref: the React Compiler reads a hook result reaching `ref` as a ref.
  const fileInputId = useId();

  const tied = (next: IconViewSettings, lead: "size" | "stroke") =>
    locked ? iconSettingsLockedTo(next, lead) : next;

  const openFilePicker = () => {
    const input = document.getElementById(fileInputId);
    if (input instanceof HTMLInputElement) input.click();
  };

  const downloadName =
    selected > 0
      ? `Download ${selected}`
      : shown < total
        ? `Download ${shown}`
        : "Download all";
  const publishName = `Publish ${selectedHeld}`;
  const deleteName = `Delete ${selected}`;

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
      dismissOnOutsidePointer={false}
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Icon Properties</PropertiesPanel.Header>

      <PropertiesPanel.Group
        title="Actions"
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
            // Cleared so picking the same file again still fires a change.
            event.target.value = "";
            onUpload(files);
          }}
        />
      </PropertiesPanel.Group>

      {/* Keyed by the selection, so the draft remounts with it. */}
      {named.length > 0 && (
        <IconLabelsGroup
          key={named.map((icon) => icon.key).join("\u0000")}
          icons={named}
          onSave={onRename}
        />
      )}

      <PropertiesPanel.Group title="Icon">
        <PropertiesPanel.Tie
          action={
            <Button
              variant="icon"
              aria-pressed={locked}
              aria-label={
                locked ? "Unlink size and stroke" : "Link size and stroke"
              }
              onClick={() => onLockedChange(!locked)}
            >
              <LinkIcon />
              <Button.Tooltip>
                <Tooltip.Text>
                  {locked ? "Unlink size and stroke" : "Link size and stroke"}
                </Tooltip.Text>
              </Button.Tooltip>
            </Button>
          }
        >
          <PropertiesPanel.Control label="Size">
            <Slider
              min={ICON_SIZES[0]}
              max={ICON_SIZES[ICON_SIZES.length - 1]}
              step={ICON_SIZES[1] - ICON_SIZES[0]}
              value={settings.size}
              onValueChange={(size) =>
                onChange(tied({ ...settings, size }, "size"))
              }
            />
          </PropertiesPanel.Control>

          <PropertiesPanel.Control label="Stroke">
            <Slider
              min={ICON_STROKES[0]}
              max={ICON_STROKES[ICON_STROKES.length - 1]}
              step={ICON_STROKES[1] - ICON_STROKES[0]}
              value={settings.stroke}
              onValueChange={(stroke) =>
                onChange(tied({ ...settings, stroke }, "stroke"))
              }
            />
          </PropertiesPanel.Control>
        </PropertiesPanel.Tie>
      </PropertiesPanel.Group>

      <PropertiesPanel.Group title="Preview">
        <PropertiesPanel.Control label="Zoom">
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
