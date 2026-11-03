"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { ROLES, failingInvites, type Invite, type Role, type Team } from "./activations";
import { Dropdown } from "./dropdown";
import { BottomSheet, Button, Field, TextInput, Typography, alertIf } from "./ui";
import AddIcon from "./assets/icons/small/add.svg";

// SW Curie's Add Members (25986:47106): an email and its role a row, three to start, over Manage team members.

const bodyStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xl)",
  paddingBlock: "var(--sw-padding-lg)",
  paddingInline: "var(--sw-padding-xl)",
  overflowY: "auto",
});

// Figma's 130px role, on the 4px grid.
const rowStyle = css({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 8rem", gap: "var(--sw-gap-xl)", alignSelf: "stretch" });

const blank = (): Invite => ({ email: "", role: "Editor" });

/** Add members, in a bottom sheet over the team's members, sending an invite to each email typed. */
export function AddMembers({ team, onCancel, onSend }: { team: Team; onCancel: () => void; onSend: (invites: Invite[]) => void }) {
  const [rows, setRows] = useState(() => [blank(), blank(), blank()]);
  // The row whose email takes the focus as it's drawn: the first, then each one added.
  const [focus, setFocus] = useState(0);
  const [tried, setTried] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // An added row's email takes the focus without scrolling to it, so the fields scroll to their end to show it.
  useEffect(() => {
    if (focus && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [focus]);
  const set = (at: number, patch: Partial<Invite>) => setRows((current) => current.with(at, { ...current[at], ...patch }));
  const failing = failingInvites(team, rows.map((row) => row.email));
  const filled = rows.filter((row) => row.email.trim());
  // With nothing typed, the first email is what's missing.
  const missing = (i: number) => failing[i] || (!filled.length && i === 0);

  const send = () => {
    if (filled.length && !failing.includes(true)) onSend(filled.map(({ email, role }) => ({ email: email.trim(), role })));
    else setTried(true);
  };

  return (
    <BottomSheet label="Add members" onClose={onCancel} holds>
      <BottomSheet.Header>
        <Typography variant="heading">Add members</Typography>
        <BottomSheet.Close />
      </BottomSheet.Header>
      <div ref={body} className={bodyStyle}>
        {rows.map((row, i) => (
          <div key={i} className={rowStyle}>
            <Field tone={alertIf(tried, missing(i))}>
              <Field.Label>Email Address</Field.Label>
              <TextInput value={row.email} inputMode="email" autoFocus={i === focus} onChange={(email) => set(i, { email })} />
            </Field>
            <Field>
              <Field.Label>Role</Field.Label>
              <Dropdown value={row.role} onChange={(role) => set(i, { role: role as Role })}>
                {ROLES.map((role) => (
                  <Dropdown.Item key={role} value={role}>
                    <Typography variant="bodyLarge">{role}</Typography>
                  </Dropdown.Item>
                ))}
              </Dropdown>
            </Field>
          </div>
        ))}
        <Button
          size="small"
          emphasis="tertiary"
          onClick={() => {
            setFocus(rows.length);
            setRows([...rows, blank()]);
          }}
        >
          <AddIcon aria-hidden />
          Add another member
        </Button>
      </div>
      <BottomSheet.ActionBar>
        <BottomSheet.Cancel />
        <BottomSheet.ForwardActions>
          <Button onClick={send}>Send invite</Button>
        </BottomSheet.ForwardActions>
      </BottomSheet.ActionBar>
    </BottomSheet>
  );
}
