"use client";

import { Div } from "./ds-tailwind";
import { CalendarStrip } from "./shift-calendar";
import { addMonths, type Iso } from "./shifts";
import { Button, Card, Chip, LabelValuePair, Pill, Typography } from "./ui";
import EditIcon from "./assets/icons/small/edit.svg";
import CancellationIcon from "./assets/icons/small/cancellation.svg";
import WarningIcon from "./assets/icons/small/warning.svg";

// SW Curie's Shift Summary card (15751:13216), with Figma's words; the schedule's dates on its calendar.

// The summary's label-value pairs in 176px columns.
const ROW = "flex gap-(--sw-gap-xl) *:h-[2.75rem] *:flex-[0_0_11rem]";

export type ShiftSummary = {
  title: string;
  startDate?: string;
  startTime: string;
  endDate?: string;
  endTime: string;
  unpaidBreak: string;
  workers: string;
  reportTo: string;
  /** The schedule's dates, shown on its calendar. */
  dates: Iso[];
  today: Iso;
  tags: string[];
};

/** Organisms/Card/Shift Summary: a posted schedule's details, with Edit and Cancel while it has shifts to come. */
export function ShiftSummaryCard({ summary, upcoming }: { summary: ShiftSummary; upcoming: boolean }) {
  return (
    <Card>
      <Card.Header>
        <Typography tag="h3" variant="heading">{summary.title}</Typography>
        {upcoming ? (
          <Card.Actions>
            <Button size="small" emphasis="secondary">
              <EditIcon aria-hidden />
              Edit shift
            </Button>
            <Button size="small" emphasis="secondary" tone="destructive">
              <CancellationIcon aria-hidden />
              Cancel shift
            </Button>
          </Card.Actions>
        ) : (
          <Pill state="warning">
            <WarningIcon aria-hidden />
            No Upcoming Shifts
          </Pill>
        )}
      </Card.Header>
      <Div tw={ROW}>
        {upcoming && summary.startDate && (
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">Shift Start Date</Typography>
            <Typography variant="body">{summary.startDate}</Typography>
          </LabelValuePair>
        )}
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Shift Start Time</Typography>
          <Typography variant="body">{summary.startTime}</Typography>
        </LabelValuePair>
      </Div>
      <Div tw={ROW}>
        {upcoming && summary.endDate && (
          <LabelValuePair>
            <Typography variant="metadata" color="subdued">Shift End Date</Typography>
            <Typography variant="body">{summary.endDate}</Typography>
          </LabelValuePair>
        )}
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Shift End Time</Typography>
          <Typography variant="body">{summary.endTime}</Typography>
        </LabelValuePair>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Unpaid Break</Typography>
          <Typography variant="body">{summary.unpaidBreak}</Typography>
        </LabelValuePair>
      </Div>
      <Div tw={ROW}>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">No. of Workers Required</Typography>
          <Typography variant="body">{summary.workers}</Typography>
        </LabelValuePair>
        <LabelValuePair>
          <Typography variant="metadata" color="subdued">Reporting To</Typography>
          <Typography variant="body">{summary.reportTo}</Typography>
        </LabelValuePair>
      </Div>
      <CalendarStrip value={summary.dates} today={summary.today} first={addMonths(summary.dates[0] ?? summary.today, -1)} />
      <Div tw="flex flex-wrap gap-(--sw-gap-xl)">
        {summary.tags.map((tag) => (
          <Chip size="small" state="affirmative" key={tag}>{tag}</Chip>
        ))}
      </Div>
    </Card>
  );
}

// The code view shows the composition.
ShiftSummaryCard.unwrap = ShiftSummaryCard;
