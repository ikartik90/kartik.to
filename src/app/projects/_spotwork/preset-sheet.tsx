"use client";

import { memo, use, useEffect, useLayoutEffect, useCallback, useRef, useState, type ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
import { GEOFENCE_HINT, PRESETS } from "./copy";
import { GeoContext, entranceAt, narrowed, suggestionOf, type Suggestion } from "./geo";
import type { Place } from "./geofence";
import { GeofenceMap } from "./geofence-map";
import { AddressLocation, FormNav, stepBarStyle, stepPanelStyle, stepsBodyStyle } from "./new-shift";
import { ChoicesField } from "./choices-field";
import { TypeAhead } from "./search";
import { TagsField } from "./tags-field";
import { TextInput } from "./ui";
import {
  DESCRIPTION_LIMIT,
  charactersLeft,
  listed,
  openingStep,
  pickedKeys,
  picksFrom,
  stepsReady,
  type PresetDraft,
  type PresetStatus,
  type Requirement,
} from "./presets";
import { useTypedNote } from "./typed-note";
import {
  Button,
  Field,
  LabelValuePair,
  Link,
  PLACEHOLDER,
  Pill,
  Switch,
  Tags,
  TextArea,
  Tooltip,
  Typography,
  SideSheet,
  alertIf,
  summarySectionStyle,
  useEscapeLayer,
} from "./ui";
import EditIcon from "./assets/edit.svg";
import AiIcon from "./assets/ai.svg";

// SW Curie's Create a Template Preset (25600:66992, 67005, 67022, 67034), a side sheet down the app's end, with Create a
// Template's Address & Wage (25637:26383) its second step. Figma's "Spotter" is "worker" here, and its "Position" a
// template.

const STEPS = ["Basic information", "Address & wage", "Skills & requirements", "Template details", "Review template summary"];
const ADDRESS_STEP = STEPS[1];

/** The sheet's title as it creates or edits, and its last step's button. */
export interface SheetWords {
  create: string;
  edit: string;
  submit: string;
}

export const PRESET_WORDS: SheetWords = {
  create: "Create a template preset",
  edit: PRESETS.editTitle,
  submit: "Create template preset",
};

const REQUIREMENTS: { key: Requirement; review: string }[] = [
  { key: "equipment", review: "Equipment Requirements" },
  { key: "physical", review: "Physical Requirements" },
  { key: "certificates", review: "Certificates" },
  { key: "conditions", review: "Working Conditions" },
];

// Skills & requirements' step runs down to the action bar, so its table scrolls in place.
const fitStyle = css({ height: "100%" });

// A 584px form column, centred under the steps.
const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  width: "36.5rem",
  marginInline: "auto",
  "&[data-review]": { gap: "var(--sw-gap-none)" },
  "&[data-fit]": { minHeight: 0 },
});

const titleRowStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" });

const chipsStyle = css({ display: "flex", flexWrap: "wrap", gap: "var(--sw-gap-xs) var(--sw-gap-md)", paddingBlock: "var(--sw-padding-xxs)" });

const clampStyle = css({ lineClamp: 4, whiteSpace: "pre-line", "&[data-open]": { lineClamp: "none" } });

type Set = (patch: Partial<PresetDraft>) => void;

function BasicStep({ draft, set, tags, tried }: { draft: PresetDraft; set: Set; tags: string[]; tried: boolean }) {
  return (
    <>
      <Typography tag="h3" variant="heading">Basic information</Typography>
      <Field tone={alertIf(tried, !draft.title.trim())}>
        <Field.Label>Template Title</Field.Label>
        <TextInput value={draft.title} onChange={(title) => set({ title })} />
        <Field.HintText>
          This is the name that workers will see. Please make sure that it is clear and concise (E.g. General labour,
          forklift operator).
        </Field.HintText>
      </Field>
      <Field>
        <Field.Label>Tags</Field.Label>
        <TagsField options={tags} value={draft.tags} onChange={(next) => set({ tags: next })} />
        <Field.HintText>Optional</Field.HintText>
      </Field>
      <Field orientation="horizontal">
        <Switch checked={draft.offSite} onChange={(offSite) => set({ offSite })} />
        <Field.Content>
          <Field.Label>This is an off-site role</Field.Label>
          <Field.HintText>
            Off-site roles are roles where the worker is required to leave the job-site during their shift, for example,
            driving or driver&apos;s assistant roles
          </Field.HintText>
        </Field.Content>
      </Field>
    </>
  );
}

