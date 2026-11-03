"use client";

import { Fragment, type ReactNode } from "react";
import { CheckInPill, type CheckInStatus } from "./data-table";
import { Variants, defineStory, type Story } from "./ds-story";
import { Div } from "./ds-tailwind";
import { FileUpload, PasswordInput, VerificationCodeInput } from "./form-parts";
import type { Icon } from "./sidebar";
import { Badge, Chip, type ChipState, Field, Pill, Spotscore, Typography } from "./ui";
import UploadIcon from "./assets/icons/large/upload.svg";
import AbsentIcon from "./assets/absent.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import InProgressIcon from "./assets/in-progress.svg";

// The Form page's chips, pills, Spotscore, password, verification code and file upload, as stories; the chips and
// pills each status in the app's tables wears with them.

const CHECK_IN_STATUSES: CheckInStatus[] = [
  "Upcoming",
  "Waiting",
  "Checked In",
  "Missing Check-in",
  "Late Check-in",
  "Absent",
  "Cancelled",
  "Checked Out",
];

/** A chip or pill as Figma draws it: its state (or disabled), its letter badge or icon, and its words. */
type ChipSpec = { state?: ChipState; disabled?: boolean; mark: string | Icon; text: string };

export const TIMESHEET_ACTIONABLE: Record<string, ChipSpec> = {
  Upcoming: { disabled: true, mark: "U", text: "Upcoming" },
  "In Progress": { disabled: true, mark: InProgressIcon, text: "In Progress" },
  Posted: { state: "affirmative", mark: "P", text: "7h 45m" },
  "Checked In & Out": { state: "affirmative", mark: "C", text: "8h 15m" },
  "Worker Submitted": { state: "warning", mark: "S", text: "8h 00m" },
  "Worker Submitted Approved": { state: "affirmative", mark: "S", text: "8h 00m" },
  "Employer Adjusted": { state: "affirmative", mark: "A", text: "8h 00m" },
  Absent: { state: "alert", mark: AbsentIcon, text: "Absent" },
  Confirmed: { state: "success", mark: ConfirmedIcon, text: "10h 05m" },
};

const TIMESHEET_READ_ONLY: Record<string, ChipSpec> = {
  Upcoming: { disabled: true, mark: "U", text: "Upcoming" },
  "In Progress": { disabled: true, mark: InProgressIcon, text: "In Progress" },
  Posted: { state: "affirmative", mark: "P", text: "Posted Hours" },
  "Checked In/Out": { state: "affirmative", mark: "C", text: "Checked In/Out" },
  "Auto-checkout": { state: "warning", mark: "C", text: "Auto-checked Out" },
  "Worker Submitted": { state: "warning", mark: "S", text: "Worker Submitted" },
  "Worker Submitted—Approved": { state: "affirmative", mark: "S", text: "Worker Submitted" },
  "Adjusted Hours": { state: "affirmative", mark: "A", text: "Adjusted Hours" },
  Absent: { state: "alert", mark: AbsentIcon, text: "Absent" },
  Confirmed: { state: "success", mark: ConfirmedIcon, text: "Confirmed" },
};

const VERIFICATION: Record<string, ChipSpec> = {
  Submitted: { state: "affirmative", mark: InProgressIcon, text: "Submitted" },
  Approved: { state: "success", mark: ConfirmedIcon, text: "Approved" },
  Rejected: { state: "alert", mark: AbsentIcon, text: "Rejected" },
};

const markOf = (Mark: string | Icon) => (typeof Mark === "string" ? <Badge inverted>{Mark}</Badge> : <Mark aria-hidden />);

/** A timesheet status's chip, medium. */
export function statusChip({ state, disabled, mark, text }: ChipSpec) {
  return (
    <Chip state={state} disabled={disabled}>
      {markOf(mark)}
      {text}
    </Chip>
  );
}

/** A status's pill. */
function statusPill({ state, disabled, mark, text }: ChipSpec) {
  return (
    <Pill state={state} disabled={disabled}>
      {markOf(mark)}
      {text}
    </Pill>
  );
}

/** A status example: each of Figma's statuses, side by side, as `draw` draws them. */
const statusExample = (title: string, statuses: Record<string, ChipSpec>, draw: (spec: ChipSpec) => ReactNode) => ({
  title,
  render: () => (
    <Variants>
      {Object.entries(statuses).map(([status, spec]) => (
        <Fragment key={status}>{draw(spec)}</Fragment>
      ))}
    </Variants>
  ),
});

