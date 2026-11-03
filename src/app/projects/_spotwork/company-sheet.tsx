"use client";

import { useRef, useState, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { hstack, stack } from "../../../../styled-system/patterns";
import {
  addedOnText,
  archivedOn,
  dayText,
  companyLine,
  flagsText,
  membersText,
  noteCount,
  notesText,
  phoneText,
  poolText,
  requirementsText,
  standing,
  teamLine,
  teamLogo,
  templatesText,
  withCopy,
  withFlag,
  withInvites,
  withRole,
  type Decision,
  type Prospect,
  type Team,
  type Workspace,
} from "./activations";
import { editButton, navigationRecord, switchRecord } from "./cards";
import { CompanyNotes } from "./company-notes";
import { StatusPill } from "./company-status";
import { ARCHIVING, FEATURE_FLAGS, SNACKS, UNDO } from "./copy";
import { sheetBodyStyle } from "./dashboard-sheet";
import { Avatar } from "./data-table";
import { FeatureFlags } from "./feature-flags";
import { EmptyState } from "./form-parts";
import { ProfileCard, ProfilePopover } from "./profile-card";
import type { Preset } from "./presets";
import { TeamMembers } from "./team-members";
import { TeamPool } from "./team-pool";
import { TeamRequirements } from "./team-requirements";
import { TeamTemplates } from "./team-templates";
import { addToPool, removeFromPool } from "./worker-pool";
import {
  Button,
  Card,
  CautionZone,
  DangerZone,
  LabelValuePair,
  Link,
  Presence,
  SideSheet,
  Switch,
  Tooltip,
  Typography,
  useEscapeLayer,
} from "./ui";
import TickIcon from "./assets/tick.svg";
import CopyIcon from "./assets/icons/medium/copy.svg";
import EditIcon from "./assets/icons/medium/edit.svg";
import AddIcon from "./assets/icons/small/add.svg";
import CrossIcon from "./assets/icons/small/cross.svg";
import SendIcon from "./assets/icons/small/send.svg";

// SW Curie's company Settings (19813:41563): a company's workspace, its teams once it's onboarded, then its activation,
// where sales decides on it, and which holds its Danger zone, or once it's approved, rejected or deactivated the
// Caution zone that undoes it. Onboarding, its teams follow its activation, to set up.

const sectionStyle = stack({ gap: "var(--sw-gap-xl)" });

const sectionHeadStyle = hstack({ justify: "space-between", gap: "var(--sw-gap-md)" });

const zoneWordsStyle = stack({ gap: "var(--sw-gap-xs)" });

const zoneWords = (title: string, description: string) => (
  <div className={zoneWordsStyle}>
    <Typography variant="body">{title}</Typography>
    <Typography tag="p" variant="metadata" color="subdued">{description}</Typography>
  </div>
);

// Its trigger's width, not its line's, in the card's stacked content.
const contactStyle = css({ alignSelf: "flex-start" });

const valueStyle = hstack({ justify: "space-between", gap: "var(--sw-gap-md)" });

/** The company's contact as a worker's card shows a worker: their phone number if they gave one, then their email. */
function ContactCard({ prospect, onSnack }: { prospect: Prospect; onSnack: (message: string) => void }) {
  const detail = (label: string, value: string, action: string, said: string) => (
    <LabelValuePair>
      <Typography variant="metadata" color="subdued">{label}</Typography>
      <div className={valueStyle}>
        <Typography variant="body">{value}</Typography>
        <Button
          size="icon"
          aria-label={action}
          onClick={() => {
            navigator.clipboard?.writeText(value).catch(() => {});
            onSnack(said);
          }}
        >
          <CopyIcon aria-hidden />
          <Tooltip>{action}</Tooltip>
        </Button>
      </div>
    </LabelValuePair>
  );
  return (
    <ProfileCard>
      <ProfileCard.Header>
        <Typography variant="heading">{prospect.name}</Typography>
        <Typography variant="metadata" color="subdued">{prospect.designation}</Typography>
      </ProfileCard.Header>
      <ProfileCard.Details>
        {prospect.phone && detail("Phone number", phoneText(prospect), "Copy phone number", SNACKS.phoneCopied)}
        {detail("Email address", prospect.email, "Copy email address", SNACKS.emailCopied)}
      </ProfileCard.Details>
    </ProfileCard>
  );
}

/** A card's Danger zone: what can't be undone, said in full over its button. */
const dangerZone = (title: string, description: string, onPress: () => void) => (
  <DangerZone title="Danger zone">
    {zoneWords(title, description)}
    <Button size="small" emphasis="secondary" tone="destructive" onClick={onPress}>
      {title}
    </Button>
  </DangerZone>
);

/** An approved, rejected or deactivated card's Caution zone, which undoes it, under `heading` unless it's the undo's. */
const cautionZone = (title: string, description: string, onUndo: () => void, heading = title) => (
  <CautionZone title="Caution zone">
    {zoneWords(heading, description)}
    <Button size="small" emphasis="secondary" tone="warning" onClick={onUndo}>
      {title}
    </Button>
  </CautionZone>
);

/** A setting's small side sheet over the company's, another setting's contents swapping in in place of its own. */
function SettingSheet({
  label,
  height,
  surface,
  onClose,
  children,
}: {
  label: string;
  height: number;
  surface?: "default";
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  useEscapeLayer(sheet, true, onClose);
  return (
    <SideSheet size="small" label={label} surface={surface} onClose={onClose} ref={sheet} style={{ height }} data-escape-layer="">
      {children}
    </SideSheet>
  );
}

/** Which setting's sheet is open: a team's, by its place, the company's feature flags, or its notes. */
type Setting =
  | { kind: "members"; team: number }
  | { kind: "templates"; team: number }
  | { kind: "pool"; team: number }
  | { kind: "requirements"; team: number }
  | { kind: "flags" }
  | { kind: "notes" };

const SETTING_LABELS: Record<Setting["kind"], string> = {
  members: "Manage team members",
  templates: "Manage templates",
  pool: "Manage worker pool",
  requirements: "Mandatory requirements",
  flags: "Manage feature flags",
  notes: "Notes & history",
};

export function CompanySheet({
  prospect,
  presets,
  height,
  onChange,
  onSendInvitation,
  onCopyLink,
  onSnack,
  onDecide,
  onEdit,
  onEditCompany,
  onEditTeam,
  onDeactivate,
  onDeactivateTeam,
  onDeleteTeam,
  onRestoreTeam,
  onReactivate,
  onAddNote,
  onClose,
}: {
  prospect: Prospect;
  /** Spotwork's template presets, which Manage templates duplicates from. */
  presets: Preset[];
  height: number;
  /** A setting changed, with the snackbar saying so. */
  onChange: (workspace: Workspace, said: string) => void;
  onSendInvitation: () => void;
  onCopyLink: () => void;
  onSnack: (message: string) => void;
  /** Approves or rejects the company, or undoes either. */
  onDecide: (status: Decision) => void;
  /** Opens the prospect's details to edit. */
  onEdit: () => void;
  /** Opens the company's logo and name to edit. */
  onEditCompany: () => void;
  /** Opens its team at `team` to edit, or a new team. */
  onEditTeam: (team?: number) => void;
  /** Asks to deactivate the company, or its team at `team`, or to delete a team set up before sign-up. */
  onDeactivate: () => void;
  onDeactivateTeam: (team: number) => void;
  onDeleteTeam: (team: number) => void;
  /** Brings back its team at `team` as it was. */
  onRestoreTeam: (team: number) => void;
  onReactivate: () => void;
  onAddNote: (text: string) => void;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  useEscapeLayer(sheet, true, onClose);
  const { status, workspace } = prospect;
  const state = standing(prospect);
  const deactivated = state === "deactivated";
  // Onboarding, its teams are being set up: their members wait for the owner, and they're deleted, not deactivated.
  const settingUp = status === "approved";
  const [setting, setSetting] = useState<Setting | null>(null);
  const setTeam = (i: number, team: Team, said: string) => onChange({ ...workspace, teams: workspace.teams.with(i, team) }, said);
  // A team's or the company's contents, keyed so another team's start afresh.
  const settingOf = (open: Setting) => {
    if (open.kind === "notes") return <CompanyNotes prospect={prospect} onAdd={onAddNote} />;
    if (open.kind === "flags") {
      return (
        <FeatureFlags
          company={prospect.company}
          flags={workspace.flags}
          onChange={(flag, on) =>
            onChange({ ...workspace, flags: withFlag(workspace.flags, flag, on) }, SNACKS.featureFlag(FEATURE_FLAGS[flag].label, on))
          }
        />
      );
    }
    if (open.kind === "requirements") {
      const team = workspace.teams[open.team];
      return (
        <TeamRequirements
          key={open.team}
          team={team}
          onSave={(requirements) => {
            setTeam(open.team, { ...team, requirements }, SNACKS.requirementsUpdated);
            setSetting(null);
          }}
        />
      );
    }
    if (open.kind === "pool") {
      const team = workspace.teams[open.team];
      return (
        <TeamPool
          key={open.team}
          team={team}
          onAdd={(workers) => setTeam(open.team, workers.reduce(addToPool, team), SNACKS.workersAdded(workers.length))}
          onRemove={(workers) => setTeam(open.team, workers.reduce(removeFromPool, team), SNACKS.workersRemoved(workers.length))}
        />
      );
    }
    if (open.kind === "members") {
      const team = workspace.teams[open.team];
      return (
        <TeamMembers
          key={open.team}
          team={team}
          onRole={(email, role) => setTeam(open.team, withRole(team, email, role), SNACKS.roleChanged(role))}
          onInvite={(invites) => setTeam(open.team, withInvites(team, invites), SNACKS.membersInvited(invites.length))}
        />
      );
    }
    const team = workspace.teams[open.team];
    const at = open.team;
    return (
      <TeamTemplates
        key={at}
        subline={`${team.name} • ${templatesText(team)}`}
        own={team.templates}
        presets={presets}
        onDelete={(ats) =>
          setTeam(at, { ...team, templates: team.templates.filter((_, i) => !ats.includes(i)) }, SNACKS.templatesDeleted(ats.length))
        }
        onDuplicate={(ats) =>
          setTeam(at, { ...team, templates: ats.reduce((all, i) => withCopy(all, presets[i]), team.templates) }, SNACKS.presetsDuplicated(ats.length))
        }
      />
    );
  };
  const edit = (
    <Button size="icon" aria-label="Edit prospect information" onClick={onEdit}>
      <EditIcon aria-hidden />
      <Tooltip>Edit prospect information</Tooltip>
    </Button>
  );

  const activation = (
    <section className={sectionStyle}>
      <div className={sectionHeadStyle}>
        <Typography tag="h2" variant="heading">Activation</Typography>
      </div>
      <Card>
        <Card.Header align="start">
          <Card.Content>
            <StatusPill status={state} />
            {state === "approved" || state === "pending" ? (
              <ProfilePopover className={contactStyle} trigger={<Link>Contact info</Link>}>
                <ContactCard prospect={prospect} onSnack={onSnack} />
              </ProfilePopover>
            ) : (
              <Typography tag="p" variant="metadata" color="subdued">
                {state === "onboarded"
                  ? prospect.activeSince && `Active since ${addedOnText(prospect.activeSince)}`
                  : state === "rejected"
                    ? prospect.rejectedAt && `Rejected on ${addedOnText(prospect.rejectedAt)}`
                    : prospect.deactivatedAt && `Deactivated since ${addedOnText(prospect.deactivatedAt)}`}
              </Typography>
            )}
          </Card.Content>
          {state === "approved" && (
            <Card.Actions>
              <Button size="small" emphasis="secondary" onClick={onSendInvitation}>
                <SendIcon aria-hidden />
                {prospect.invited ? "Resend invitation" : "Send invitation"}
              </Button>
              <Button size="icon" aria-label="Copy invitation link" onClick={onCopyLink}>
                <CopyIcon aria-hidden />
                <Tooltip>Copy invitation link</Tooltip>
              </Button>
              {edit}
            </Card.Actions>
          )}
          {state === "pending" && (
            <Card.Actions>
              <Button size="small" emphasis="secondary" onClick={() => onDecide("approved")}>
                <TickIcon aria-hidden />
                Approve
              </Button>
              <Button size="small" emphasis="secondary" tone="destructive" onClick={() => onDecide("rejected")}>
                <CrossIcon aria-hidden />
                Reject
              </Button>
              {edit}
            </Card.Actions>
          )}
        </Card.Header>
        <Card.Records>
          {navigationRecord("Notes & history", notesText(noteCount(prospect)), {
            onClick: () => setSetting({ kind: "notes" }),
            "data-sheet-trigger": "",
          })}
        </Card.Records>
        {state === "approved"
          ? cautionZone("Undo approval", UNDO.approval, () => onDecide("pending"))
          : state === "rejected"
            ? cautionZone("Undo rejection", UNDO.rejection, () => onDecide("pending"), ARCHIVING.company("rejected", dayText(archivedOn(prospect)!)))
            : deactivated
              ? cautionZone("Undo deactivation", UNDO.company, onReactivate, ARCHIVING.company("deactivated", dayText(archivedOn(prospect)!)))
              : state === "onboarded" &&
                dangerZone(
                  "Deactivate company",
                  "You can deactivate this company workspace if you no longer wish to allow posting shifts, or accessing any previously posted shifts for any team under this company.",
                  onDeactivate,
                )}
      </Card>
    </section>
  );

  const addTeam = (
    <Button size="small" onClick={() => onEditTeam()}>
      <AddIcon aria-hidden />
      Add team...
    </Button>
  );

  // Its teams; glimpsed, only its first. With none, an Empty State holds Add team in place of the heading.
  const teamSettings = (glimpse: boolean) => (
    <section className={sectionStyle}>
      <div className={sectionHeadStyle}>
        <Typography tag="h2" variant="heading">Team settings</Typography>
        {!deactivated && workspace.teams.length > 0 && addTeam}
      </div>
      {workspace.teams.length === 0 && (
        <EmptyState>
          <Typography variant="subheading">Teams you add to this company will appear here</Typography>
          {addTeam}
        </EmptyState>
      )}
      {(glimpse ? workspace.teams.slice(0, 1) : workspace.teams).map((team, i) => {
        const set = (change: Partial<Team>, said: string) => setTeam(i, { ...team, ...change }, said);
        return (
          <Card key={i} subdued={deactivated || team.deactivated}>
            <Card.Header align="start">
              <Avatar type="company" src={teamLogo(prospect, team)} />
              <Card.Content>
                <Typography tag="h3" variant="subheading">{team.name}</Typography>
                <Typography tag="p" variant="metadata" color="subdued">{teamLine(team)}</Typography>
              </Card.Content>
              {!deactivated && !team.deactivated && editButton("Edit team...", () => onEditTeam(i))}
            </Card.Header>
            {/* While the company is deactivated, only its own undo brings its teams back. */}
            {deactivated ? null : team.deactivated ? (
              cautionZone("Undo deactivation", UNDO.team, () => onRestoreTeam(i), ARCHIVING.team(dayText(archivedOn(prospect, team)!)))
            ) : (
              <>
                <Card.Records>
                  {workspace.flags.includes("checkInCodes") &&
                    switchRecord(
                      "Enable check-in codes",
                      <Switch
                        size="small"
                        checked={team.checkInCodes}
                        onChange={(checkInCodes) => set({ checkInCodes }, SNACKS.checkInCodes(checkInCodes))}
                      />,
                      "You will receive a code by email for workers to use when checking in and out.",
                    )}
                  {!settingUp &&
                    navigationRecord("Manage team members", membersText(team), {
                      onClick: () => setSetting({ kind: "members", team: i }),
                      "data-sheet-trigger": "",
                    })}
                  {navigationRecord("Manage templates", templatesText(team), {
                    onClick: () => setSetting({ kind: "templates", team: i }),
                    "data-sheet-trigger": "",
                  })}
                  {navigationRecord("Manage worker pool", poolText(team), {
                    onClick: () => setSetting({ kind: "pool", team: i }),
                    "data-sheet-trigger": "",
                  })}
                  {navigationRecord("Mandatory requirements", requirementsText(team), {
                    onClick: () => setSetting({ kind: "requirements", team: i }),
                    "data-sheet-trigger": "",
                  })}
                </Card.Records>
                {settingUp
                  ? dangerZone(
                      "Delete team",
                      "Once you delete this team, you can't restore its templates, worker pool, check-in codes or other settings.",
                      () => onDeleteTeam(i),
                    )
                  : dangerZone(
                      "Deactivate team",
                      "Once you deactivate this team, no one can post shifts under the team or open the shifts already posted.",
                      () => onDeactivateTeam(i),
                    )}
              </>
            )}
          </Card>
        );
      })}
    </section>
  );

  // Its settings; glimpsed, only those the sheet opens on, its company and its first team.
  const settings = (glimpse: boolean) => (
    <div className={sheetBodyStyle} data-centred="">
      <section className={sectionStyle}>
        <div className={sectionHeadStyle}>
          <Typography tag="h2" variant="heading">Admin settings</Typography>
        </div>
        <Card>
          <Card.Header align="start">
            <Avatar type="company" src={prospect.logo} />
            <Card.Content>
              <Typography tag="h3" variant="subheading">{prospect.company}</Typography>
              <Typography tag="p" variant="metadata" color="subdued">{companyLine(prospect)}</Typography>
            </Card.Content>
            {editButton("Edit company...", onEditCompany)}
          </Card.Header>
          {status !== "rejected" && (
            <Card.Records>
              {navigationRecord("Manage feature flags", flagsText(workspace.flags.length), {
                onClick: () => setSetting({ kind: "flags" }),
                "data-sheet-trigger": "",
              })}
            </Card.Records>
          )}
        </Card>
      </section>
      {status === "onboarded" && teamSettings(glimpse)}
      {!(glimpse && status === "onboarded") && activation}
      {settingUp && !glimpse && teamSettings(false)}
    </div>
  );

  return (
    <SideSheet size="large" label="Company settings" onClose={onClose} ref={sheet} style={{ height }} data-escape-layer="">
      <SideSheet.Header>
        <Typography variant="heading">Company settings</Typography>
        <SideSheet.Close />
      </SideSheet.Header>
      <SideSheet.Deferred fallback={settings(true)}>{settings(false)}</SideSheet.Deferred>
      <Presence>
        {setting && (
          <SettingSheet
            label={SETTING_LABELS[setting.kind]}
            surface={setting.kind === "notes" ? "default" : undefined}
            height={height}
            onClose={() => setSetting(null)}
          >
            {settingOf(setting)}
          </SettingSheet>
        )}
      </Presence>
    </SideSheet>
  );
}
