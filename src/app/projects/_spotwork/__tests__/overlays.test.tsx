import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Table } from "../data-table";
import { WorkerHoursDialog } from "../overlays";
import { ApplicantSelector, bookingParts } from "../shift-planner";
import { Metadata, ReferenceHours, TimecardForm } from "../timecard";
import { Button, Dialog, Field, LabelValuePair, Link, Typography, glyph } from "../ui";

afterEach(cleanup);

describe("Overlay/Shift Planner/Applicant Selector", () => {
  /** `selector` as a worker's day in a row of the planner's table. */
  const day = (selector: ReactNode) => (
    <Table aria-label="Shift planner" columns="5.25rem">
      <Table.Body>
        <Table.Row>{selector}</Table.Row>
      </Table.Body>
    </Table>
  );

  it("is a cell of its row, showing what's booked on a worker's day in its colours, and a day gone grey whatever it holds", () => {
    const { rerender } = render(
      day(
        <ApplicantSelector booking="offered">
          <Typography variant="metadata">Offered</Typography>
          <svg data-icon="" />
        </ApplicantSelector>,
      ),
    );
    const cell = screen.getByRole("cell");
    // Its icon over its word, wherever it's written.
    const parts = [...cell.querySelectorAll("svg, [data-typography]")];
    expect(parts.map((part) => (part.tagName === "svg" ? "svg" : part.textContent))).toEqual(["svg", "Offered"]);
    expect(cell.dataset.booking).toBe("offered");
    rerender(day(<ApplicantSelector booking="booked" past>{bookingParts("booked")}</ApplicantSelector>));
    expect(cell.textContent).toBe("Booked");
    expect(cell.hasAttribute("data-past")).toBe(true);
    rerender(day(<ApplicantSelector booking={null} />));
    expect(cell.textContent).toBe("");
  });

  it("takes what any of its table's cells takes, its row's marks on it too", () => {
    render(day(<ApplicantSelector booking={null} data-week-end="" />));
    expect(screen.getByRole("cell").hasAttribute("data-week-end")).toBe(true);
  });

  it("shows when it's selected, marked by a checked small checkbox at its top start", () => {
    const { rerender } = render(day(<ApplicantSelector booking="offered">{bookingParts("offered")}</ApplicantSelector>));
    const cell = screen.getByRole("cell");
    expect(cell.querySelector("[data-mark]")).toBeNull();
    rerender(day(<ApplicantSelector booking="offered" selected>{bookingParts("offered")}</ApplicantSelector>));
    expect(cell.hasAttribute("data-selected")).toBe(true);
    const box = cell.querySelector("[data-mark] [role=checkbox]")!;
    expect([box.getAttribute("aria-checked"), box.getAttribute("data-size")]).toEqual(["true", "small"]);
    expect(cell.querySelector("[data-mark]")!.hasAttribute("inert")).toBe(true);
    expect(cell.querySelector("[data-mark]")!.getAttribute("aria-hidden")).toBe("true");
    expect(cell.textContent).toBe("Offered");
  });

  it("keeps a selectable cell's checkbox unchecked until it's selected, for its hover to show, and checked after", () => {
    const pick = vi.fn();
    const { rerender } = render(day(<ApplicantSelector booking="offered" label="Pick Mon" onSelect={pick} />));
    const cell = screen.getByRole("cell");
    const mark = () => cell.querySelector("[data-mark] [role=checkbox]")!;
    expect(mark().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Pick Mon" }));
    expect(pick).toHaveBeenCalledOnce();
    expect(mark().getAttribute("aria-checked")).toBe("false");
    rerender(day(<ApplicantSelector booking="offered" label="Pick Mon" onSelect={pick} selected />));
    expect(mark().getAttribute("aria-checked")).toBe("true");
  });

  it("runs its selection on into the neighbours it's joined to", () => {
    render(day(<ApplicantSelector booking="offered" selected joined={["top", "left"]} />));
    expect(screen.getByRole("cell").dataset.joined).toBe("top left");
  });

  it("throws outside a table's row, as any cell does", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ApplicantSelector booking={null} />)).toThrow("Table.Cell must be used inside Table.Row");
    vi.restoreAllMocks();
  });
});