// Figma's Chip/Actionable, Large and Small, and Atoms/Pill/Info as one square chip, its size a property. Figma draws a
// large one in any State but Default picked.
export const CHIP = defineStory({
  id: "Chip",
  figma: "Chip",
  examples: [
    { render: () => <Chip>Clamp Truck</Chip> },
    {
      // A template's tag, a timesheet's hours, a tag in a template's Tags Field, and a toggle.
      title: "Size",
      render: () => (
        <Variants>
          <Chip size="small" state="affirmative">
            Licensed
          </Chip>
          <Chip>7h 45m</Chip>
          <Chip size="large" state="affirmative">
            Licensed
            <Chip.Remove />
          </Chip>
          <Chip actionable size="large">
            Clamp Truck
          </Chip>
        </Variants>
      ),
    },
    {
      title: "Actionable",
      render: () => (
        <Variants>
          <Chip state="affirmative">7h 45m</Chip>
          <Chip actionable state="affirmative">
            7h 45m
          </Chip>
        </Variants>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Chip actionable size="large">
            Clamp Truck
          </Chip>
          <Chip actionable size="large" state="affirmative" defaultPressed>
            Driver
          </Chip>
          <Chip actionable size="large" state="success" defaultPressed>
            General Labourer
          </Chip>
          <Chip actionable size="large" state="warning" defaultPressed>
            Manufacturing
          </Chip>
          <Chip actionable size="large" state="alert" defaultPressed>
            Cook
          </Chip>
          <Chip actionable size="large" disabled defaultPressed>
            Cashier
          </Chip>
          <Chip>7h 45m</Chip>
          <Chip state="affirmative">7h 45m</Chip>
          <Chip state="success">10h 05m</Chip>
          <Chip state="warning">8h 15m</Chip>
          <Chip state="alert">Absent</Chip>
          <Chip disabled>In Progress</Chip>
          <Chip size="small" state="affirmative">
            Applicant
          </Chip>
          <Chip size="small" state="success">
            Worker Pool
          </Chip>
          <Chip size="small" state="warning">
            Medium
          </Chip>
          <Chip size="small" state="alert">
            High
          </Chip>
          <Chip size="small" disabled>
            Licensed
          </Chip>
        </Variants>
      ),
    },
    statusExample("Timesheet Status/Actionable", TIMESHEET_ACTIONABLE, statusChip),
  ],
});

// Figma's Chip/Read-only: a round chip.
export const PILL = defineStory({
  id: "Pill",
  figma: "Chip/Read-only",
  examples: [
    // A skill picked in a template's Multiselect, as its review lists it.
    { render: () => <Pill>Clamp Truck</Pill> },
    {
      // A message's type in the Check-ins page's message dialog.
      title: "Actionable",
      render: () => (
        <Variants>
          <Pill>Check-In Message</Pill>
          <Pill actionable>Check-In Message</Pill>
        </Variants>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Pill state="affirmative">
            <Badge inverted>P</Badge>
            Posted Hours
          </Pill>
          <Pill state="success">
            <ConfirmedIcon aria-hidden />
            Confirmed
          </Pill>
          <Pill state="warning">
            <Badge inverted>S</Badge>
            Worker Submitted
          </Pill>
          <Pill state="alert">
            <AbsentIcon aria-hidden />
            Absent
          </Pill>
          <Pill disabled>
            <Badge inverted>U</Badge>
            Upcoming
          </Pill>
        </Variants>
      ),
    },
    {
      title: "Check-in status",
      render: () => (
        <Variants>
          {CHECK_IN_STATUSES.map((status) => (
            <CheckInPill key={status} status={status} />
          ))}
        </Variants>
      ),
    },
    statusExample("Timesheet Status/Read-only", TIMESHEET_READ_ONLY, statusPill),
    statusExample("Verification Status", VERIFICATION, statusPill),
  ],
});

// Figma's Atoms/Pill/Spotscore, its tier a property.
export const SPOTSCORE = defineStory({
  id: "Spotscore",
  figma: "Atoms/Pill/Spotscore",
  examples: [
    { render: () => <Spotscore tier="elite">98</Spotscore> },
    {
      title: "Tier",
      render: () => (
        <Variants>
          <Spotscore tier="elite">98</Spotscore>
          <Spotscore tier="pro">98</Spotscore>
          <Spotscore tier="super">98</Spotscore>
        </Variants>
      ),
    },
  ],
});

