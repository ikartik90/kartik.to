"use client";

import { useState } from "react";
import type { CompanyDetails, Prospect } from "./activations";
import { LogoPicker, logoFormBodyStyle } from "./team-form";
import { Button, Field, Overlay, TextInput, Typography, alertIf } from "./ui";

// SW Curie's Edit Company Workspace (13752:2418), built as Edit team: the company's logo over its name.

const TITLE = "Edit company workspace";

/** Edit company workspace, given the company's prospect. */
export function CompanyForm({
  prospect,
  height,
  onCancel,
  onSave,
}: {
  prospect: Prospect;
  /** The app's, which the form fits in. */
  height: number;
  onCancel: () => void;
  onSave: (details: CompanyDetails) => void;
}) {
  const [draft, setDraft] = useState<CompanyDetails>({ company: prospect.company, logo: prospect.logo });
  const set = (patch: Partial<CompanyDetails>) => setDraft((current) => ({ ...current, ...patch }));
  const [tried, setTried] = useState(false);

  const save = () => {
    const company = draft.company.trim();
    if (company) onSave({ ...draft, company });
    else setTried(true);
  };

  return (
    <Overlay label={TITLE} onClose={onCancel} height={height} scrim="light" holds>
      <Overlay.Header>
        <Typography variant="heading">{TITLE}</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <div className={logoFormBodyStyle}>
        <LogoPicker
          logo={draft.logo}
          label="Update company logo"
          title="Company logo"
          upload={prospect.upload}
          onChange={(logo) => set({ logo })}
        />
        <Field tone={alertIf(tried, !draft.company.trim())}>
          <Field.Label>Company Name</Field.Label>
          <TextInput value={draft.company} onChange={(company) => set({ company })} />
        </Field>
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Button onClick={save}>Save changes</Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}
