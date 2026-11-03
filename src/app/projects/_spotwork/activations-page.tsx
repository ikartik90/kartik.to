"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import {
  SIZES,
  SOURCES,
  STANDINGS,
  addNote,
  addProspect,
  addedOnText,
  companyLine,
  deactivate,
  addTeam,
  deactivateTeam,
  decide,
  deleteTeam,
  draftOf,
  emptyDraft,
  filterProspects,
  invitationLink,
  invite,
  noteCount,
  notesText,
  phoneText,
  reactivate,
  restoreTeam,
  updateTeam,
  sortProspects,
  standing,
  updateCompany,
  updateProspect,
  updateWorkspace,
  type Country,
  type Decision,
  type Prospect,
  type ProspectFilters,
  type Sort,
} from "./activations";
import { pageTopRaw } from "./sidebar";
import { CompanyForm } from "./company-form";
import { CompanySheet } from "./company-sheet";
import { StatusPill, statusLabel } from "./company-status";
import { CONFIRMATIONS, SNACKS } from "./copy";
import type { Preset } from "./presets";
import { ProspectForm } from "./prospect-form";
import { TeamForm } from "./team-form";
import { Avatar, Table } from "./data-table";
import { Search } from "./search";
import {
  Button,
  Dialog,
  Field,
  Presence,
  SegmentedControl,
  TextArea,
  Typography,
  alertIf,
  pressesRow,
  sheetRowStyle,
  titleButtonStyle,
} from "./ui";
import { Dropdown } from "./dropdown";

// The Companies page, SW Curie's Activations dashboard (25519:34937). Its table wears the Shifts table's header, the
// search in the first column's head; a row's status alone ends it, everything done to a company being its settings'.

/** Figma's frame, its padding included: the width the page needs beside the sidebar. */
export const ACTIVATIONS_WIDTH = 1440;

/** `COLUMNS` at their narrowest, with `pageStyle`'s padding. */
export const ACTIVATIONS_MIN_WIDTH = 220 + 220 + 300 + 200 + 255 + 2 * 37.5;

const DECIDED: Record<Decision, string> = {
  approved: SNACKS.approved,
  rejected: SNACKS.rejected,
  pending: SNACKS.reverted,
};

const COUNTRIES: { value: Country | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "usa", label: "USA" },
  { value: "canada", label: "Canada" },
];

const NO_FILTERS: ProspectFilters = { query: "", country: "all", sizes: [], sources: [], statuses: [] };

const pageStyle = css(pageTopRaw, {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  minWidth: 0,
  paddingBlockEnd: "var(--sw-padding-3xl)",
  paddingInline: "2.25rem",
});

const headStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" });

const toolbarStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" });

const COLUMNS = "minmax(13.75rem, 1fr) 13.75rem 18.75rem 12.5rem 16rem";

function copyInvitationLink(prospect: Prospect, onSnack: (message: string) => void) {
  navigator.clipboard?.writeText(invitationLink(prospect)).catch(() => {});
  onSnack(SNACKS.linkCopied);
}

function ProspectRow({
  prospect,
  sheet,
  onSheet,
}: {
  prospect: Prospect;
  /** Whether its company's settings are open. */
  sheet: boolean;
  /** Opens its company's settings. */
  onSheet: () => void;
}) {
  return (
    <Table.Row
      data-prospect={prospect.name}
      className={sheetRowStyle}
      data-sheet={sheet ? "" : undefined}
      onClick={(event) => pressesRow(event) && onSheet()}
    >
      <Table.Cell>
        <Avatar type="company" src={prospect.logo} />
        <Typography tag="button" variant="body" type="button" className={titleButtonStyle} onClick={onSheet}>
          {prospect.company}
        </Typography>
        <Typography variant="metadata" color="subdued">{companyLine(prospect)}</Typography>
      </Table.Cell>
      <Table.Cell>
        <Typography variant="body">{prospect.name}</Typography>
        <Typography variant="metadata" color="subdued">{prospect.designation}</Typography>
      </Table.Cell>
      <Table.Cell>
        <Typography variant="body">{phoneText(prospect)}</Typography>
        <Typography variant="metadata" color="subdued">{prospect.email}</Typography>
      </Table.Cell>
      <Table.Cell>
        <Typography variant="body">{addedOnText(prospect.added)}</Typography>
        <Typography variant="metadata" color="subdued">{prospect.source}</Typography>
      </Table.Cell>
      <Table.Cell>
        <StatusPill status={standing(prospect)} />
        <Typography variant="metadata" color="subdued">{notesText(noteCount(prospect))}</Typography>
      </Table.Cell>
    </Table.Row>
  );
}

