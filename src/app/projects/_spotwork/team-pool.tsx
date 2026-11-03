"use client";

import { use, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { poolText, type Team } from "./activations";
import { cardStyle, sheetBodyStyle } from "./dashboard-sheet";
import { ActionStack, Avatar, Table } from "./data-table";
import { Dropdown } from "./dropdown";
import { RangeType } from "./filters";
import { EmptyState } from "./form-parts";
import { GeoContext } from "./geo";
import type { LatLng, Place } from "./geofence";
import { RangeMap } from "./geofence-map";
import { ADDRESS, AddressSearch } from "./preset-sheet";
import { PickAll, PickOne, usePickBar, usePicks, type Picks } from "./picks";
import { WorkerName } from "./profile-card";
import { Search, TypeAhead } from "./search";
import { TabGroup } from "./tabs";
import { holds } from "./timesheet";
import { Button, Field, SegmentedControl, SideSheet, Tags, TextInput, Tooltip, Typography, alertIf } from "./ui";
import { findByName, findNearby, foundText, poolWorkers, skillsOf, withSkills, type PoolWorker } from "./worker-pool";
import DeleteIcon from "./assets/delete.svg";
import AddIcon from "./assets/icons/medium/add.svg";
import SearchIcon from "./assets/icons/small/magnifying-glass.svg";

// Manage worker pool: a team's workers, each to remove, and Find workers (22309:63785, 23280:27864), by location once
// searched, then filtered by skill, or by name or number as it's typed, each found to add. Figma's "Spotter" is "worker"
// here.

type Tab = "pool" | "find";

const COLUMNS = "2.75rem minmax(0, 1fr) auto auto";

/** Manage worker pool's header and its tabs, in a small side sheet. */
export function TeamPool({ team, onAdd, onRemove }: { team: Team; onAdd: (workers: string[]) => void; onRemove: (workers: string[]) => void }) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("pool");
  const tabs: { value: Tab; label: string }[] = [
    { value: "pool", label: "Team's worker pool" },
    { value: "find", label: "Find workers" },
  ];
  const panel: Panel = { id: `${id}-panel`, role: "tabpanel", "aria-labelledby": `${id}-${tab}`, className: sheetBodyStyle };

  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Manage worker pool</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{`${team.name} • ${poolText(team)}`}</Typography>
      </SideSheet.Header>
      <TabGroup size="small" value={tab} onChange={setTab}>
        {tabs.map(({ value, label }) => (
          <TabGroup.Tab key={value} value={value} id={`${id}-${value}`} aria-controls={`${id}-panel`}>
            {label}
          </TabGroup.Tab>
        ))}
      </TabGroup>
      {tab === "pool" ? (
        <Pool team={team} panel={panel} onFind={() => setTab("find")} onRemove={onRemove} />
      ) : (
        <FindWorkers team={team} panel={panel} onAdd={onAdd} />
      )}
    </>
  );
}

/** The tab panel's own props. */
type Panel = Pick<ComponentProps<"div">, "id" | "role" | "aria-labelledby" | "className">;

/** Those whose name or phone number holds `query`, or everyone while it's empty. */
const narrowed = (workers: PoolWorker[], query: string) => (query.trim() ? workers.filter((worker) => holds(worker, query)) : workers);

/** A list's skills filter, out of `skills`, those with any picked shown. */
function SkillsFilter({ skills, value, onChange }: { skills: string[]; value: string[]; onChange: (picked: string[]) => void }) {
  return (
    <Dropdown size="small" multiple value={value} onChange={onChange}>
      <Typography variant="metadata">Skills</Typography>
      {skills.map((skill) => (
        <Dropdown.Item key={skill} value={skill}>
          <Typography variant="metadata">{skill}</Typography>
        </Dropdown.Item>
      ))}
    </Dropdown>
  );
}

