import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileUpload, PasswordInput, VerificationCodeInput } from "../form-parts";
import { FormNav, WeekDaySelect } from "../new-shift";
import { Calendar, DatePicker } from "../shift-calendar";
import { TimecardForm } from "../timecard";
import { Chip, Field, RadioButton, RadioGroup, SegmentedControl, TextInput } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MISPLACED: [ReactElement, string][] = [
  [<FormNav.Step key="step">Step 1</FormNav.Step>, "FormNav.Step must be used inside FormNav"],
  [<SegmentedControl.Segment key="segment" value="paid">Paid</SegmentedControl.Segment>, "SegmentedControl.Segment must be used inside SegmentedControl"],
  [<WeekDaySelect.Day key="day" value={1}>M</WeekDaySelect.Day>, "WeekDaySelect.Day must be used inside WeekDaySelect"],
  [<DatePicker.Preset key="preset" days={7}>Last 7 days</DatePicker.Preset>, "DatePicker.Preset must be used inside DatePicker"],
  [<Chip.Remove key="remove" />, "Chip.Remove must be used inside Chip"],
  [<VerificationCodeInput.Digit key="digit" />, "VerificationCodeInput.Digit must be used inside VerificationCodeInput"],
  [<Calendar.PeriodList key="list">May</Calendar.PeriodList>, "Calendar.PeriodList must be used inside Calendar"],
  [<Calendar.Prev key="prev">‹</Calendar.Prev>, "Calendar.Prev must be used inside Calendar"],
  [<Calendar.Next key="next">›</Calendar.Next>, "Calendar.Next must be used inside Calendar"],
  [<Calendar.Period key="period">May</Calendar.Period>, "Calendar.Period must be used inside Calendar"],
  [<Calendar.Month key="month" />, "Calendar.Month must be used inside Calendar"],
  [<Calendar.Week key="week"><Calendar.Day /></Calendar.Week>, "Calendar.Week must be used inside Calendar"],
  [<Calendar.Day key="weekday" />, "Calendar.Day must be used inside Calendar"],
  [<Calendar.Grid key="grid"><Calendar.Date /></Calendar.Grid>, "Calendar.Grid must be used inside Calendar"],
  [<Calendar.Date key="date" />, "Calendar.Date must be used inside Calendar"],
  [
    <PasswordInput.Conditions key="conditions">
      <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
    </PasswordInput.Conditions>,
    "PasswordInput.Conditions must be used inside PasswordInput",
  ],
  [
    <PasswordInput.Condition key="condition" rule="length">At least 8 characters</PasswordInput.Condition>,
    "PasswordInput.Condition must be used inside PasswordInput.Conditions",
  ],
  [<FileUpload.Idle key="idle">Drop an image</FileUpload.Idle>, "FileUpload.Idle must be used inside FileUpload"],
  [<FileUpload.Dragging key="dragging">Drop it here</FileUpload.Dragging>, "FileUpload.Dragging must be used inside FileUpload"],
  [<FileUpload.Browse key="browse">Browse files...</FileUpload.Browse>, "FileUpload.Browse must be used inside FileUpload"],
  [<Field.Content key="content">Temp to hire</Field.Content>, "Field.Content must be used inside Field"],
  [<TextInput.Prefix key="prefix">$</TextInput.Prefix>, "TextInput.Prefix must be used inside TextInput"],
  [<TextInput.Suffix key="suffix">h</TextInput.Suffix>, "TextInput.Suffix must be used inside TextInput"],
  [<TimecardForm.Head key="head">Adjusted</TimecardForm.Head>, "TimecardForm.Head must be used inside TimecardForm"],
  [<TimecardForm.Row key="row">Times</TimecardForm.Row>, "TimecardForm.Row must be used inside TimecardForm"],
  [<TimecardForm.Times key="times">9:00 AM</TimecardForm.Times>, "TimecardForm.Times must be used inside TimecardForm"],
  [<TimecardForm.Start key="start" />, "TimecardForm.Start must be used inside TimecardForm"],
  [<TimecardForm.End key="end" />, "TimecardForm.End must be used inside TimecardForm"],
  [<TimecardForm.Break key="break" />, "TimecardForm.Break must be used inside TimecardForm"],
  [<TimecardForm.Note key="note" />, "TimecardForm.Note must be used inside TimecardForm"],
  [<TimecardForm.Footer key="footer">Cancel</TimecardForm.Footer>, "TimecardForm.Footer must be used inside TimecardForm"],
  [<TimecardForm.ForwardActions key="forward">8.00 h</TimecardForm.ForwardActions>, "TimecardForm.ForwardActions must be used inside TimecardForm"],
  [<TimecardForm.Billed key="billed" />, "TimecardForm.Billed must be used inside TimecardForm"],
  [<TimecardForm.Submit key="submit">Adjust hours</TimecardForm.Submit>, "TimecardForm.Submit must be used inside TimecardForm"],
];

describe("a part outside the component that owns it", () => {
  it.each(MISPLACED.map(([part, message]) => [message, part] as const))("throws: %s", (message, part) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(part)).toThrow(new Error(message));
  });

  it("takes a radio's value only in a RadioGroup, the radio standing alone without one", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RadioButton value="this" />)).toThrow(new Error("RadioButton's value is for a radio in a RadioGroup"));
    render(<RadioButton aria-label="This shift only" />);
    render(
      <RadioGroup aria-label="What would you like to edit?" defaultValue="this">
        <RadioButton value="this" aria-label="This shift only" />
      </RadioGroup>,
    );
    expect(screen.getAllByRole("radio", { name: "This shift only" })).toHaveLength(2);
  });

  it("keeps a resting password's conditions hidden, not refused", () => {
    render(
      <PasswordInput aria-label="Password">
        <PasswordInput.Conditions>
          <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
        </PasswordInput.Conditions>
      </PasswordInput>,
    );
    expect(screen.queryByText("At least 8 characters")).toBeNull();
  });
});