const SEARCH_DELAY = 100;

// Browsers ignore `autocomplete="off"` on an address: Chrome fills no field whose autocomplete it doesn't know, and
// Safari offers AutoFill to a field labelled with the word, which a zero-width non-joiner breaks without showing.
const NO_AUTOFILL = "no-autofill";
export const ADDRESS = "Addr\u200Cess";

/** The address's type-ahead, suggesting what Google's Places finds for what's typed, the place picked found in full. */
export function AddressSearch({ value, onChange }: { value: Place | null; onChange: (place: Place | null) => void }) {
  const geo = use(GeoContext);
  const [found, setFound] = useState<Suggestion[]>([]);
  const pending = useRef<{ timer?: ReturnType<typeof setTimeout>; abort?: AbortController }>({});
  const options = value && !found.some((place) => place.id === value.id) ? [suggestionOf(value), ...found] : found;

  useEffect(() => {
    const current = pending.current;
    return () => {
      clearTimeout(current.timer);
      current.abort?.abort();
    };
  }, []);

  // What it last found narrows to what's typed while it answers again.
  const search = (typed: string) => {
    clearTimeout(pending.current.timer);
    pending.current.abort?.abort();
    setFound((last) => narrowed(last, typed));
    if (!typed.trim()) return;
    const abort = new AbortController();
    const timer = setTimeout(
      () => geo.suggest(typed, abort.signal).then((places) => abort.signal.aborted || setFound(places), () => {}),
      SEARCH_DELAY,
    );
    pending.current = { timer, abort };
  };

  // A pick is found in full before it's the value, unless more is typed first.
  const pick = (id: string | null) => {
    const picked = options.find((place) => place.id === id);
    if (!picked) return onChange(null);
    clearTimeout(pending.current.timer);
    pending.current.abort?.abort();
    const abort = new AbortController();
    pending.current = { abort };
    picked.place().then((place) => abort.signal.aborted || onChange(place), () => {});
  };

  return (
    <TypeAhead
      value={value?.id ?? null}
      onChange={pick}
      onQueryChange={search}
      matches={() => true}
      autoComplete={NO_AUTOFILL}
    >
      {options.map((place) => (
        <TypeAhead.Item key={place.id} value={place.id}>
          <Typography variant="bodyLarge">{place.label}</Typography>
        </TypeAhead.Item>
      ))}
    </TypeAhead>
  );
}

// The address's fields over the wage, ruled off from it.
const addressGroupStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlockEnd: "var(--sw-padding-xl)",
  boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
});

const addressRowStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xl)", "& > :first-child": { flex: "1 1 0", minWidth: 0 } });

// A short field beside the address: Figma's 100px, on the 4px grid.
export const besideAddressStyle = css({ width: "6.25rem", flexShrink: 0 });