/** The team's worker pool, filtered by skill and counted, each worker to remove, or those ticked at once. */
function Pool({ team, panel, onFind, onRemove }: { team: Team; panel: Panel; onFind: () => void; onRemove: (workers: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const workers = poolWorkers(team.pool);
  const skills = skillsOf(workers);
  const filter = picked.filter((skill) => skills.includes(skill));
  const shown = narrowed(withSkills(workers, filter), query);
  const picks = usePicks(shown.map(({ id }) => id));
  const { room, bar } = usePickBar(picks, { label: "Remove from pool", tone: "destructive", onAct: onRemove });

  return (
    <>
      <div {...panel} style={room}>
        {team.pool.length === 0 ? (
          <EmptyState>
            <Typography variant="subheading">Workers you add to this team&apos;s worker pool will appear here</Typography>
            <Button size="small" onClick={onFind}>
              Find workers
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className={resultsStyle}>
              <SkillsFilter skills={skills} value={filter} onChange={setPicked} />
              <Typography variant="body">{foundText(shown.length)}</Typography>
            </div>
            <Workers
              label="Team's worker pool"
              workers={shown}
              query={query}
              onQuery={setQuery}
              picks={picks}
              action={(worker) => (
                <Button size="icon" tone="destructive" aria-label="Remove from pool" onClick={() => onRemove([worker.id])}>
                  <DeleteIcon aria-hidden />
                  <Tooltip>Remove from pool</Tooltip>
                </Button>
              )}
            />
          </>
        )}
      </div>
      {bar}
    </>
  );
}

/** The workers' table: each one's box, picture and name, their skills, then `action`; its Worker header finds them by name. */
function Workers({
  label,
  workers,
  query,
  onQuery,
  picks,
  action,
}: {
  label: string;
  workers: PoolWorker[];
  query: string;
  onQuery: (query: string) => void;
  picks: Picks<string>;
  action: (worker: PoolWorker) => ReactNode;
}) {
  return (
    <Table aria-label={label} columns={COLUMNS} outline>
      <Table.Head>
        <Table.Row>
          <PickAll picks={picks} />
          <Table.Cell search aria-label="Worker">
            <Search size="small" placeholder="Find a worker..." value={query} onChange={(event) => onQuery(event.target.value)} />
          </Table.Cell>
          <Table.Cell>
            <Typography variant="metadata">Skills</Typography>
          </Table.Cell>
          <Table.Cell>
            <Typography variant="metadata">Actions</Typography>
          </Table.Cell>
        </Table.Row>
      </Table.Head>
      {workers.length > 0 && (
        <Table.Body>
          {workers.map((worker) => (
            <Table.Row key={worker.id} data-picked={picks.has(worker.id) ? "" : undefined}>
              <PickOne picks={picks} value={worker.id} label={worker.name} />
              <Table.Cell>
                <Avatar src={worker.face} size="inline" />
                <WorkerName worker={worker} />
              </Table.Cell>
              <Table.Cell>
                <Tags tags={worker.skills} aria-label="Skills" />
              </Table.Cell>
              <Table.Cell>
                <ActionStack centered>{action(worker)}</ActionStack>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      )}
    </Table>
  );
}

type Mode = "name" | "location";

/** Range's stops, in kilometres. */
const RANGES = [5, 10, 15, 20, 25, 30];

const nearestRange = (km: number) => RANGES.reduce((best, at) => (Math.abs(at - km) < Math.abs(best - km) ? at : best));

// The address over the range, the minimap down their end, the template card's map column wide, from the address's box
// to the range's (each field's label and box rows of the form's own); widened, the map between them.
const locationStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 12.5rem",
  gridTemplateAreas: '"address ." "address map" "range map" "range map"',
  columnGap: "var(--sw-gap-xl)",
  "& > [data-field]": { display: "grid", gridTemplateRows: "subgrid" },
  "&[data-expanded]": {
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateAreas: '"address" "address" "map" "range" "range"',
  },
});

const AREA = {
  address: css({ gridArea: "address", minWidth: 0 }),
  range: css({ gridArea: "range", marginBlockStart: "var(--sw-gap-xl)" }),
  map: css({ gridArea: "map", display: "flex", flexDirection: "column", "[data-expanded] > &": { marginBlockStart: "var(--sw-gap-xl)" } }),
};

// The range's box, Figma's 100px, then its slider across the rest.
const rangeRowStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)", "& > :first-child": { width: "6.25rem", flexShrink: 0 } });
const rangeSliderRaw = css.raw({ flex: "1 1 auto", width: "auto", minWidth: 0, paddingBlock: 0 });

// A list's filters, then how many it shows, at the end.
export const resultsStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-md)", "& > :last-child": { marginInlineStart: "auto" } });

/** What Search last looked for, and the pool then: those added since leave its list, no one taking their place. */
type Nearby = { place: Place; km: number; pool: string[] };

/**
 * Find workers' form over what it finds, counted: round an address, from the team's own, once searched, then those with
 * any skill picked, or by name or number as it's typed; never those in the pool. Each to add, or those ticked at once.
 */
function FindWorkers({ team, panel, onAdd }: { team: Team; panel: Panel; onAdd: (workers: string[]) => void }) {
  const [mode, setMode] = useState<Mode>("location");
  const [query, setQuery] = useState("");
  // The Worker header's, narrowing what's found.
  const [named, setNamed] = useState("");
  const [place, setPlace] = useState<Place | null>(team.address);
  const [km, setKm] = useState(RANGES[0]);
  // What's typed in the range's box until it's left; the range takes the nearest stop to it.
  const [typed, setTyped] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [searched, setSearched] = useState<Nearby | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Where the pin's let go becomes the address: Google's for it, or else its coordinates.
  const geo = use(GeoContext);
  const naming = useRef<AbortController>(null);
  useEffect(() => () => naming.current?.abort(), []);
  const move = (to: LatLng) => {
    naming.current?.abort();
    const abort = (naming.current = new AbortController());
    const spot = { id: `${to.lat},${to.lng}`, label: `${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`, ...to };
    const name = (found: Place | null) => abort.signal.aborted || setPlace(found ? { ...found, ...to } : spot);
    geo.address(to, abort.signal).then(name, () => name(null));
  };

  const typeRange = (text: string) => {
    setTyped(text);
    if (text.trim() && !Number.isNaN(Number(text))) setKm(nearestRange(Number(text)));
  };

  const search = () => {
    if (!place) return setTried(true);
    setSearched({ place, km, pool: team.pool });
    setExpanded(false);
  };
  const nearby = searched ? findNearby(searched.place, searched.km, searched.pool).filter((worker) => !team.pool.includes(worker.id)) : [];
  const skills = skillsOf(nearby);
  const filter = picked.filter((skill) => skills.includes(skill));
  const found = mode === "name" ? findByName(query, team.pool) : withSkills(nearby, filter);
  const shown = narrowed(found, named);
  const listed = mode === "name" ? !!query.trim() : !!searched;
  const picks = usePicks(shown.map(({ id }) => id));
  const { room, bar } = usePickBar(picks, { label: "Add to pool", onAct: onAdd });

  return (
    <>
      <div {...panel} style={room}>
        <div className={cardStyle} data-padded="">
          <SegmentedControl value={mode} onChange={setMode} layout="fill">
            <SegmentedControl.Segment value="location">Find by location</SegmentedControl.Segment>
            <SegmentedControl.Segment value="name">Find by name or number</SegmentedControl.Segment>
          </SegmentedControl>
          {mode === "name" ? (
            <Field>
              <Field.Label>Find a Worker</Field.Label>
              <TypeAhead onQueryChange={setQuery} defaultQuery={query} />
              <Field.HintText>Look workers up by their name or phone number</Field.HintText>
            </Field>
          ) : (
            <>
              <div className={locationStyle} data-location="" data-expanded={expanded ? "" : undefined}>
                <Field className={AREA.address} tone={alertIf(tried, !place)}>
                  <Field.Label>{`Find Workers by ${ADDRESS}`}</Field.Label>
                  <AddressSearch value={place} onChange={setPlace} />
                </Field>
                {place && (
                  <div className={AREA.map}>
                    <RangeMap
                      place={place}
                      km={km}
                      size={expanded ? "wide" : "mini"}
                      onExpand={() => setExpanded(true)}
                      onMove={move}
                    />
                  </div>
                )}
                <Field className={AREA.range}>
                  <Field.Label>Range</Field.Label>
                  <div className={rangeRowStyle}>
                    <TextInput value={typed ?? String(km)} inputMode="decimal" onChange={typeRange} onBlur={() => setTyped(null)}>
                      <TextInput.Suffix>km</TextInput.Suffix>
                    </TextInput>
                    <RangeType
                      type="discrete"
                      single
                      steps={RANGES}
                      value={[RANGES[0], km]}
                      onChange={([, next]) => setKm(next)}
                      css={rangeSliderRaw}
                    />
                  </div>
                </Field>
              </div>
              <div>
                <Button size="small" emphasis="secondary" onClick={search}>
                  <SearchIcon aria-hidden />
                  Search
                </Button>
              </div>
            </>
          )}
        </div>
        {listed && (
          <div className={resultsStyle}>
            {mode === "location" && <SkillsFilter skills={skills} value={filter} onChange={setPicked} />}
            <Typography variant="body">{foundText(shown.length)}</Typography>
          </div>
        )}
        {found.length > 0 && (
          <Workers
            label="Find workers"
            workers={shown}
            query={named}
            onQuery={setNamed}
            picks={picks}
            action={(worker) => (
              <Button size="icon" aria-label="Add to pool" onClick={() => onAdd([worker.id])}>
                <AddIcon aria-hidden />
                <Tooltip>Add to pool</Tooltip>
              </Button>
            )}
          />
        )}
      </div>
      {bar}
    </>
  );
}
