import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import {
  ADJUST_FIELDS,
  BillableDurationCard,
  Metadata,
  NotesAndHistory,
  ReferenceHours,
  SourcePill,
  TimecardForm,
  cardOrder,
  notesAndHistory,
} from "../timecard";
import { Badge, LabelValuePair, Link, Pill, Typography, glyph } from "../ui";

afterEach(cleanup);

const NOTE = (
  <Metadata>
    <Typography tag="p" variant="body">
      Closing timecard.
    </Typography>
    <Typography tag="div" variant="metadata" className={glyph.subdued}>
      Adjusted by
      <Link>Mariana Gonzalez</Link>
      • Sep 24, 2023, 9:15 AM
    </Typography>
  </Metadata>
);

const TEXT = "Closing timecard.Adjusted byMariana Gonzalez• Sep 24, 2023, 9:15 AM";

/** Notes & History of `children`, under its line and its link reading `label`. */
const notesOf = (props: Omit<ComponentProps<typeof NotesAndHistory>, "children"> = {}, children: ReactNode = NOTE, label = "Notes & History") => (
  <NotesAndHistory {...props}>
    <NotesAndHistory.Toggle>{label}</NotesAndHistory.Toggle>
    {children}
  </NotesAndHistory>
);

describe("Molecules/Card Content/Notes & History", () => {
  it("opens and closes its notes from its link", async () => {
    const user = userEvent.setup();
    const { container } = render(notesOf());
    const toggle = screen.getByRole("button", { name: "Notes & History" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.lastElementChild!.tagName.toLowerCase()).toBe("svg");
    expect(container.textContent).not.toContain(TEXT);
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain(TEXT);
    await user.click(toggle);
    expect(container.textContent).not.toContain(TEXT);
  });

  it("draws no line of its own, its link first", () => {
    const { container } = render(notesOf());
    expect(container.querySelector("hr")).toBeNull();
    expect(container.firstElementChild!.firstElementChild!.tagName).toBe("BUTTON");
  });

  it("leaves its line to what holds it, a Divider above it", () => {
    const { container } = render(<>{notesAndHistory([{ text: "Closing timecard.", action: "Adjusted", by: "Mariana Gonzalez", at: "Sep 24, 2023, 9:15 AM" }], { divider: true })}</>);
    const [line, notes] = container.firstElementChild!.children;
    expect(line.tagName).toBe("HR");
    expect(notes.querySelector("hr")).toBeNull();
  });

  it("draws Warning's line in Warning's border colour", () => {
    const { container } = render(<>{notesAndHistory([{ text: "Closing timecard.", action: "Adjusted", by: "Mariana Gonzalez", at: "Sep 24, 2023, 9:15 AM" }], { context: "warning", divider: true })}</>);
    expect(container.querySelector("hr")!.dataset.tone).toBe("warning");
  });

  it("starts open with defaultOpen, under its own label, in Warning's colours", () => {
    render(notesOf({ context: "warning", defaultOpen: true }, NOTE, "1 note"));
    const toggle = screen.getByRole("button", { name: "1 note" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.parentElement!.dataset.tone).toBe("warning");
  });

  it("follows `open` when it's held, telling `onOpenChange` of a press", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container } = render(notesOf({ open: false, onOpenChange }));
    await user.click(screen.getByRole("button", { name: "Notes & History" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.textContent).not.toContain(TEXT);
  });

  it("leaves out a note's text when it has none, and shows nothing without notes", () => {
    const { container, rerender } = render(
      notesOf(
        { defaultOpen: true },
        <Metadata>
          <Typography tag="div" variant="metadata" className={glyph.subdued}>
            Adjusted by
            <Link>William Denver</Link>
            • Sep 23, 2023, 3:15 PM
          </Typography>
        </Metadata>,
      ),
    );
    expect(container.querySelector("p")).toBeNull();
    rerender(notesOf({ defaultOpen: true }, false));
    expect(container.innerHTML).toBe("");
  });
});

describe("Molecules/Overlay/Timesheet/Billable Duration Card", () => {
  it("heads its hours with their chip and its status, a row of pairs under them, then its notes", () => {
    render(
      <BillableDurationCard selected onSelect={() => {}}>
        <SourcePill source="posted" />
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
        <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
        <LabelValuePair>
          <Typography variant="metadata" className={glyph.subdued}>Shift Start Time</Typography>
          <Typography variant="body">12:00 AM</Typography>
        </LabelValuePair>
        <LabelValuePair>
          <Typography variant="metadata" className={glyph.subdued}>Shift End Time</Typography>
          <Typography variant="body">8:00 AM</Typography>
        </LabelValuePair>
        {notesOf()}
      </BillableDurationCard>,
    );
    const card = screen.getByRole("radio");
    expect(card.getAttribute("aria-checked")).toBe("true");
    const [head, row, notes] = card.children;
    expect(head.textContent).toBe("PPosted HoursSelected");
    expect(row.children).toHaveLength(2);
    expect(within(notes as HTMLElement).getByRole("button", { name: "Notes & History" })).toBeTruthy();
  });

  it("is headed by a Chip written out, as the code view prints a SourcePill", () => {
    render(
      <BillableDurationCard selected onSelect={() => {}}>
        <LabelValuePair>
          <Typography variant="metadata">Shift Start Time</Typography>
          <Typography variant="body">12:00 AM</Typography>
        </LabelValuePair>
        <Pill state="affirmative">
          <Badge inverted>P</Badge>
          Posted Hours
        </Pill>
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
      </BillableDurationCard>,
    );
    expect(screen.getByRole("radio").children[0].textContent).toBe("PPosted HoursSelected");
  });

  it("says Confirmed once confirmed, in success's colours", () => {
    render(
      <BillableDurationCard selected confirmed onSelect={() => {}}>
        <SourcePill source="adjusted" />
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
        <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
      </BillableDurationCard>,
    );
    expect(screen.getByRole("radio").textContent).toContain("Confirmed");
    expect(screen.getByRole("radio").hasAttribute("data-confirmed")).toBe(true);
  });

  it("marks a card not picked once the hours are confirmed, with no chip", () => {
    render(
      <BillableDurationCard selected={false} confirmed onSelect={() => {}}>
        <SourcePill source="posted" />
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
        <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
      </BillableDurationCard>,
    );
    const card = screen.getByRole("radio");
    expect([card.getAttribute("aria-checked"), card.hasAttribute("data-confirmed")]).toEqual(["false", true]);
    expect(card.textContent).not.toMatch(/Selected|Confirmed/);
  });

  it("can't be picked once the hours are confirmed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <BillableDurationCard selected={false} confirmed onSelect={onSelect}>
        <SourcePill source="posted" />
      </BillableDurationCard>,
    );
    const card = screen.getByRole("radio");
    await user.click(card);
    card.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
    expect(card.getAttribute("aria-disabled")).toBe("true");
  });

  it("is selected by a press or a key, once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <BillableDurationCard selected={false} onSelect={onSelect}>
        <SourcePill source="checked" />
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
        <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
      </BillableDurationCard>,
    );
    expect(screen.getByRole("radio").textContent).not.toContain("Selected");
    await user.click(screen.getByRole("radio"));
    screen.getByRole("radio").focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(2);
    rerender(
      <BillableDurationCard selected onSelect={onSelect}>
        <SourcePill source="checked" />
        <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
        <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
      </BillableDurationCard>,
    );
    await user.click(screen.getByRole("radio"));
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("holds its own selection, from defaultSelected", async () => {
    const user = userEvent.setup();
    render(
      <>
        <BillableDurationCard defaultSelected>
          <SourcePill source="posted" />
          <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
          <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
        </BillableDurationCard>
        <BillableDurationCard>
          <SourcePill source="checked" />
          <BillableDurationCard.Selected>Selected</BillableDurationCard.Selected>
          <BillableDurationCard.Confirmed>Confirmed</BillableDurationCard.Confirmed>
        </BillableDurationCard>
      </>,
    );
    const [posted, checked] = screen.getAllByRole("radio");
    expect([posted, checked].map((card) => card.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    await user.click(checked);
    expect(checked.getAttribute("aria-checked")).toBe("true");
    expect(checked.textContent).toContain("Selected");
  });
});

describe("a timecard's cards", () => {
  it("put the one picked first, then adjusted, worker submitted, absent, checked in/out and posted hours", () => {
    const all = ["posted", "checked", "absent", "submitted", "adjusted"] as const;
    expect(cardOrder([...all], null)).toEqual(["adjusted", "submitted", "absent", "checked", "posted"]);
    expect(cardOrder([...all], "posted")).toEqual(["posted", "adjusted", "submitted", "absent", "checked"]);
    expect(cardOrder(["posted", "checked"], "checked")).toEqual(["checked", "posted"]);
  });
});

describe("SourcePill", () => {
  it("names its source, or what it's given", () => {
    render(
      <>
        <SourcePill source="submitted" />
        <SourcePill source="checked" tone="warning">
          Auto-checked Out
        </SourcePill>
      </>,
    );
    expect(screen.getByText("Worker Submitted")).toBeTruthy();
    expect(screen.getByText("Auto-checked Out").closest<HTMLElement>("[data-tone]")!.dataset.tone).toBe("warning");
  });
});

describe("Billable Duration Card's Adjusted Hours, in progress", () => {
  it("shows the hours it adjusts, and adjusts them with its note", async () => {
    const user = userEvent.setup();
    const onAdjust = vi.fn();
    render(
      <TimecardForm label="Adjusted Hours" from={{ start: 9 * 60, end: 17 * 60, unpaidBreak: 30 }} onSubmit={onAdjust}>
        <ReferenceHours>
          <LabelValuePair>
            <Typography variant="metadata" className={glyph.subdued}>Shift Start Time</Typography>
            <Typography variant="body">9:00 AM</Typography>
          </LabelValuePair>
          <Typography variant="body">Worker Submitted Hours</Typography>
          <p>Note</p>
        </ReferenceHours>
        {ADJUST_FIELDS}
        <TimecardForm.Footer>
          <TimecardForm.ForwardActions>
            <TimecardForm.Submit emphasis="secondary">Adjust hours</TimecardForm.Submit>
          </TimecardForm.ForwardActions>
        </TimecardForm.Footer>
      </TimecardForm>,
    );
    const form = screen.getByRole("group", { name: "Adjusted Hours" });
    // Its title heads it, wherever it's written.
    const reference = within(form).getByText("Worker Submitted Hours").parentElement!;
    expect([...reference.children].map((node) => node.textContent)).toEqual([
      "Worker Submitted Hours",
      "Shift Start Time9:00 AM",
      "Note",
    ]);
    await user.click(within(form).getByRole("button", { name: "Adjust hours" }));
    expect(onAdjust).toHaveBeenCalledWith({ hours: { start: 9 * 60, end: 17 * 60, unpaidBreak: 30 }, note: "" });
    // Its end, with how long after its start each time falls.
    await user.click(within(form).getByRole("combobox", { name: "Shift End Time" }));
    expect(within(form).getByRole("option", { selected: true }).textContent).toBe("5:00 PM +8 hours");
  });
});