// Active is the field in use; Figma's Is Masked is for Active and Alert, so it shows on Alert.
const PASSWORD_INPUT = defineStory({
  id: "Password Input",
  figma: "Molecules/Form/Password Input",
  examples: [
    {
      layout: "grow",
      render: () => (
        <Div tw="w-[27.75rem]">
          <Field>
            <Field.Label>Password</Field.Label>
            <PasswordInput defaultValue="forklift24" defaultMasked>
              <PasswordInput.Conditions>
                <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
                <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
                <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
                <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
                <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
              </PasswordInput.Conditions>
            </PasswordInput>
          </Field>
        </Div>
      ),
    },
    {
      title: "State",
      layout: "grow",
      render: () => (
        <Variants>
          <Div tw="w-[27.75rem]">
            <Field>
              <Field.Label>Password</Field.Label>
              <PasswordInput defaultMasked>
                <PasswordInput.Conditions>
                  <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
                  <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
                  <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
                </PasswordInput.Conditions>
              </PasswordInput>
            </Field>
          </Div>
          <Div tw="w-[27.75rem]">
            <Field tone="alert">
              <Field.Label>Password</Field.Label>
              <PasswordInput defaultValue="forklift24" defaultMasked>
                <PasswordInput.Conditions>
                  <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
                  <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
                  <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
                </PasswordInput.Conditions>
              </PasswordInput>
            </Field>
          </Div>
        </Variants>
      ),
    },
    {
      title: "Is masked",
      layout: "grow",
      render: () => (
        <Variants>
          <Div tw="w-[27.75rem]">
            <Field tone="alert">
              <Field.Label>Password</Field.Label>
              <PasswordInput defaultValue="forklift24" defaultMasked>
                <PasswordInput.Conditions>
                  <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
                  <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
                  <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
                </PasswordInput.Conditions>
              </PasswordInput>
            </Field>
          </Div>
          <Div tw="w-[27.75rem]">
            <Field tone="alert">
              <Field.Label>Password</Field.Label>
              <PasswordInput defaultValue="forklift24">
                <PasswordInput.Conditions>
                  <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
                  <PasswordInput.Condition rule="uppercase">At least 1 uppercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="lowercase">At least 1 lowercase character</PasswordInput.Condition>
                  <PasswordInput.Condition rule="number">At least 1 number</PasswordInput.Condition>
                  <PasswordInput.Condition rule="special">At least 1 special character</PasswordInput.Condition>
                </PasswordInput.Conditions>
              </PasswordInput>
            </Field>
          </Div>
        </Variants>
      ),
    },
  ],
});

const digits = () => Array.from({ length: 6 }, (_, i) => <VerificationCodeInput.Digit key={i} />);

// Active is a digit in use.
const VERIFICATION_CODE = defineStory({
  id: "Verification Code Input",
  figma: "Molecules/Form/Verification Code Input",
  examples: [
    {
      render: () => (
        <Field>
          <Field.Label>Verification Code</Field.Label>
          <VerificationCodeInput>{digits()}</VerificationCodeInput>
        </Field>
      ),
    },
    {
      title: "State",
      render: () => (
        <Variants>
          <Field>
            <Field.Label>Verification Code</Field.Label>
            <VerificationCodeInput>{digits()}</VerificationCodeInput>
          </Field>
          <Field tone="alert">
            <Field.Label>Verification Code</Field.Label>
            <VerificationCodeInput>{digits()}</VerificationCodeInput>
            <Field.HintText>This verification code has expired</Field.HintText>
          </Field>
        </Variants>
      ),
    },
  ],
});

// Its Active is a file dragged over it.
const FILE_UPLOAD = defineStory({
  id: "File Upload",
  figma: "Molecules/Form/File Upload",
  examples: [
    {
      render: () => (
        <Div tw="w-[36.5rem]">
          <FileUpload>
            <FileUpload.Idle>
              <Typography variant="subheading">Drag and drop a file from your desktop or</Typography>
              <FileUpload.Browse>Browse files...</FileUpload.Browse>
              <Typography variant="metadata" color="subdued">
                Supported formats: CSV, XLS, XLSX. Maximum file size: 5 MB.
              </Typography>
            </FileUpload.Idle>
            <FileUpload.Dragging>
              <UploadIcon aria-hidden />
              <Typography variant="subheading">Drop file here to upload</Typography>
              <Typography variant="metadata" color="subdued">
                Supported formats: CSV, XLS, XLSX. Maximum file size: 5 MB.
              </Typography>
            </FileUpload.Dragging>
          </FileUpload>
        </Div>
      ),
    },
  ],
});

export const FORM_MORE_STORIES: Story[] = [
  PASSWORD_INPUT,
  VERIFICATION_CODE,
  FILE_UPLOAD,
];