// What's being confirmed: rejecting a company, deactivating it, or deactivating or deleting its team at `team`.
type Confirming = { id: string; kind: "reject" | "company" } | { id: string; kind: "team" | "deleteTeam"; team: number };

const CONFIRMED: Record<Confirming["kind"], string> = {
  reject: SNACKS.rejected,
  company: SNACKS.companyDeactivated,
  team: SNACKS.teamDeactivated,
  deleteTeam: SNACKS.teamDeleted,
};

/** A Confirmation Dialog whose action waits for a note saying why, if its copy asks for one. */
function Confirmation({
  copy,
  height,
  onCancel,
  onConfirm,
}: {
  copy: { title: string; body: string; note?: string; action: string };
  height: number;
  onCancel: () => void;
  onConfirm: (note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <Dialog label={copy.title} height={height} onClose={onCancel} holds>
      <Dialog.Header>
        <Typography variant="heading">{copy.title}</Typography>
      </Dialog.Header>
      <Dialog.Body>
        <Typography tag="p" variant="body">{copy.body}</Typography>
        {copy.note && (
          <Field tone={alertIf(tried, !note.trim())}>
            <Field.Label>{copy.note}</Field.Label>
            <TextArea value={note} onChange={setNote} />
          </Field>
        )}
      </Dialog.Body>
      <Dialog.ActionBar>
        <Dialog.Cancel />
        <Dialog.ForwardActions>
          <Button tone="destructive" onClick={() => (!copy.note ? onConfirm() : note.trim() ? onConfirm(note.trim()) : setTried(true))}>
            {copy.action}
          </Button>
        </Dialog.ForwardActions>
      </Dialog.ActionBar>
    </Dialog>
  );
}

export function ActivationsPage({
  prospects,
  onProspects: setProspects,
  presets,
  layer,
  height,
  onSnack,
}: {
  /** The app's, so they outlast a visit to Manage Template Presets. */
  prospects: Prospect[];
  onProspects: (update: (all: Prospect[]) => Prospect[]) => void;
  presets: Preset[];
  /** Where the prospect form hangs, so it stays in view: the app's overlay layer. */
  layer: HTMLElement | null;
  height: number;
  onSnack: (message: string) => void;
}) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState<Sort>({ by: "added", dir: "desc" });
  // The prospect being edited, or `null` for a new one.
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  // The prospect whose company's settings are open.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  // The open company's team being edited, by its place, or none for a new one.
  const [teamForm, setTeamForm] = useState<{ team?: number } | null>(null);
  // Whether the open company's own form is open.
  const [companyForm, setCompanyForm] = useState(false);

  const shown = sortProspects(filterProspects(prospects, filters), sort);
  const editing = form?.id ? prospects.find((p) => p.id === form.id) : undefined;
  const settings = prospects.find((p) => p.id === sheetId);
  const decideOn = (id: string, status: Decision) => {
    setProspects((all) => decide(all, id, status));
    onSnack(DECIDED[status]);
  };
  // Rejecting asks first, for a note saying why.
  const decideOrAsk = (id: string, status: Decision) =>
    status === "rejected" ? setConfirming({ id, kind: "reject" }) : decideOn(id, status);
  const confirm = (note?: string) => {
    if (!confirming) return;
    const { id } = confirming;
    const now = new Date();
    setProspects((all) =>
      confirming.kind === "deleteTeam"
        ? deleteTeam(all, id, confirming.team)
        : confirming.kind === "team"
        ? deactivateTeam(all, id, confirming.team, now, note)
        : confirming.kind === "company"
          ? deactivate(all, id, now, note)
          : decide(all, id, "rejected", now, note),
    );
    onSnack(CONFIRMED[confirming.kind]);
    setConfirming(null);
  };
  // A column's header sorts by it: ascending first, then turned round.
  const sortBy = (by: Sort["by"]) => ({
    sort: sort.by === by ? (sort.dir === "asc" ? "ascending" : "descending") : null,
    onSort: (next: "ascending" | "descending") => setSort({ by, dir: next === "ascending" ? "asc" : "desc" }),
  } as const);

  return (
    <div className={pageStyle} role="main">
      <div className={headStyle}>
        <Typography tag="h1" variant="title">Companies</Typography>
        <Button onClick={() => setForm({ id: null })}>Add new company...</Button>
      </div>

      <div className={toolbarStyle}>
        <SegmentedControl
          value={filters.country}
          onChange={(country) => setFilters({ ...filters, country })}
          size="small"
          aria-label="Country"
        >
          {COUNTRIES.map(({ value, label }) => (
            <SegmentedControl.Segment key={value} value={value}>
              {label}
            </SegmentedControl.Segment>
          ))}
        </SegmentedControl>
        <Dropdown size="small" multiple value={filters.sizes} onChange={(sizes) => setFilters({ ...filters, sizes })}>
          <Typography variant="metadata">Company size</Typography>
          {SIZES.map((size) => (
            <Dropdown.Item key={size} value={size}>
              <Typography variant="metadata">{size}</Typography>
            </Dropdown.Item>
          ))}
        </Dropdown>
        <Dropdown size="small" multiple value={filters.sources} onChange={(sources) => setFilters({ ...filters, sources })}>
          <Typography variant="metadata">Source</Typography>
          {SOURCES.map((source) => (
            <Dropdown.Item key={source} value={source}>
              <Typography variant="metadata">{source}</Typography>
            </Dropdown.Item>
          ))}
        </Dropdown>
        <Dropdown size="small" multiple value={filters.statuses} onChange={(statuses) => setFilters({ ...filters, statuses })}>
          <Typography variant="metadata">Status</Typography>
          {STANDINGS.map((status) => (
            <Dropdown.Item key={status} value={status}>
              <Typography variant="metadata">{statusLabel(status)}</Typography>
            </Dropdown.Item>
          ))}
        </Dropdown>
      </div>

      <Table aria-label="Companies" columns={COLUMNS} outline>
        <Table.Head>
          <Table.Row>
            <Table.Cell search aria-label="Company" {...sortBy("company")}>
              <Search
                size="small"
                placeholder="Find a company..."
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              />
            </Table.Cell>
            <Table.Cell {...sortBy("name")}>
              <Typography variant="metadata">Owner</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Contact information</Typography>
            </Table.Cell>
            <Table.Cell {...sortBy("added")}>
              <Typography variant="metadata">Added on</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Status</Typography>
            </Table.Cell>
          </Table.Row>
        </Table.Head>
        {shown.length > 0 && (
          <Table.Body>
            {shown.map((prospect) => (
              <ProspectRow
                key={prospect.id}
                prospect={prospect}
                sheet={settings?.id === prospect.id}
                onSheet={() => setSheetId((now) => (now === prospect.id ? null : prospect.id))}
              />
            ))}
          </Table.Body>
        )}
      </Table>

      {layer &&
        createPortal(
          <Presence>
            {form && (
              <ProspectForm
                key={form.id ?? "new"}
                initial={editing ? draftOf(editing) : emptyDraft()}
                editing={!!editing}
                height={height}
                onCancel={() => setForm(null)}
                onSave={(draft) => {
                  setProspects((all) =>
                    editing ? updateProspect(all, editing.id, draft) : addProspect(all, draft, new Date()),
                  );
                  onSnack(editing ? SNACKS.prospectUpdated : SNACKS.prospectAdded);
                  // A new prospect is the newest, so it shows at the top of the default order.
                  if (!editing) setSort({ by: "added", dir: "desc" });
                  setForm(null);
                }}
              />
            )}
          </Presence>,
          layer,
        )}
      {layer &&
        createPortal(
          <Presence>
            {settings && (
              <CompanySheet
                key={settings.id}
                prospect={settings}
                presets={presets}
                height={height}
                onChange={(workspace, said) => {
                  setProspects((all) => updateWorkspace(all, settings.id, () => workspace));
                  onSnack(said);
                }}
                onSendInvitation={() => {
                  setProspects((all) => invite(all, settings.id));
                  onSnack(SNACKS.invitationSent);
                }}
                onCopyLink={() => copyInvitationLink(settings, onSnack)}
                onSnack={onSnack}
                onDecide={(status) => decideOrAsk(settings.id, status)}
                onEdit={() => setForm({ id: settings.id })}
                onEditCompany={() => setCompanyForm(true)}
                onEditTeam={(team) => setTeamForm({ team })}
                onDeactivate={() => setConfirming({ id: settings.id, kind: "company" })}
                onDeactivateTeam={(team) => setConfirming({ id: settings.id, kind: "team", team })}
                onDeleteTeam={(team) => setConfirming({ id: settings.id, kind: "deleteTeam", team })}
                onRestoreTeam={(team) => {
                  setProspects((all) => restoreTeam(all, settings.id, team));
                  onSnack(SNACKS.teamRestored);
                }}
                onReactivate={() => {
                  setProspects((all) => reactivate(all, settings.id));
                  onSnack(SNACKS.companyReactivated);
                }}
                onAddNote={(text) => {
                  setProspects((all) => addNote(all, settings.id, text));
                  onSnack(SNACKS.noteAdded);
                }}
                onClose={() => setSheetId(null)}
              />
            )}
          </Presence>,
          layer,
        )}
      {layer &&
        createPortal(
          <Presence>
            {settings && companyForm && (
              <CompanyForm
                prospect={settings}
                height={height}
                onCancel={() => setCompanyForm(false)}
                onSave={(details) => {
                  setProspects((all) => updateCompany(all, settings.id, details));
                  onSnack(SNACKS.prospectUpdated);
                  setCompanyForm(false);
                }}
              />
            )}
          </Presence>,
          layer,
        )}
      {layer &&
        createPortal(
          <Presence>
            {settings && teamForm && (
              <TeamForm
                key={teamForm.team ?? "new"}
                team={teamForm.team === undefined ? undefined : settings.workspace.teams[teamForm.team]}
                inherited={settings.logo}
                height={height}
                onCancel={() => setTeamForm(null)}
                onSave={(details) => {
                  const { team } = teamForm;
                  setProspects((all) => (team === undefined ? addTeam(all, settings.id, details) : updateTeam(all, settings.id, team, details)));
                  onSnack(team === undefined ? SNACKS.teamAdded : SNACKS.teamUpdated);
                  setTeamForm(null);
                }}
              />
            )}
          </Presence>,
          layer,
        )}
      {layer &&
        createPortal(
          <Presence>
            {confirming && (
              <Confirmation
                copy={CONFIRMATIONS[confirming.kind]}
                height={height}
                onCancel={() => setConfirming(null)}
                onConfirm={confirm}
              />
            )}
          </Presence>,
          layer,
        )}
    </div>
  );
}