describe("Molecules/Card Content/Metadata", () => {
  it("shows its note over who took the action and when", () => {
    render(
      <Metadata>
        <Typography tag="p" variant="body">
          Lorem Ipsum
        </Typography>
        <Typography tag="div" variant="metadata" className={glyph.subdued}>
          Added by
          <Link>Shonda Williams</Link>
          • Sep 24, 2023, 9:15 AM
        </Typography>
      </Metadata>,
    );
    const metadata = screen.getByText("Lorem Ipsum").parentElement!;
    expect([...metadata.children].map((node) => node.tagName)).toEqual(["P", "DIV"]);
    expect(within(metadata).getByRole("button", { name: "Shonda Williams" })).toBeTruthy();
    expect(metadata.textContent).toBe("Lorem IpsumAdded byShonda Williams• Sep 24, 2023, 9:15 AM");
  });

  it("is History Only without a note", () => {
    render(
      <Metadata>
        <Typography tag="div" variant="metadata" className={glyph.subdued}>
          Added by
          <Link>Shonda Williams</Link>
          • Sep 24, 2023, 9:15 AM
        </Typography>
      </Metadata>,
    );
    const byline = screen.getByRole("button", { name: "Shonda Williams" }).parentElement!;
    expect(byline.parentElement!.children).toHaveLength(1);
    expect(byline.parentElement!.querySelector("p")).toBeNull();
  });
});

describe("Molecules/Dialog/Worker Submitted Hours", () => {
  it("sets its icon beside its content, the hours in a row, and its action bar under both", async () => {
    const user = userEvent.setup();
    const [onReject, onAdjust, onApprove] = [vi.fn(), vi.fn(), vi.fn()];
    render(
      <WorkerHoursDialog label="Approve worker submitted hours?">
        <svg data-icon="" />
        <WorkerHoursDialog.Content>
          <Typography tag="h2" variant="heading">
            Approve worker submitted hours?
          </Typography>
          <WorkerHoursDialog.Hours>
            <LabelValuePair>
              <Typography variant="metadata" className={glyph.subdued}>Shift Start Time</Typography>
              <Typography variant="body">12:00 AM</Typography>
            </LabelValuePair>
            <LabelValuePair>
              <Typography variant="metadata" className={glyph.subdued}>Shift End Time</Typography>
              <Typography variant="body">8:00 AM</Typography>
            </LabelValuePair>
          </WorkerHoursDialog.Hours>
          <p>Notes</p>
        </WorkerHoursDialog.Content>
        <Dialog.ActionBar>
          <Button emphasis="tertiary" tone="warning" onClick={onReject}>
            Reject hours
          </Button>
          <Dialog.ForwardActions>
            <Button emphasis="tertiary" tone="warning" onClick={onAdjust}>
              Adjust hours...
            </Button>
            <Button emphasis="secondary" tone="warning" onClick={onApprove}>
              Approve hours
            </Button>
          </Dialog.ForwardActions>
        </Dialog.ActionBar>
      </WorkerHoursDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Approve worker submitted hours?" });
    expect([...dialog.children].map((node) => node.tagName)).toEqual(["svg", "DIV", "DIV"]);
    // As wide as what holds it: the timecard overlay's body.
    expect(dialog.className).not.toMatch(/\bw_/);
    const row = screen.getByText("Shift Start Time").parentElement!.parentElement!;
    expect(row.children).toHaveLength(2);
    expect(row.nextElementSibling!.textContent).toBe("Notes");
    await user.click(within(dialog).getByRole("button", { name: "Reject hours" }));
    await user.click(within(dialog).getByRole("button", { name: "Adjust hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Approve hours" }));
    expect([onReject, onAdjust, onApprove].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });
});

describe("Billable Duration Card's Absent, in progress", () => {
  it("shows the hours it's marked against, and marks absent with its note", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TimecardForm label="Absent" onSubmit={onSubmit}>
        <ReferenceHours>
          <Typography variant="body">Worker Submitted Hours</Typography>
          <LabelValuePair>
            <Typography variant="metadata" className={glyph.subdued}>Shift Start Time</Typography>
            <Typography variant="body">12:00 AM</Typography>
          </LabelValuePair>
        </ReferenceHours>
        <Field>
          <Field.Label>Note</Field.Label>
          <TimecardForm.Note />
        </Field>
        <TimecardForm.Footer>
          <TimecardForm.Submit tone="destructive">Mark Absent</TimecardForm.Submit>
        </TimecardForm.Footer>
      </TimecardForm>,
    );
    const form = screen.getByRole("group", { name: "Absent" });
    expect(within(form).getByText("Worker Submitted Hours")).toBeTruthy();
    await user.type(within(form).getByRole("textbox", { name: "Note" }), "Sent home.");
    await user.click(within(form).getByRole("button", { name: "Mark Absent" }));
    expect(onSubmit).toHaveBeenCalledWith({ hours: undefined, note: "Sent home." });
  });
});
