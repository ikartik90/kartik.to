"use client";

import { useState } from "react";
import { Multiselect } from "./multiselect";
import { CHOICES, keyOf, type Kind } from "./presets";
import { Field, Pill, SegmentedControl, type FieldTone } from "./ui";

// Skills & requirements' layout, which a team's Mandatory requirements share: a segmented control filtering by kind
// over a multiselect of the choices, each with its kind's pill, and its hint.

// Each kind's segment in the filter, and the pill its rows wear.
const KINDS: { kind: Kind; segment: string; pill: string }[] = [
  { kind: "skill", segment: "Skills", pill: "Skill" },
  { kind: "equipment", segment: "Equipment", pill: "Equipment" },
  { kind: "physical", segment: "Physical", pill: "Physical" },
  { kind: "certificates", segment: "Certificates", pill: "Certificate" },
  { kind: "conditions", segment: "Conditions", pill: "Working condition" },
];

export const PILL = Object.fromEntries(KINDS.map(({ kind, pill }) => [kind, pill])) as Record<Kind, string>;

/** The choices of `kinds` (every kind unless given) as values (`keyOf`), `locked` ones kept ticked. */
export function ChoicesField({
  label,
  placeholder,
  kinds = KINDS.map(({ kind }) => kind),
  value,
  onChange,
  locked = [],
  tone,
  hint,
}: {
  label: string;
  placeholder: string;
  kinds?: Kind[];
  value: string[];
  onChange: (value: string[]) => void;
  locked?: string[];
  tone?: FieldTone;
  hint?: string;
}) {
  const [kind, setKind] = useState<Kind | "all">("all");
  return (
    <>
      <SegmentedControl value={kind} onChange={setKind} size="small" layout="fill" aria-label="Type">
        <SegmentedControl.Segment value="all">All</SegmentedControl.Segment>
        {KINDS.filter((each) => kinds.includes(each.kind)).map(({ kind, segment }) => (
          <SegmentedControl.Segment key={kind} value={kind}>
            {segment}
          </SegmentedControl.Segment>
        ))}
      </SegmentedControl>
      <Field tone={tone}>
        <Multiselect aria-label={label} placeholder={placeholder} value={value} onChange={onChange}>
          {CHOICES.filter((choice) => (kind === "all" ? kinds.includes(choice.kind) : choice.kind === kind)).map((choice) => (
            <Multiselect.Option key={keyOf(choice)} value={keyOf(choice)} disabled={locked.includes(keyOf(choice))}>
              {choice.name}
              <Pill>{PILL[choice.kind]}</Pill>
            </Multiselect.Option>
          ))}
        </Multiselect>
        {hint && <Field.HintText>{hint}</Field.HintText>}
      </Field>
    </>
  );
}