function AddressStep({ draft, set }: { draft: PresetDraft; set: Set }) {
  return (
    <>
      <Typography tag="h3" variant="heading">Address &amp; wage</Typography>
      <div className={addressGroupStyle}>
        <div className={addressRowStyle}>
          <Field>
            <Field.Label>{ADDRESS}</Field.Label>
            <AddressSearch value={draft.address} onChange={(address) => set({ address, geofence: null, entrance: entranceAt(address) })} />
          </Field>
          <Field className={besideAddressStyle}>
            <Field.Label>Unit Number</Field.Label>
            <TextInput value={draft.unit} onChange={(unit) => set({ unit })} />
            <Field.HintText>Optional</Field.HintText>
          </Field>
        </div>
        {draft.address && (
          <Field>
            <GeofenceMap
              place={draft.address}
              value={draft.geofence}
              onChange={(geofence) => set({ geofence })}
              entrance={draft.entrance}
              onEntranceChange={(entrance) => set({ entrance })}
            />
            <Field.HintText>{GEOFENCE_HINT}</Field.HintText>
          </Field>
        )}
        <Field>
          <Field.Label>Arrival Instructions</Field.Label>
          <TextArea value={draft.directions} onChange={(directions) => set({ directions })} />
          <Field.HintText>Let workers know how to find the job site and what to do upon arrival</Field.HintText>
        </Field>
      </div>
      <Field className={css({ width: "8.75rem" })}>
        <Field.Label>Hourly Wage</Field.Label>
        <TextInput value={draft.wage} inputMode="decimal" onChange={(wage) => set({ wage })}>
          <TextInput.Prefix>CAD</TextInput.Prefix>
        </TextInput>
        <Field.HintText>Minimum hourly wage: CAD 23.00</Field.HintText>
      </Field>
    </>
  );
}

/** Every skill and requirement in one inline table, a kind or all of them, narrowed by its header's search. */
// Given only its lists, it skips the redraw of all its rows while another step's field is typed in.
const SkillsStep = memo(function SkillsStep({
  skills,
  requirements,
  locked,
  onPick,
  tried,
}: Pick<PresetDraft, "skills" | "requirements"> & { locked: string[]; onPick: (keys: string[]) => void; tried: boolean }) {
  return (
    <>
      <Typography tag="h3" variant="heading">Skills &amp; requirements</Typography>
      <ChoicesField
        label="Skills & requirements"
        placeholder="Find a skill or requirement..."
        value={pickedKeys({ skills, requirements })}
        onChange={onPick}
        locked={locked}
        tone={alertIf(tried, skills.length === 0)}
        hint="Select at least one skill"
      />
    </>
  );
});

function DetailsStep({ draft, set, tried }: { draft: PresetDraft; set: Set; tried: boolean }) {
  const typeIn = useTypedNote((description) => set({ description }));
  return (
    <>
      <div className={titleRowStyle}>
        <Typography tag="h3" variant="heading">Template details</Typography>
        <Button size="small" emphasis="tertiary" onClick={() => typeIn(PRESETS.description(draft))}>
          <AiIcon aria-hidden />
          Generate job description
        </Button>
      </div>
      <Field tone={alertIf(tried, !draft.description.trim())}>
        <Field.Label>Job Description</Field.Label>
        <TextArea
          size="large"
          value={draft.description}
          maxLength={DESCRIPTION_LIMIT}
          onChange={(description) => set({ description })}
        />
        <Field.HintText>{`${charactersLeft(draft.description)} characters remaining`}</Field.HintText>
      </Field>
    </>
  );
}

function Chips({ picks }: { picks: string[] }) {
  return (
    <span className={chipsStyle}>
      {picks.map((pick) => (
        <Pill key={pick}>{pick}</Pill>
      ))}
    </span>
  );
}

/** The description's first four lines, then the rest behind Show more. */
function Description({ text }: { text: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const box = node.current;
    if (box) setLong(box.scrollHeight > box.clientHeight + 1);
  }, [text]);
  return (
    <>
      <LabelValuePair>
        <Typography variant="metadata" color="subdued">Job Description</Typography>
        <Typography variant="body" ref={node} className={clampStyle} data-open={open ? "" : undefined}>
          {text}
        </Typography>
      </LabelValuePair>
      {long && !open && (
        <Link onClick={() => setOpen(true)}>Show more</Link>
      )}
    </>
  );
}

function Section({ title, edit, onEdit, children }: { title: string; edit: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className={summarySectionStyle} aria-label={title}>
      <div>
        <Typography tag="h4" variant="subheading">{title}</Typography>
        <Button size="icon" aria-label={edit} onClick={onEdit}>
          <EditIcon aria-hidden />
          <Tooltip>{edit}</Tooltip>
        </Button>
      </div>
      {children}
    </section>
  );
}

