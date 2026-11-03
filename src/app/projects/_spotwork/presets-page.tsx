"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { pageTopRaw } from "./sidebar";
import { COMPANY_TEMPLATES, PRESETS, SNACKS } from "./copy";
import { PRESET_WORDS, PresetSheet, type SheetWords } from "./preset-sheet";
import {
  addPreset,
  draftOfPreset,
  duplicateOf,
  emptyPresetDraft,
  listPresets,
  removePreset,
  tagsOf,
  updatePreset,
  type Preset,
  type PresetDraft,
  type PresetFilter,
} from "./presets";
import { Search } from "./search";
import { TeamData } from "./team-loading";
import { newTemplateDraft } from "./templates";
import {
  Button,
  Card,
  Pill,
  Presence,
  SegmentedControl,
  Tags,
  Tooltip,
  Typography,
} from "./ui";
import IncompleteIcon from "./assets/incomplete.svg";
import EditIcon from "./assets/edit.svg";
import DuplicateIcon from "./assets/duplicate.svg";
import DeleteIcon from "./assets/delete.svg";
import AddIcon from "./assets/icons/small/add.svg";

// SW Curie's Manage Template Presets (25595:60582), and a company's Manage Templates (25637:25933) in its form: Template
// Card v2s (24296:10077) in a grid, a company's with their active shifts and Post New Shift.

/** Figma's frame, its padding included: the width the page needs beside the sidebar. */
export const PRESETS_WIDTH = 1440;

/** Two cards abreast at their narrowest, with `pageStyle`'s padding; the title row fits too. */
export const PRESETS_MIN_WIDTH = 2 * 380 + 15 + 2 * 37.5;

