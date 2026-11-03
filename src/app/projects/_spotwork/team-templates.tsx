"use client";

import { useId, useState } from "react";
import type { TeamTemplate } from "./activations";
import { PRESETS } from "./copy";
import { sheetBodyStyle } from "./dashboard-sheet";
import { ActionStack, Table } from "./data-table";
import { Dropdown } from "./dropdown";
import { EmptyState } from "./form-parts";
import { PickAll, PickOne, usePickBar, usePicks } from "./picks";
import { shownText, tagsOf } from "./presets";
import { Search } from "./search";
import { resultsStyle } from "./team-pool";
import { TabGroup } from "./tabs";
import { Button, SideSheet, Tags, Tooltip, Typography } from "./ui";
import DeleteIcon from "./assets/delete.svg";
import DuplicateIcon from "./assets/duplicate.svg";

// Manage templates: a team's own templates, each to delete, and Spotwork's presets, each to duplicate into it, or those
// ticked at once; each tab's filtered by its own tags and found by title.

type Tab = "team" | "presets";

const COLUMNS = "2.75rem minmax(0, 1fr) auto auto";


/** Manage templates' header and its tabs' tables, in a small side sheet. */
export function TeamTemplates({
  subline,
  own,
  presets,
  onDelete,
  onDuplicate,
}: {
  /** Whose templates, and how many. */
  subline: string;
  own: TeamTemplate[];
  presets: TeamTemplate[];
  /** Deletes the templates at `at` in `own`. */
  onDelete: (at: number[]) => void;
  /** Duplicates the presets at `at` in `presets`. */
  onDuplicate: (at: number[]) => void;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("team");
  const [picked, setPicked] = useState<Record<Tab, string[]>>({ team: [], presets: [] });
  const [query, setQuery] = useState<Record<Tab, string>>({ team: "", presets: "" });
  const rows = tab === "team" ? own : presets;
  const tags = tagsOf(rows);
  const filter = picked[tab].filter((tag) => tags.includes(tag));
  const text = query[tab].trim().toLowerCase();
  const shown = rows.filter(
    (template) => (!filter.length || template.tags.some((tag) => filter.includes(tag))) && template.title.toLowerCase().includes(text),
  );
  const ticks = usePicks(shown);
  const at = (chosen: TeamTemplate[]) => chosen.map((template) => rows.indexOf(template));
  const { room, bar } = usePickBar(
    ticks,
    tab === "team"
      ? { label: PRESETS.delete, tone: "destructive", onAct: (chosen) => onDelete(at(chosen)) }
      : { label: "Duplicate", onAct: (chosen) => onDuplicate(at(chosen)) },
  );
  const tabs: { value: Tab; label: string }[] = [
    { value: "team", label: "Team's templates" },
    { value: "presets", label: "Template presets" },
  ];
  const show = (next: Tab) => {
    ticks.clear();
    setTab(next);
  };

  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Manage templates</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{subline}</Typography>
      </SideSheet.Header>
      <TabGroup size="small" value={tab} onChange={show}>
        {tabs.map(({ value, label }) => (
          <TabGroup.Tab key={value} value={value} id={`${id}-${value}`} aria-controls={`${id}-panel`}>
            {label}
          </TabGroup.Tab>
        ))}
      </TabGroup>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className={sheetBodyStyle} style={room}>
        {rows.length === 0 ? (
          <EmptyState>
            <Typography variant="subheading">{tab === "team" ? "Templates you add to this team will appear here" : "Spotwork's template presets will appear here"}</Typography>
            {tab === "team" && (
              <Button size="small" onClick={() => show("presets")}>
                Browse template presets
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className={resultsStyle}>
              <Dropdown size="small" multiple value={filter} onChange={(next) => setPicked((now) => ({ ...now, [tab]: next }))}>
                <Typography variant="metadata">Tags</Typography>
                {tags.map((tag) => (
                  <Dropdown.Item key={tag} value={tag}>
                    <Typography variant="metadata">{tag}</Typography>
                  </Dropdown.Item>
                ))}
              </Dropdown>
              <Typography variant="body">{shownText(shown.length)}</Typography>
            </div>
            <Table aria-label={tabs.find(({ value }) => value === tab)!.label} columns={COLUMNS} outline>
              <Table.Head>
                <Table.Row>
                  <PickAll picks={ticks} />
                  <Table.Cell search aria-label="Template title">
                    <Search
                      size="small"
                      placeholder="Find a template..."
                      value={query[tab]}
                      onChange={(event) => setQuery((now) => ({ ...now, [tab]: event.target.value }))}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Typography variant="metadata">Tags</Typography>
                  </Table.Cell>
                  <Table.Cell>
                    <Typography variant="metadata">Actions</Typography>
                  </Table.Cell>
                </Table.Row>
              </Table.Head>
              {shown.length > 0 && (
                <Table.Body>
                  {shown.map((template) => (
                    <Table.Row key={rows.indexOf(template)} data-picked={ticks.has(template) ? "" : undefined}>
                      <PickOne picks={ticks} value={template} label={template.title} />
                      <Table.Cell>
                        <Typography variant="body">{template.title}</Typography>
                      </Table.Cell>
                      <Table.Cell>
                        <Tags tags={template.tags} />
                      </Table.Cell>
                      <Table.Cell>
                        <ActionStack centered>
                          {tab === "team" ? (
                            <Button size="icon" tone="destructive" aria-label={PRESETS.delete} onClick={() => onDelete([rows.indexOf(template)])}>
                              <DeleteIcon aria-hidden />
                              <Tooltip>{PRESETS.delete}</Tooltip>
                            </Button>
                          ) : (
                            <Button size="icon" aria-label="Duplicate" onClick={() => onDuplicate([rows.indexOf(template)])}>
                              <DuplicateIcon aria-hidden />
                              <Tooltip>Duplicate</Tooltip>
                            </Button>
                          )}
                        </ActionStack>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              )}
            </Table>
          </>
        )}
      </div>
      {bar}
    </>
  );
}