function ReviewStep({ draft, addressed, onEdit }: { draft: PresetDraft; addressed: boolean; onEdit: (step: string) => void }) {
  const requirements = new Map(listed(draft.requirements));
  const wage = draft.wage.trim() ? (
    <LabelValuePair>
      <Typography variant="metadata" color="subdued">Hourly Wage</Typography>
      <Typography variant="body">{`CAD ${draft.wage.trim()}`}</Typography>
    </LabelValuePair>
  ) : null;
  return (
    <>
      <Typography tag="h3" variant="heading">Review template summary</Typography>
      <Section title="Basic information" edit="Edit basic information" onEdit={() => onEdit(STEPS[0])}>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Template Title</Typography>
          <Typography variant="body">{draft.title}</Typography>
        </LabelValuePair>
        {draft.tags.length > 0 && (
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">Tags</Typography>
            <Tags tags={draft.tags} />
          </LabelValuePair>
        )}
      </Section>
      {addressed && (
        <Section title="Address & wage" edit="Edit address & wage" onEdit={() => onEdit(ADDRESS_STEP)}>
          {draft.address ? (
            <AddressLocation>
              <Typography variant="body">{draft.address.label}</Typography>
              {draft.unit.trim() && <Typography variant="body">{draft.unit}</Typography>}
              {draft.directions.trim() && (
                <Typography tag="p" variant="metadata" color="subdued">{draft.directions}</Typography>
              )}
              {wage}
              <AddressLocation.Map>
                <GeofenceMap size="small" editable={false} place={draft.address} value={draft.geofence} entrance={draft.entrance} />
              </AddressLocation.Map>
            </AddressLocation>
          ) : (
            wage
          )}
        </Section>
      )}
      <Section title="Skills & requirements" edit="Edit skills & requirements" onEdit={() => onEdit(STEPS[2])}>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Skills</Typography>
          <Typography variant="body"><Chips picks={draft.skills} /></Typography>
        </LabelValuePair>
        {REQUIREMENTS.filter(({ key }) => requirements.has(key)).map(({ key, review }) => (
          <LabelValuePair key={key}>
            <Typography variant="metadata" color="subdued">{review}</Typography>
            <Typography variant="body"><Chips picks={requirements.get(key)!} /></Typography>
          </LabelValuePair>
        ))}
      </Section>
      <Section title="Template details" edit="Edit template details" onEdit={() => onEdit(STEPS[3])}>
        <div>
          <Description text={draft.description} />
        </div>
      </Section>
    </>
  );
}

/**
 * Create a Template Preset, or its edit once it's given a preset's details. A company's templates take `words` too, and
 * are `addressed`: a preset is generic, so it has no Address & Wage step.
 */
const NONE: string[] = [];