const STATUSES: { value: PresetFilter["status"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
];

export const pageStyle = css(pageTopRaw, {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  minWidth: 0,
  paddingBlockEnd: "var(--sw-padding-3xl)",
  paddingInline: "2.25rem",
});

const headStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" });

const toolbarStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" });

// Manage Templates' row of cards: three across Figma's 1365px.
const gridStyle = css({ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(23.75rem, 1fr))", gap: "var(--sw-gap-xl)" });

// The name over its first two tags where the address goes; Post New Shift and the actions share the foot.
// A 76px frame, so a card of one line ends where one of two does.
const cardHeadStyle = css({ height: "4.75rem" });

interface Words {
  title: string;
  add: string;
  find: string;
  list: string;
  sheet: SheetWords;
  snacks: typeof SNACKS.template;
}

const PRESETS_PAGE: Words = {
  title: "Manage Template Presets",
  add: "New template preset...",
  find: "Find a preset...",
  list: "Template Presets",
  sheet: PRESET_WORDS,
  snacks: SNACKS.preset,
};

const TEMPLATES_PAGE: Words = {
  title: "Manage Templates",
  add: "New template...",
  find: "Find a template...",
  list: "Templates",
  sheet: COMPANY_TEMPLATES,
  snacks: SNACKS.template,
};

type Sheet = { kind: "new" } | { kind: "edit" | "duplicate"; preset: Preset };

export function PresetCard({
  preset,
  shifts,
  onPostShift,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  preset: Preset;
  /** A company's: how many shifts it has running, and Post New Shift. */
  shifts?: number;
  onPostShift?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const active = preset.status === "active";
  return (
    <Card role="listitem">
      <Card.Content className={cardHeadStyle}>
        <Card.Header>
          <Typography tag="h2" variant="subheading">{preset.title}</Typography>
          {!active ? (
            <Pill state="warning">
              <IncompleteIcon aria-hidden />
              Draft
            </Pill>
          ) : (
            shifts !== undefined && (
              <Pill state={shifts ? "affirmative" : "warning"}>{COMPANY_TEMPLATES.activeShifts(shifts)}</Pill>
            )
          )}
        </Card.Header>
        <Tags tags={preset.tags} />
      </Card.Content>
      <Card.Footer>
        {active && shifts !== undefined && (
          <Button size="small" emphasis="secondary" onClick={onPostShift}>
            <AddIcon aria-hidden />
            Post new shift...
          </Button>
        )}
        <Card.Actions gap="xs">
          <Button size="icon" aria-label="Edit" onClick={onEdit}>
            <EditIcon aria-hidden />
            <Tooltip start>Edit</Tooltip>
          </Button>
          {active && (
            <Button size="icon" aria-label="Duplicate" onClick={onDuplicate}>
              <DuplicateIcon aria-hidden />
              <Tooltip start>Duplicate</Tooltip>
            </Button>
          )}
          <Button size="icon" tone="destructive" aria-label={PRESETS.delete} onClick={onDelete}>
            <DeleteIcon aria-hidden />
            <Tooltip start>{PRESETS.delete}</Tooltip>
          </Button>
        </Card.Actions>
      </Card.Footer>
    </Card>
  );
}

// The code view shows the composition.
PresetCard.unwrap = PresetCard;

function ManagePage({
  words,
  presets,
  onPresets,
  blank = emptyPresetDraft,
  addressed,
  locked,
  shifts,
  onPostShift,
  onSnack,
  layer,
  height,
}: {
  words: Words;
  presets: Preset[];
  onPresets: (update: (all: Preset[]) => Preset[]) => void;
  /** A new one's draft. */
  blank?: () => PresetDraft;
  /** A company's templates, at its address; presets are generic. */
  addressed?: boolean;
  /** Its team's mandatory requirements, kept in every one's form. */
  locked?: string[];
  shifts?: (id: string) => number;
  onPostShift?: (id: string) => void;
  onSnack?: (message: string) => void;
  layer: HTMLElement | null;
  height: number;
}) {
  const [filter, setFilter] = useState<PresetFilter>({ query: "", status: "all" });
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const shown = listPresets(presets, filter);

  const initial = !sheet || sheet.kind === "new"
    ? blank()
    : sheet.kind === "edit"
      ? draftOfPreset(sheet.preset)
      : duplicateOf(sheet.preset);

  // A company's templates are its team's, loading afresh with it.
  const list = (
    <div role="list" aria-label={words.list} className={gridStyle}>
      {shown.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          shifts={shifts?.(preset.id)}
          onPostShift={onPostShift && (() => onPostShift(preset.id))}
          onDuplicate={() => setSheet({ kind: "duplicate", preset })}
          onEdit={() => setSheet({ kind: "edit", preset })}
          onDelete={() => {
            onPresets((all) => removePreset(all, preset.id));
            onSnack?.(words.snacks.deleted);
          }}
        />
      ))}
    </div>
  );

  return (
    <div className={pageStyle} role="main">
      <div className={headStyle}>
        <Typography tag="h1" variant="title">{words.title}</Typography>
        <Button onClick={() => setSheet({ kind: "new" })}>{words.add}</Button>
      </div>

      <div className={toolbarStyle}>
        <Search
          size="small"
          placeholder={words.find}
          boxed
          value={filter.query}
          onChange={(event) => setFilter({ ...filter, query: event.target.value })}
        />
        <SegmentedControl
          value={filter.status}
          onChange={(status) => setFilter({ ...filter, status })}
          size="small"
          aria-label="Status"
        >
          {STATUSES.map(({ value, label }) => (
            <SegmentedControl.Segment key={value} value={value}>
              {label}
            </SegmentedControl.Segment>
          ))}
        </SegmentedControl>
      </div>

      {addressed ? <TeamData>{list}</TeamData> : list}

      {layer &&
        createPortal(
          <Presence>
            {sheet && (
              <PresetSheet
                key={sheet.kind === "new" ? "new" : `${sheet.kind}-${sheet.preset.id}`}
                words={words.sheet}
                addressed={addressed}
                initial={initial}
                tags={tagsOf(presets)}
                editing={sheet.kind === "edit"}
                locked={locked}
                height={height}
                onCancel={() => setSheet(null)}
                onSave={(draft, status) => {
                  onPresets((all) =>
                    sheet.kind === "edit"
                      ? updatePreset(all, sheet.preset.id, draft, status)
                      : addPreset(all, draft, status, new Date()),
                  );
                  const said = status === "draft" ? "drafted" : sheet.kind === "new" ? "created" : sheet.kind === "edit" ? "updated" : "duplicated";
                  onSnack?.(words.snacks[said]);
                  setSheet(null);
                }}
              />
            )}
          </Presence>,
          layer,
        )}
    </div>
  );
}

export function PresetsPage({
  presets,
  onPresets,
  onSnack,
  layer,
  height,
}: {
  /** The app's, which New company copies from. */
  presets: Preset[];
  onPresets: (update: (all: Preset[]) => Preset[]) => void;
  onSnack?: (message: string) => void;
  /** Where the sheet hangs: the app's overlay layer. */
  layer: HTMLElement | null;
  height: number;
}) {
  return (
    <ManagePage words={PRESETS_PAGE} presets={presets} onPresets={onPresets} onSnack={onSnack} layer={layer} height={height} />
  );
}

export function TemplatesPage({
  templates,
  onTemplates,
  locked,
  shifts,
  onPostShift,
  onSnack,
  layer,
  height,
}: {
  /** The app's, which New Shift and the Shifts page take the active ones of. */
  templates: Preset[];
  onTemplates: (update: (all: Preset[]) => Preset[]) => void;
  /** Its team's mandatory requirements, as Spotwork sets them. */
  locked: string[];
  /** How many shifts a template has running. */
  shifts: (id: string) => number;
  onPostShift: (id: string) => void;
  onSnack?: (message: string) => void;
  /** Where the sheet hangs: the app's overlay layer. */
  layer: HTMLElement | null;
  height: number;
}) {
  return (
    <ManagePage
      words={TEMPLATES_PAGE}
      presets={templates}
      onPresets={onTemplates}
      blank={newTemplateDraft}
      addressed
      locked={locked}
      shifts={shifts}
      onPostShift={onPostShift}
      onSnack={onSnack}
      layer={layer}
      height={height}
    />
  );
}
