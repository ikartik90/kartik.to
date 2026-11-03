"use client";

import { useState } from "react";
import { requirementsText, type Team } from "./activations";
import { ChoicesField } from "./choices-field";
import { PRESETS } from "./copy";
import { sheetBodyStyle } from "./dashboard-sheet";
import { CHOICES, keyOf } from "./presets";
import { Button, SideSheet, Typography } from "./ui";

// SW Curie's Mandatory Requirements (13359:33993) in Skills & requirements' layout, its skills left out: what every
// one of a team's templates requires, kept once it's saved.

/** Mandatory requirements' header, its choices and its action bar, in a small side sheet. */
export function TeamRequirements({ team, onSave }: { team: Team; onSave: (requirements: string[]) => void }) {
  const [picked, setPicked] = useState(team.requirements ?? []);
  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Mandatory requirements</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{`${team.name} • ${requirementsText(team)}`}</Typography>
      </SideSheet.Header>
      <div className={sheetBodyStyle}>
        <ChoicesField
          label="Mandatory requirements"
          placeholder="Find a requirement..."
          kinds={["equipment", "physical", "certificates", "conditions"]}
          value={picked}
          onChange={setPicked}
        />
      </div>
      <SideSheet.ActionBar>
        <SideSheet.Cancel />
        <SideSheet.ForwardActions>
          <Button onClick={() => onSave(CHOICES.map(keyOf).filter((key) => picked.includes(key)))}>{PRESETS.save}</Button>
        </SideSheet.ForwardActions>
      </SideSheet.ActionBar>
    </>
  );
}
