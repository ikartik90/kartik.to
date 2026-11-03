import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { AddressLocation, DRAG_HINT, FormNav, NewShift, SPOTFILL, TemplateCard, WeekDaySelect, type Version } from "../new-shift";
import { TEMPLATES, type Posting } from "../shifts";
import { Field, Typography } from "../ui";

afterEach(cleanup);

/** A field's look (`data-state`), found by its label. */
const fieldState = (label: string) =>
  screen.getByText(label, { selector: "label" }).closest("[data-field]")!.getAttribute("data-state");

// 3 December 2025 is a Wednesday.
const TODAY = "2025-12-03";

function setup(version: Version) {
  const user = userEvent.setup();
  const onPost = vi.fn<(posting: Posting) => void>();
  const onCancel = vi.fn();
  const dialogOf = (version: Version) => (
    <NewShift version={version} today={TODAY} height={856} onPost={onPost} onCancel={onCancel} />
  );
  const { rerender } = render(dialogOf(version));
  const dialog = screen.getByRole("dialog", { name: "New shift" });
  // The modal's scrim, which date popovers hang from.
  const button = (name: string) => within(dialog.parentElement!).getByRole("button", { name });
  const switchTo = (next: Version) => rerender(dialogOf(next));
  return { user, dialog, button, switchTo, onPost, onCancel };
}

async function describeShift(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("Shift Title"), { target: { value: "Day Shift M/W/F" } });
  await user.click(screen.getByRole("combobox", { name: "Template" }));
  await user.click(screen.getByRole("option", { name: "Forklift Operator" }));
}

/** The final version's dates, picked on its calendar. */
async function planShift(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Friday, 5 December, 2025" }));
  await user.click(screen.getByRole("button", { name: "Monday, 8 December, 2025" }));
}

const current = (step: RegExp) => screen.getByRole("button", { name: step }).getAttribute("aria-current");

