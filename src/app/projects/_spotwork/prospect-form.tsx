"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { SIZES, emailValid, formatPhone, phoneValid, ready, type Country, type Draft } from "./activations";
import { TextInput } from "./ui";
import { Button, Field, Overlay, SegmentedControl, Typography, alertIf, formOverlayRaw } from "./ui";
import FlagUsIcon from "./assets/flag-us.svg";
import FlagCaIcon from "./assets/flag-ca.svg";

// SW Curie's Add Prospect Form (25519:35017) and its Edit Prospect (25603:74168): the header and footer hold still and
// the fields scroll between them.

const bodyStyle = css({ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingInline: "var(--sw-padding-xl)" });

const sectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlock: "var(--sw-padding-xl)",
  "& + &": { boxShadow: "inset 0 1px 0 var(--sw-border-subdued)" },
});

const COUNTRIES: { country: Country; label: string; Flag: typeof FlagUsIcon }[] = [
  { country: "usa", label: "USA", Flag: FlagUsIcon },
  { country: "canada", label: "Canada", Flag: FlagCaIcon },
];

/** New company, or Edit company once it's given the prospect's details. */
export function ProspectForm({
  initial,
  editing,
  height,
  onCancel,
  onSave,
}: {
  initial: Draft;
  editing?: boolean;
  /** The app's, which the form fits in. */
  height: number;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const [tried, setTried] = useState(false);
  // A required field Alert once saving's been tried without it; an email or number Alert as soon as it's one that isn't.
  const needed = (value: string) => alertIf(tried, !value.trim());
  const checked = (value: string, valid: boolean) => alertIf(tried || value.length > 0, !valid);
  const title = editing ? "Edit company" : "New company";

  // Digits only; deleting a bracket or a dash deletes the digit before it.
  const typePhone = (text: string) => {
    const digits = text.replace(/\D/g, "");
    const erased = text.length < formatPhone(draft.phone).length && digits === draft.phone;
    set({ phone: (erased ? digits.slice(0, -1) : digits).slice(0, 10) });
  };

  return (
    <Overlay label={title} onClose={onCancel} height={height} scrim="light" holds css={formOverlayRaw}>
      <Overlay.Header>
        <Typography variant="heading">{title}</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <div className={bodyStyle}>
        <div className={sectionStyle}>
          <Field>
            <Field.Label>Company Location</Field.Label>
            <SegmentedControl value={draft.country} onChange={(country) => set({ country })} layout="fill">
              {COUNTRIES.map(({ country, label, Flag }) => (
                <SegmentedControl.Segment key={country} value={country}>
                  <Flag aria-hidden />
                  {label}
                </SegmentedControl.Segment>
              ))}
            </SegmentedControl>
          </Field>
          <Field tone={needed(draft.company)}>
            <Field.Label>Company Name</Field.Label>
            <TextInput value={draft.company} onChange={(company) => set({ company })} />
          </Field>
          <Field>
            <Field.Label>No. of Employees</Field.Label>
            <SegmentedControl value={draft.size} onChange={(size) => set({ size })} layout="fill">
              {SIZES.map((size) => (
                <SegmentedControl.Segment key={size} value={size}>
                  {size}
                </SegmentedControl.Segment>
              ))}
            </SegmentedControl>
          </Field>
        </div>

        <div className={sectionStyle}>
          <Typography tag="h3" variant="heading">Owner information</Typography>
          <Field tone={needed(draft.name)}>
            <Field.Label>Full Name</Field.Label>
            <TextInput value={draft.name} onChange={(name) => set({ name })} />
          </Field>
          <Field tone={checked(draft.phone, phoneValid(draft.phone))}>
            <Field.Label>Contact Number</Field.Label>
            <TextInput value={formatPhone(draft.phone)} onChange={typePhone}>
              <TextInput.Prefix>+1</TextInput.Prefix>
            </TextInput>
            <Field.HintText>Optional</Field.HintText>
          </Field>
          <Field tone={checked(draft.email.trim(), emailValid(draft.email))}>
            <Field.Label>Email Address</Field.Label>
            <TextInput value={draft.email} onChange={(email) => set({ email })} />
          </Field>
          <Field tone={needed(draft.designation)}>
            <Field.Label>Designation</Field.Label>
            <TextInput value={draft.designation} onChange={(designation) => set({ designation })} />
          </Field>
        </div>
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Button onClick={() => (ready(draft) ? onSave(draft) : setTried(true))}>
            {editing ? "Save changes" : "Add company"}
          </Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}
