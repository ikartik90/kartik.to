"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { hstack } from "../../../../styled-system/patterns";
import { ROLES, findMembers, membersText, type Invite, type Role, type Team } from "./activations";
import { AddMembers } from "./add-members";
import { sheetBodyStyle } from "./dashboard-sheet";
import { ActionStack, Avatar, Table, initialsOf } from "./data-table";
import { Dropdown } from "./dropdown";
import { Search } from "./search";
import { Button, Pill, Presence, SideSheet, Typography } from "./ui";
import ConfirmedIcon from "./assets/confirmed.svg";
import KebabIcon from "./assets/kebab.svg";
import AddIcon from "./assets/icons/small/add.svg";

// SW Curie's Manage Team Members (14042:41332): a team's members, each with their role, the owner's fixed, then those
// invited who haven't joined yet. Add members rises over it (25986:46899).

const COLUMNS = "minmax(0, 1fr) 9.375rem";

const filtersStyle = hstack({ justify: "space-between", gap: "var(--sw-gap-md)" });

// Figma's 200px search, a filter's width.
const searchStyle = css({ width: "var(--sw-width-dropdown)" });

/** Manage team members' header and its table, in a small side sheet. */
export function TeamMembers({
  team,
  onRole,
  onInvite,
}: {
  team: Team;
  onRole: (email: string, role: Role) => void;
  onInvite: (invites: Invite[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = findMembers(team.members, query);

  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Manage team members</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{`${team.name} • ${membersText(team)}`}</Typography>
      </SideSheet.Header>
      <div className={sheetBodyStyle}>
        <div className={filtersStyle}>
          <div className={searchStyle}>
            <Search
              size="small"
              boxed
              placeholder="Find a user..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button size="small" emphasis="secondary" onClick={() => setAdding(true)}>
            <AddIcon aria-hidden />
            Add members...
          </Button>
        </div>
        {shown.length > 0 && (
          <Table aria-label="Team members" columns={COLUMNS} outline>
            <Table.Body>
              {shown.map((member) =>
                "invited" in member ? (
                  <Table.Row key={member.email}>
                    <Table.Cell ahead>
                      <Typography variant="body" color="subdued">{member.email}</Typography>
                    </Table.Cell>
                    <Table.Cell ahead>
                      <ActionStack>
                        <ActionStack.Status>
                          <Pill disabled>
                            <ConfirmedIcon aria-hidden />
                            Invited
                          </Pill>
                          <Button size="icon" aria-label="More actions">
                            <KebabIcon aria-hidden />
                          </Button>
                        </ActionStack.Status>
                      </ActionStack>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  <Table.Row key={member.email}>
                    <Table.Cell fill>
                      <Avatar src={member.face}>{initialsOf(member.name)}</Avatar>
                      <Typography variant="body">{member.name}</Typography>
                      <Typography variant="metadata" color="subdued">{member.email}</Typography>
                    </Table.Cell>
                    <Table.Cell fill>
                      <Dropdown
                        size="small"
                        fill
                        value={member.role}
                        disabled={member.role === "Owner"}
                        onChange={(role) => onRole(member.email, role as Role)}
                      >
                        {ROLES.map((role) => (
                          <Dropdown.Item key={role} value={role}>
                            <Typography variant="metadata">{role}</Typography>
                          </Dropdown.Item>
                        ))}
                      </Dropdown>
                    </Table.Cell>
                  </Table.Row>
                ),
              )}
            </Table.Body>
          </Table>
        )}
      </div>
      <Presence>
        {adding && (
          <AddMembers
            team={team}
            onCancel={() => setAdding(false)}
            onSend={(invites) => {
              onInvite(invites);
              setAdding(false);
            }}
          />
        )}
      </Presence>
    </>
  );
}
