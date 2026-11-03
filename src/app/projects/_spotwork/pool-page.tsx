"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import type { Team } from "./activations";
import { SNACKS } from "./copy";
import { ActionStack, Avatar, Table, Tags } from "./data-table";
import { TeamData } from "./team-loading";
import { Dropdown } from "./dropdown";
import { RangeSelector } from "./filters";
import { pageStyle } from "./presets-page";
import { WorkerName } from "./profile-card";
import { Search } from "./search";
import { Button, Chip, Tooltip, Typography } from "./ui";
import {
  favourite,
  listPool,
  poolRecords,
  poolTags,
  removeFromPool,
  tagWorker,
  bookedText,
  SHIFT_STEPS,
} from "./worker-pool";
import DeleteIcon from "./assets/delete.svg";
import FavouriteIcon from "./assets/icons/medium/favourite.svg";
import FavouritedIcon from "./assets/icons/medium/favourited.svg";

// SW Curie's Manage Spotter Pool (22309:64031): the company app's team's pool, the same one its company's settings
// manage, each worker to star, tag or take out. Figma's "Spotter" is "worker" here.

/** Figma's frame, its padding included: the width the page needs beside the sidebar. */
export const POOL_WIDTH = 1440;

/** `COLUMNS` at their narrowest, with `pageStyle`'s padding. */
export const POOL_MIN_WIDTH = 220 + 200 + 150 + 300 + 70 + 2 * 37.5;

const COLUMNS = "minmax(13.75rem, 15.625rem) 12.5rem 9.375rem minmax(18.75rem, 1fr) auto";

const listStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

const toolbarStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-md)" });

export function PoolPage({
  team,
  onTeam,
  onSnack,
}: {
  /** The company app's team, if it still has it. */
  team?: Team;
  onTeam: (change: (team: Team) => Team) => void;
  onSnack: (message: string) => void;
}) {
  const [today] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [shifts, setShifts] = useState<[number, number]>([SHIFT_STEPS[0], SHIFT_STEPS.at(-1)!]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const tags = team ? poolTags(team) : [];
  const shown = team ? listPool(poolRecords(team, today), { query, shifts, tags: filterTags.filter((tag) => tags.includes(tag)) }) : [];

  return (
    <div className={pageStyle} role="main">
      <Typography tag="h1" variant="title">Manage worker pool</Typography>

      <div className={listStyle}>
        <div className={toolbarStyle}>
          <RangeSelector steps={SHIFT_STEPS} value={shifts} onChange={setShifts}>
            <Typography variant="metadata">Total shifts</Typography>
          </RangeSelector>
          <Dropdown size="small" multiple value={filterTags} onChange={setFilterTags}>
            <Typography variant="metadata">Tags</Typography>
            {tags.map((tag) => (
              <Dropdown.Item key={tag} value={tag}>
                <Typography variant="metadata">{tag}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
        </div>

        <Table aria-label="Worker pool" columns={COLUMNS} outline>
          <Table.Head>
            <Table.Row>
              <Table.Cell search aria-label="Worker">
                <Search size="small" placeholder="Find a worker..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </Table.Cell>
              <Table.Cell>
                <Typography variant="metadata">Last booked</Typography>
              </Table.Cell>
              <Table.Cell>
                <Typography variant="metadata">Total shifts</Typography>
              </Table.Cell>
              <Table.Cell>
                <Typography variant="metadata">Tags</Typography>
              </Table.Cell>
              <Table.Cell>
                <Typography variant="metadata">Actions</Typography>
              </Table.Cell>
            </Table.Row>
          </Table.Head>
          {shown.length > 0 && (
            <TeamData>
              <Table.Body>
                {shown.map((worker) => (
                  <Table.Row key={worker.id}>
                    <Table.Cell>
                      <Avatar src={worker.face} size="inline" />
                      <WorkerName worker={worker} />
                    </Table.Cell>
                    <Table.Cell>
                      <Typography variant="body">{bookedText(worker.lastBooked)}</Typography>
                    </Table.Cell>
                    <Table.Cell>
                      <Typography variant="body">{worker.shifts}</Typography>
                    </Table.Cell>
                    <Table.Cell>
                      <Tags
                        options={tags.filter((tag) => !worker.tags.includes(tag))}
                        onAdd={(tag) => onTeam((team) => tagWorker(team, worker.id, [...new Set([...worker.tags, tag])]))}
                      >
                        {worker.tags.map((tag) => (
                          <Chip key={tag} state="affirmative">
                            {tag}
                            <Chip.Remove
                              aria-label={`Remove ${tag}`}
                              onClick={() => onTeam((team) => tagWorker(team, worker.id, worker.tags.filter((t) => t !== tag)))}
                            />
                          </Chip>
                        ))}
                      </Tags>
                    </Table.Cell>
                    <Table.Cell>
                      <ActionStack>
                        <Button
                          size="icon"
                          aria-label={worker.favourite ? "Remove favourite" : "Favourite"}
                          onClick={() => onTeam((team) => favourite(team, worker.id, !worker.favourite))}
                        >
                          {worker.favourite ? <FavouritedIcon aria-hidden /> : <FavouriteIcon aria-hidden />}
                          <Tooltip>{worker.favourite ? "Remove favourite" : "Favourite"}</Tooltip>
                        </Button>
                        <Button
                          size="icon"
                          tone="destructive"
                          aria-label="Remove from worker pool"
                          onClick={() => {
                            onTeam((team) => removeFromPool(team, worker.id));
                            onSnack(SNACKS.workerRemoved);
                          }}
                        >
                          <DeleteIcon aria-hidden />
                          <Tooltip>Remove from worker pool</Tooltip>
                        </Button>
                      </ActionStack>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </TeamData>
          )}
        </Table>
      </div>
    </div>
  );
}