export function PresetSheet({
  words = PRESET_WORDS,
  addressed = false,
  initial,
  tags = [],
  editing,
  height,
  onCancel,
  onSave,
  placeholder,
  locked = NONE,
}: {
  words?: SheetWords;
  addressed?: boolean;
  initial: PresetDraft;
  /** The tags its list already holds, which its tags field suggests. */
  tags?: string[];
  editing?: boolean;
  /** The app's, which the sheet runs down. */
  height: number;
  onCancel: () => void;
  onSave: (draft: PresetDraft, status: PresetStatus) => void;
  /** Another project's form: past its title and actions, a placeholder. */
  placeholder?: boolean;
  /** Its team's mandatory requirements, as Skills & requirements' values: picked from the start, and kept. */
  locked?: string[];
}) {
  const standIn = placeholder ? PLACEHOLDER : {};
  const [draft, setDraft] = useState(() => ({ ...initial, ...picksFrom([...pickedKeys(initial), ...locked]) }));
  const set: Set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const pick = useCallback((keys: string[]) => setDraft((current) => ({ ...current, ...picksFrom(keys) })), []);
  const steps = addressed ? STEPS : STEPS.filter((name) => name !== ADDRESS_STEP);
  const ready = stepsReady(draft).filter((_, i) => steps.includes(STEPS[i]));
  const [step, setStep] = useState(() => openingStep(ready));
  const [reached, setReached] = useState(step);
  const sheet = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const title = editing ? words.edit : words.create;
  const last = step === steps.length - 1;
  useEscapeLayer(sheet, true, onCancel);

  // Its step's first field takes focus once the sheet, in, builds its steps.
  const holdBody = useCallback((node: HTMLDivElement | null) => {
    body.current = node;
    node?.querySelector<HTMLInputElement>(":scope > :not([data-away]) input")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
  }, [step]);

  // The steps whose Next (or a save that needs them) was pressed while they still lacked something.
  const [tried, setTried] = useState<string[]>([]);
  const stop = (at: number) => {
    setTried((names) => (names.includes(steps[at]) ? names : [...names, steps[at]]));
    go(at);
  };
  const forward = () => {
    if (!ready[step]) stop(last ? ready.indexOf(false) : step);
    else if (last) onSave(draft, "active");
    else go(step + 1);
  };

  const go = (next: number) => {
    setStep(next);
    setReached((most) => Math.max(most, next));
  };

  const panels = [
    <BasicStep key="basic" draft={draft} set={set} tags={tags} tried={tried.includes(STEPS[0])} />,
    ...(addressed ? [<AddressStep key="address" draft={draft} set={set} />] : []),
    <SkillsStep
      key="skills"
      skills={draft.skills}
      requirements={draft.requirements}
      locked={locked}
      onPick={pick}
      tried={tried.includes(STEPS[2])}
    />,
    <DetailsStep key="details" draft={draft} set={set} tried={tried.includes(STEPS[3])} />,
    <ReviewStep key="review" draft={draft} addressed={addressed} onEdit={(name) => go(steps.indexOf(name))} />,
  ];

  // The steps side by side, those reached holding their panels; glimpsed, only the one it opens on.
  const stepsBody = (glimpse: boolean) => (
    <div ref={glimpse ? undefined : holdBody} className={stepsBodyStyle} {...standIn}>
      {panels.map((panel, i) => {
        const fits = panel.key === "skills";
        return (
          <div
            key={i}
            className={cx(stepPanelStyle, fits && fitStyle)}
            data-away={i === step ? undefined : ""}
            style={{ transform: `translateX(calc(${i - step} * (100% + 1.25rem)))` }}
            aria-hidden={i !== step || undefined}
            inert={i !== step}
          >
            <div className={columnStyle} data-review={i === steps.length - 1 ? "" : undefined} data-fit={fits ? "" : undefined}>
              {(glimpse ? i === step : i <= reached) && panel}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <SideSheet size="large" holds onClose={onCancel} ref={sheet} style={{ height }} label={title} data-escape-layer="">
      <SideSheet.Header>
        <Typography variant="heading">{title}</Typography>
        <SideSheet.Close />
      </SideSheet.Header>
      <FormNav className={stepBarStyle} {...standIn}>
        {steps.map((name, i) => (
          <FormNav.Step
            key={name}
            state={i === step ? "in progress" : i <= reached && ready.slice(0, i).every(Boolean) ? "complete" : "pending"}
            onClick={() => go(i)}
          >
            <Typography variant="metadata" color="subdued">{`Step ${i + 1}`}</Typography>
            <Typography variant="subheading">{name}</Typography>
          </FormNav.Step>
        ))}
      </FormNav>
      <SideSheet.Deferred fallback={stepsBody(true)}>{stepsBody(false)}</SideSheet.Deferred>
      <SideSheet.ActionBar>
        <SideSheet.Cancel />
        <SideSheet.ForwardActions>
          <Button emphasis="secondary" onClick={() => (ready[0] ? onSave(draft, "draft") : stop(0))}>
            Save as draft
          </Button>
          <Button onClick={forward}>
            {last ? (editing ? PRESETS.save : words.submit) : "Next"}
          </Button>
        </SideSheet.ForwardActions>
      </SideSheet.ActionBar>
    </SideSheet>
  );
}
