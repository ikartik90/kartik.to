import type { RowStatus } from "./dashboard";
import type { Status } from "./data";
import { Pill, STATUS_ICON, STATUS_PILL, type Tone } from "./ui";

/** Each check-in status a dashboard row can have: its words, the Check-ins page's status it looks like, and its tone. */
export const ROW_STATUS: Record<RowStatus, { label: string; chip: Status; tone: Tone }> = {
  missing: { label: "Missing Check-In", chip: "late", tone: "warning" },
  leftSite: { label: "Left Job Site", chip: "late", tone: "warning" },
  upcoming: { label: "Upcoming", chip: "upcoming", tone: "disabled" },
  lateCheckIn: { label: "Late Check-In", chip: "lateCheckIn", tone: "active" },
  checkedIn: { label: "Checked In", chip: "checkedIn", tone: "active" },
  checkedOut: { label: "Checked Out", chip: "checkedOut", tone: "success" },
  absent: { label: "Absent", chip: "absent", tone: "alert" },
};

/** A row's check-in status in its pill, as its table row and its side sheet draw it. */
export function RowStatusPill({ status }: { status: RowStatus }) {
  const { label, chip } = ROW_STATUS[status];
  return (
    <Pill {...STATUS_PILL[chip]}>
      {STATUS_ICON[chip]}
      {label}
    </Pill>
  );
}