describe("the final version", () => {
  it("asks for the shift's dates before its details", async () => {
    const { user, button } = setup("final");
    const steps = screen.getByRole("button", { name: /Shift planning/ }).parentElement!;
    expect([...steps.children].map((step) => step.textContent)).toEqual([
      "Step 1Shift planning",
      "Step 2Shift information",
      "Step 3Review shift summary",
    ]);
    expect(current(/Shift planning/)).toBe("step");
    // Next always answers; with no date picked it stays put, the calendar's hint Alert.
    expect(button("Next")).toHaveProperty("disabled", false);
    await user.click(button("Next"));
    expect(current(/Shift planning/)).toBe("step");
    expect(screen.getByText(DRAG_HINT).getAttribute("data-tone")).toBe("alert");
    await planShift(user);
    expect(screen.getByText(DRAG_HINT).getAttribute("data-tone")).toBeNull();
    await user.click(button("Next"));
    expect(current(/Shift information/)).toBe("step");
    // Without a title and a template it stays put, their fields Alert.
    await user.click(button("Next"));
    expect(current(/Shift information/)).toBe("step");
    expect([fieldState("Shift Title"), fieldState("Template")]).toEqual(["alert", "alert"]);
    await describeShift(user);
    expect([fieldState("Shift Title"), fieldState("Template")]).not.toContain("alert");
    // The template's card, with its map.
    expect(screen.getByRole("heading", { name: "Forklift Operator" })).toBeTruthy();
    expect(screen.getByText("Unit 308")).toBeTruthy();
    await user.click(button("Next"));
    expect(screen.getByRole("heading", { name: "Review shift summary" })).toBeTruthy();
  });

  it("keeps a step it's been to reached on going back to an earlier one", async () => {
    const { user, button } = setup("final");
    const information = () => screen.getByRole<HTMLButtonElement>("button", { name: /Shift information/ });
    expect(information().disabled).toBe(true);
    await planShift(user);
    await user.click(button("Next"));
    await user.click(screen.getByRole("button", { name: /Shift planning/ }));
    expect(information().disabled).toBe(false);
    expect(information().hasAttribute("data-reached")).toBe(true);
  });

  it("asks about SpotFill with the shift's details, under its number of workers and ruled off from More options", async () => {
    const { user, dialog, button, onPost } = setup("final");
    expect(screen.queryByRole("switch", { name: SPOTFILL.label })).toBeNull();
    await planShift(user);
    await user.click(button("Next"));
    const spotFill = screen.getByRole("switch", { name: SPOTFILL.label });
    const workers = screen.getByText("No. of Workers", { selector: "label" });
    const more = button("More options");
    const after = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(after(workers, spotFill)).toBe(true);
    expect([...dialog.querySelectorAll("hr")].filter((rule) => after(spotFill, rule) && after(rule, more))).toHaveLength(1);
    await user.click(spotFill);
    await describeShift(user);
    await user.click(button("Next"));
    await user.click(button("Post shift"));
    expect(onPost.mock.calls[0][0].spotFill).toBe(false);
  });

  it("keeps Bill To/Job Code and the shift's checkboxes under More options, kept as picked while hidden", async () => {
    const { user, button } = setup("final");
    await planShift(user);
    await user.click(button("Next"));
    const more = button("More options");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("textbox", { name: "Bill To/Job Code" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Temp to hire/ })).toBeNull();
    await user.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.textContent).toBe("Fewer options");
    expect(screen.getByRole("textbox", { name: "Bill To/Job Code" })).toBeTruthy();
    for (const name of [/Temp to hire/, /Must work all days/, /Private job/]) expect(screen.getByRole("checkbox", { name })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /Temp to hire/ }));
    await user.click(more);
    expect(more.textContent).toBe("More options");
    expect(screen.queryByRole("checkbox", { name: /Temp to hire/ })).toBeNull();
    await describeShift(user);
    await user.click(button("Next"));
    expect(screen.getByText("Temp to Hire")).toBeTruthy();
  });

  it("offers the shift's end with how long after its start each time falls", async () => {
    const { user } = setup("final");
    await user.click(screen.getByRole("combobox", { name: "Shift End Time" }));
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("5:00 PM +8 hours");
  });

  it("labels its calendar, its hint describing it", () => {
    setup("final");
    const calendar = screen.getByRole("group", { name: "Scheduling calendar", description: DRAG_HINT });
    expect(within(calendar).getByRole("button", { name: "Friday, 5 December, 2025" })).toBeTruthy();
  });

  it("picks dates on the calendar, with undo and redo", async () => {
    const { user, button } = setup("final");
    const friday = button("Friday, 5 December, 2025");
    await user.click(friday);
    await user.click(button("Monday, 8 December, 2025"));
    expect(friday.getAttribute("aria-pressed")).toBe("true");
    await user.click(button("Undo"));
    expect(button("Monday, 8 December, 2025").getAttribute("aria-pressed")).toBe("false");
    await user.click(button("Redo"));
    expect(button("Monday, 8 December, 2025").getAttribute("aria-pressed")).toBe("true");
    // Past days can't take a shift.
    expect(screen.queryByRole("button", { name: "Monday, 1 December, 2025" })).toBeNull();
  });

  it("reviews the shift, then posts it", async () => {
    const { user, button, onPost } = setup("final");
    await planShift(user);
    await user.click(button("Next"));
    await describeShift(user);
    await user.click(button("Next"));
    expect(screen.getByRole("heading", { name: "Review shift summary" })).toBeTruthy();
    expect(screen.getByText("9:00 AM—5:00 PM")).toBeTruthy();
    expect(screen.getByText("Paid Break")).toBeTruthy();
    await user.click(button("Post shift"));
    expect(onPost).toHaveBeenCalledWith({
      template: "forklift",
      title: "Day Shift M/W/F",
      dates: ["2025-12-05", "2025-12-08"],
      start: 540,
      end: 1020,
      workers: 1,
      breakMinutes: 30,
      paidBreak: true,
      reportTo: "Yousuf Hamedani",
      spotFill: true,
    });
  });

  it("goes from the review to the step each section's Edit names", async () => {
    const { user, button } = setup("final");
    await planShift(user);
    await user.click(button("Next"));
    await describeShift(user);
    await user.click(button("Next"));
    await user.click(button("Edit basic information"));
    expect(current(/Shift information/)).toBe("step");
    await user.click(screen.getByRole("button", { name: /Review shift summary/ }));
    await user.click(button("Edit shift plan"));
    expect(current(/Shift planning/)).toBe("step");
  });

  it("goes back a step without losing what's filled in", async () => {
    const { user, button } = setup("final");
    await planShift(user);
    await user.click(button("Next"));
    await user.click(button("Back"));
    expect(button("Friday, 5 December, 2025").getAttribute("aria-pressed")).toBe("true");
  });

  it("cancels", async () => {
    const { user, button, onCancel } = setup("final");
    await user.click(button("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("the recurrence concept", () => {
  it("turns Repeat on with the shift's own weekday until six days after it, as the live form opens", async () => {
    const { user, button } = setup("recurrence");
    await user.click(button("Shift Date"));
    await user.click(button("Wednesday, 3 December, 2025"));
    await user.click(screen.getByRole("switch", { name: "Repeat this shift on other days" }));
    expect(button("Wednesday").getAttribute("aria-pressed")).toBe("true");
    expect(button("Until").textContent).toContain("12/09/2025");
    expect(screen.getByText(/This shift will repeat every/).textContent).toBe(
      "This shift will repeat every Wednesday between Wednesday, 3 December, 2025 and Tuesday, 9 December, 2025",
    );
  });

  it("keeps Next pressable without a shift date, or with Repeat on and no weekday, turning that field Alert", async () => {
    const { user, button } = setup("recurrence");
    await user.click(button("Next"));
    expect(screen.getByRole("button", { name: /Shift planning/ }).getAttribute("aria-current")).toBe("step");
    expect(fieldState("Shift Date")).toBe("alert");
    await user.click(button("Shift Date"));
    await user.click(button("Wednesday, 3 December, 2025"));
    expect(fieldState("Shift Date")).not.toBe("alert");
    await user.click(screen.getByRole("switch", { name: "Repeat this shift on other days" }));
    await user.click(button("Wednesday"));
    await user.click(button("Next"));
    expect(screen.getByRole("button", { name: /Shift planning/ }).getAttribute("aria-current")).toBe("step");
    expect(fieldState("Repeat Every Week On")).toBe("alert");
    await user.click(button("Friday"));
    expect(fieldState("Repeat Every Week On")).not.toBe("alert");
  });

  it("hangs Until's month over the dialog, outside its scrolling body", async () => {
    const { user, dialog, button } = setup("recurrence");
    await user.click(button("Shift Date"));
    await user.click(button("Wednesday, 3 December, 2025"));
    await user.click(screen.getByRole("switch", { name: "Repeat this shift on other days" }));
    await user.click(button("Until"));
    const month = screen.getByRole("dialog", { name: "Until" });
    expect(dialog.contains(month)).toBe(false);
    expect(dialog.parentElement!.contains(month)).toBe(true);
    await user.click(button("Friday, 12 December, 2025"));
    expect(screen.queryByRole("dialog", { name: "Until" })).toBeNull();
    expect(button("Until").textContent).toContain("12/12/2025");
  });

  it("repeats the shift on the picked weekdays until a date, and says so", async () => {
    const { user, button, onPost } = setup("recurrence");
    await user.click(button("Shift Date"));
    await user.click(button("Wednesday, 3 December, 2025"));
    expect(button("Shift Date").textContent).toContain("12/03/2025");

    await user.click(screen.getByRole("switch", { name: "Repeat this shift on other days" }));
    await user.click(button("Monday"));
    await user.click(button("Friday"));
    await user.click(button("Until"));
    await user.click(button("Friday, 19 December, 2025"));
    expect(screen.getByText(/This shift will repeat every/).textContent).toBe(
      "This shift will repeat every Monday, Wednesday, and Friday between Wednesday, 3 December, 2025 and Friday, 19 December, 2025",
    );

    await user.click(button("Next"));
    await describeShift(user);
    await user.click(button("Next"));
    await user.click(button("Post shift"));
    expect(onPost.mock.calls[0][0].dates).toEqual([
      "2025-12-03",
      "2025-12-05",
      "2025-12-08",
      "2025-12-10",
      "2025-12-12",
      "2025-12-15",
      "2025-12-17",
      "2025-12-19",
    ]);
  });
});

describe("the old design", () => {
  it("is one form, its template's defaults locked until Edit", async () => {
    const { user, button, onPost } = setup("old");
    expect(screen.queryByRole("button", { name: /Shift information/ })).toBeNull();
    // Post shift always answers; with nothing filled in it posts nothing and turns what's missing Alert.
    expect(button("Post shift")).toHaveProperty("disabled", false);
    await user.click(button("Post shift"));
    expect(onPost).not.toHaveBeenCalled();
    expect([fieldState("Shift Title"), fieldState("Template")]).toEqual(["alert", "alert"]);
    expect(screen.getByText("Select the days on which you want to post a shift").getAttribute("data-tone")).toBe("alert");
    await describeShift(user);
    expect(screen.getByLabelText("Shift Start Time")).toHaveProperty("disabled", true);
    await user.click(button("Edit"));
    expect(screen.getByLabelText("Shift Start Time")).toHaveProperty("disabled", false);

    await user.click(button("Friday, 5 December, 2025"));
    await user.click(button("Post shift"));
    expect(onPost.mock.calls[0][0]).toMatchObject({ template: "forklift", dates: ["2025-12-05"] });
  });
});

describe("switching versions", () => {
  it("keeps the dialog and carries what's filled in to the next version", async () => {
    const { user, dialog, button, switchTo, onPost } = setup("final");
    await planShift(user);
    await user.click(button("Next"));
    await describeShift(user);
    await user.click(screen.getByRole("button", { name: /Shift planning/ }));

    switchTo("recurrence");
    expect(screen.getByRole("dialog", { name: "New shift" })).toBe(dialog);
    expect(screen.getByRole("button", { name: /Shift planning/ }).getAttribute("aria-current")).toBe("step");
    expect(button("Shift Date").textContent).toContain("12/05/2025");
    expect(screen.getByRole("switch", { name: "Repeat this shift on other days" }).getAttribute("aria-checked")).toBe("true");
    expect(button("Monday").getAttribute("aria-pressed")).toBe("true");
    expect(button("Friday").getAttribute("aria-pressed")).toBe("true");
    expect(button("Until").textContent).toContain("12/08/2025");

    switchTo("old");
    expect(screen.getByRole("dialog", { name: "New shift" })).toBe(dialog);
    expect((screen.getByLabelText("Shift Title") as HTMLInputElement).value).toBe("Day Shift M/W/F");
    expect((screen.getByRole("combobox", { name: "Template" }) as HTMLInputElement).value).toBe("Forklift Operator");
    expect(button("Monday, 8 December, 2025").getAttribute("aria-pressed")).toBe("true");
    await user.click(button("Post shift"));
    expect(onPost.mock.calls[0][0]).toMatchObject({ template: "forklift", dates: ["2025-12-05", "2025-12-08"] });
  });

  it("opens the old design's month on the first date carried over", async () => {
    const { user, button, switchTo } = setup("final");
    await user.click(button("Monday, 5 January, 2026"));
    switchTo("old");
    expect(button("Monday, 5 January, 2026").getAttribute("aria-pressed")).toBe("true");
  });

  it("carries a repeat over as the dates it makes", async () => {
    const { user, button, switchTo } = setup("recurrence");
    await user.click(button("Shift Date"));
    await user.click(button("Wednesday, 3 December, 2025"));
    await user.click(screen.getByRole("switch", { name: "Repeat this shift on other days" }));
    await user.click(button("Friday"));
    await user.click(button("Until"));
    await user.click(button("Friday, 12 December, 2025"));

    switchTo("final");
    const pressed = (name: string) => button(name).getAttribute("aria-pressed");
    expect(pressed("Wednesday, 3 December, 2025")).toBe("true");
    expect(pressed("Friday, 5 December, 2025")).toBe("true");
    expect(pressed("Friday, 12 December, 2025")).toBe("true");
    expect(pressed("Wednesday, 10 December, 2025")).toBe("true");
    expect(pressed("Monday, 8 December, 2025")).toBe("false");
  });
});

describe("WeekDaySelect", () => {
  function Week({ disabled }: { disabled?: boolean }) {
    const [days, setDays] = useState([5, 1]);
    return (
      <>
        <Field disabled={disabled}>
          <Field.Label>Repeat Every Week On</Field.Label>
          <WeekDaySelect value={days} onChange={setDays}>
            <WeekDaySelect.Day value={1} aria-label="Monday">
              M
            </WeekDaySelect.Day>
            <WeekDaySelect.Day value={2} aria-label="Tuesday" tone="warning">
              T
            </WeekDaySelect.Day>
            <WeekDaySelect.Day value={5} aria-label="Friday">
              F
            </WeekDaySelect.Day>
          </WeekDaySelect>
          <Field.HintText>Repetition can’t be updated</Field.HintText>
        </Field>
        <output>{days.join(",")}</output>
      </>
    );
  }

  it("presses the days it holds, under its label, and adds or drops a day pressed, in the week's order", async () => {
    const user = userEvent.setup();
    render(<Week />);
    const group = screen.getByRole("group", { name: "Repeat Every Week On" });
    expect(within(group).getAllByRole("button").map((day) => day.getAttribute("aria-pressed"))).toEqual(["true", "false", "true"]);
    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    expect(screen.getByRole("status").textContent).toBe("1,2,5");
    await user.click(screen.getByRole("button", { name: "Monday" }));
    expect(screen.getByRole("status").textContent).toBe("2,5");
  });

  it("holds its own days when not given them, from its default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WeekDaySelect defaultValue={[1]} onChange={onChange}>
        <WeekDaySelect.Day value={1}>M</WeekDaySelect.Day>
        <WeekDaySelect.Day value={2}>T</WeekDaySelect.Day>
      </WeekDaySelect>,
    );
    const days = () => screen.getAllByRole("button").map((day) => day.getAttribute("aria-pressed"));
    expect(days()).toEqual(["true", "false"]);
    await user.click(screen.getByRole("button", { name: "T" }));
    expect(days()).toEqual(["true", "true"]);
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it("gives a day its warning, disables every day with itself, and hints under them", () => {
    render(<Week disabled />);
    expect(screen.getByRole("button", { name: "Tuesday" }).dataset.tone).toBe("warning");
    expect(screen.getAllByRole<HTMLButtonElement>("button").every((day) => day.disabled)).toBe(true);
    expect(screen.getByText("Repetition can’t be updated")).toBeTruthy();
  });
});

describe("FormNav", () => {
  it("numbers each step, marks the one in progress and those reached, and an alert, and shuts those pending", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <FormNav>
        <FormNav.Step state="complete">
          <Typography variant="metadata">Step 1</Typography>
          <Typography variant="subheading">Shift Details</Typography>
        </FormNav.Step>
        <FormNav.Step state="in progress" onClick={onClick}>
          <Typography variant="metadata">Step 2</Typography>
          <Typography variant="subheading">Planning</Typography>
        </FormNav.Step>
        <FormNav.Step state="alert">
          <Typography variant="metadata">Step 3</Typography>
          <Typography variant="subheading">Review</Typography>
        </FormNav.Step>
        <FormNav.Step>
          <Typography variant="metadata">Step 4</Typography>
          <Typography variant="subheading">Post</Typography>
        </FormNav.Step>
      </FormNav>,
    );
    const [complete, current, alert, pending] = screen.getAllByRole<HTMLButtonElement>("button");
    expect(complete.textContent).toBe("Step 1Shift Details");
    expect(complete.hasAttribute("data-reached")).toBe(true);
    expect(complete.hasAttribute("aria-current")).toBe(false);
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(current.hasAttribute("data-reached")).toBe(true);
    expect(alert.dataset.tone).toBe("alert");
    expect(pending.hasAttribute("data-reached")).toBe(false);
    expect(pending.disabled).toBe(true);
    expect([complete, current, alert].some((step) => step.disabled)).toBe(false);
    await user.click(current);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("AddressLocation", () => {
  it("lays the address over its unit and instructions, what it's given under them, and its aside under the map", () => {
    render(
      <AddressLocation>
        <Typography variant="body">250 First Gulf Boulevard, Brampton, ON</Typography>
        <Typography variant="body">Unit 308</Typography>
        <Typography tag="p" variant="metadata">Take the 502 Southbound</Typography>
        <span>Hourly Wage</span>
        <AddressLocation.Aside>
          <span>Tags</span>
        </AddressLocation.Aside>
      </AddressLocation>,
    );
    const [address, map] = [...screen.getByText("250 First Gulf Boulevard, Brampton, ON").closest("div")!.parentElement!.parentElement!.children];
    // The body lines go together, over the rest.
    expect([...address.children].map((child) => child.textContent)).toEqual([
      "250 First Gulf Boulevard, Brampton, ONUnit 308",
      "Take the 502 Southbound",
      "Hourly Wage",
    ]);
    expect(map.textContent).toBe("Tags");
    expect(map.querySelector("img")).toBeTruthy();
  });
});

describe("TemplateCard", () => {
  it("draws its template's geofence on its map", () => {
    const fence = [
      { lat: 43.6756, lng: -79.7151 },
      { lat: 43.6757, lng: -79.7135 },
      { lat: 43.6744, lng: -79.7134 },
      { lat: 43.6743, lng: -79.715 },
    ];
    const { container } = render(<TemplateCard template={{ ...TEMPLATES[0], geofence: fence }} />);
    const map = container.querySelector("[data-map]")!;
    expect(map.querySelector("polygon")!.getAttribute("points")!.split(" ")).toHaveLength(4);
  });

  it("stands its pin at its template's entrance", () => {
    const fence = [
      { lat: 43.6756, lng: -79.7151 },
      { lat: 43.6757, lng: -79.7135 },
      { lat: 43.6744, lng: -79.7134 },
      { lat: 43.6743, lng: -79.715 },
    ];
    const { container } = render(<TemplateCard template={{ ...TEMPLATES[0], geofence: fence, entrance: fence[2] }} />);
    const [x, y] = container.querySelector("polygon")!.getAttribute("points")!.split(" ")[2].split(",").map(Number);
    const pin = container.querySelector<SVGElement>("[data-pin]")!;
    // The small pin's tip, from its top left.
    expect(parseFloat(pin.style.left) + 10).toBeCloseTo(x, 6);
    expect(parseFloat(pin.style.top) + 17.87).toBeCloseTo(y, 6);
  });

  it("shows its template's first two tags under the map, then how many more, its tooltip listing them", () => {
    const { tags } = TEMPLATES[0];
    render(<TemplateCard template={TEMPLATES[0]} />);
    expect(screen.queryByText("Department")).toBeNull();
    const chips = screen.getByRole("group", { name: "Tags" });
    expect([...chips.children].map((chip) => chip.firstChild!.textContent)).toEqual([...tags.slice(0, 2), `+${tags.length - 2}`]);
    expect([...chips.lastElementChild!.querySelectorAll("[data-lines] > span")].map((line) => line.textContent)).toEqual(tags.slice(2));
  });

  it("keeps Figma's picture where its template has no address", () => {
    const { container } = render(<TemplateCard template={{ ...TEMPLATES[0], place: null, geofence: null }} />);
    expect(container.querySelector("[data-map]")).toBeNull();
    expect(container.querySelector("img")).toBeTruthy();
  });
});
