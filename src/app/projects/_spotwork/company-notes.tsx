"use client";

import { Fragment, useState } from "react";
import { css } from "../../../../styled-system/css";
import { noteAtText, noteCount, notesText, type Prospect } from "./activations";
import { StatusPill } from "./company-status";
import { AddNote } from "./dashboard-overlays";
import { notesListStyle, sheetBodyStyle } from "./dashboard-sheet";
import { Metadata } from "./timecard";
import { Button, Divider, Link, Presence, SideSheet, Typography } from "./ui";

// SW Curie's Notes overlay (Molecules/Overlay/Notes) as a company's Notes & history: newest first, each status it or a
// team moved to and each note, a rule apart. Its header's Add note raises Add a note over it, as the dashboard's does.

// A status's pill, and the team it's that of, abreast; a span, so Metadata's byline rule for a `div` passes it by.
const statusStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xs)", marginBlockEnd: "var(--sw-margin-xs)" });

/** A company's notes and history, in a small side sheet, its header's Add note adding one. */
export function CompanyNotes({ prospect, onAdd }: { prospect: Prospect; onAdd: (text: string) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <SideSheet.Header>
        <Typography variant="heading">Notes & history</Typography>
        <SideSheet.SheetActions>
          <Button size="small" emphasis="secondary" onClick={() => setAdding(true)}>
            Add note...
          </Button>
        </SideSheet.SheetActions>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{`${prospect.company} • ${notesText(noteCount(prospect))}`}</Typography>
      </SideSheet.Header>
      <Presence>
        {adding && (
          <AddNote
            onAdd={(text) => {
              onAdd(text);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </Presence>
      <div className={sheetBodyStyle}>
        <div role="list" aria-label="Notes & history" className={notesListStyle}>
          {prospect.history.toReversed().map((entry, i) => (
            <Fragment key={`${entry.at.getTime()} ${entry.status} ${entry.text}`}>
              {i > 0 && <Divider />}
              <div role="listitem">
                <Metadata>
                  {entry.status && (
                    <span className={statusStyle}>
                      <StatusPill status={entry.status} />
                      {entry.team && <Typography variant="metadata" color="subdued">{entry.team}</Typography>}
                    </span>
                  )}
                  {entry.text && (
                    <Typography tag="p" variant="body">
                      {entry.text}
                    </Typography>
                  )}
                  <Typography tag="div" variant="metadata" color="subdued">
                    By
                    <Link>{entry.by}</Link>
                    {`• ${noteAtText(entry.at)}`}
                  </Typography>
                </Metadata>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
