import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPLICANT_SELECTOR,
  BILLABLE_DURATION_CARD,
  CONFIRMATION_DIALOG,
  LABEL_VALUE_PAIR,
  METADATA,
  NOTES_AND_HISTORY,
  OVERLAY_STORIES,
  PROFILE_OVERVIEW_CARD,
  WORKER_HOURS_DIALOG,
} from "../ds-overlay";
import { renderStories } from "./story-harness";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// The Overlay page's own, then those listed under Card, Data Table and Actions.
const STORIES = [
  ...OVERLAY_STORIES,
  METADATA,
  APPLICANT_SELECTOR,
  LABEL_VALUE_PAIR,
  NOTES_AND_HISTORY,
  PROFILE_OVERVIEW_CARD,
  WORKER_HOURS_DIALOG,
  BILLABLE_DURATION_CARD,
];

/** Lets `Presence` drop what has closed. */
const settle = () => act(async () => {});

describe("the Overlay page's examples", () => {
  it("shows Figma's Overlay components in the order Figma lays them out, each by its properties", () => {
    const { titles } = renderStories(STORIES);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Overlay Header",
      "Action Bar",
      "Manual Check-in",
      "Notes",
      "Mark Absent",
      "Side Sheet",
      "Metadata",
      "Applicant Selector",
      "Label-value Pair",
      "Notes & History",
      "Profile Overview Card",
      "Worker Hours Dialog",
      "Billable Duration Card",
    ]);
    expect(titles("Overlay Header")).toEqual(["Subheading", "Sheet actions"]);
    expect(titles("Action Bar")).toEqual(["Change summary"]);
    expect(titles("Label-value Pair")).toEqual(["Tags"]);
    for (const id of ["Metadata", "Manual Check-in", "Profile Overview Card"]) {
      expect(titles(id), id).toEqual([]);
    }
    expect(titles("Notes & History")).toEqual(["State", "Context"]);
    expect(titles("Billable Duration Card")).toEqual([
      "Posted Hours",
      "Checked In/Out",
      "Auto-checked Out",
      "Worker Submitted",
      "Adjusted Hours",
      "Absent",
    ]);
    expect(titles("Applicant Selector")).toEqual(["State", "Is selected"]);
    for (const id of ["Notes", "Mark Absent", "Worker Hours Dialog"]) expect(titles(id)).toEqual([]);
    expect(titles("Side Sheet")).toEqual(["Size"]);
    expect(document.body.textContent).not.toMatch(/spotter/i);
  });

  it("draws the header as the app's overlays do: a title, a subheading, and a sheet's action", () => {
    const { preview } = renderStories(STORIES);
    expect(within(preview("Overlay Header", "Subheading")).getByText("Forklift Operator • Day Shift M/W/F")).toBeTruthy();
    const sheet = within(preview("Overlay Header", "Sheet actions"));
    expect(sheet.getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Edit schedule...",
      "Close",
    ]);
  });

  it("pairs a template's tags with their label: the first two, then how many more", () => {
    const { preview } = renderStories(STORIES);
    const pair = preview("Label-value Pair", "Tags");
    expect(pair.textContent).toMatch(/^Tags/);
    const chips = within(pair).getByRole("group", { name: "Tags" });
    expect([...chips.children].map((chip) => chip.firstChild!.textContent)).toEqual(["Licensed", "Warehouse", "+2"]);
  });

  it("reads the profile card's worker from the store", () => {
    const { code } = renderStories(STORIES);
    const card = code("Profile Overview Card");
    expect(card).not.toContain("@/assets");
    expect(card).toMatch(
      /<ProfileCard.Header>\n\s+<Avatar src=\{worker.face\} \/>\n\s+<Typography variant="heading">\{worker.name\}<\/Typography>/,
    );
    expect(card).toContain('tier={worker.profile.tier.toLowerCase()}');
  });

  it("writes an overlay as Overlay and its parts", () => {
    const { code } = renderStories(STORIES);
    expect(code("Notes")).toBe(
      [
        'import { Button } from "@/components/ui/button"',
        'import { Divider } from "@/components/ui/divider"',
        'import { Field } from "@/components/ui/field"',
        'import { Link } from "@/components/ui/link"',
        'import { Metadata } from "@/components/ui/metadata"',
        'import { Overlay } from "@/components/ui/overlay"',
        'import { TextArea } from "@/components/ui/text-area"',
        'import { Typography } from "@/components/ui/typography"',
        "",
        "export function NotesDemo() {",
        "  return (",
        '    <Overlay label="Notes" inline>',
        "      <Overlay.Header>",
        '        <Typography variant="heading">Notes</Typography>',
        "        <Overlay.Close />",
        "      </Overlay.Header>",
        "      <div",
        '        className="flex flex-col gap-(--sw-gap-md) px-(--sw-padding-xl) py-(--sw-padding-md)"',
        "      >",
        "        <Metadata unread>",
        '          <Typography tag="p" variant="body">',
        "            Worker texted that he's on his way.",
        "          </Typography>",
        '          <Typography tag="div" variant="metadata" color="subdued">',
        "            By",
        "            <Link>Michael M.</Link>",
        "            • Sep 24, 2023, 9:40 AM",
        "          </Typography>",
        "        </Metadata>",
        "        <Metadata>",
        '          <Typography tag="p" variant="body">',
        "            Tried contacting on cell. No response. Will retry in 15.",
        "          </Typography>",
        '          <Typography tag="div" variant="metadata" color="subdued">',
        "            By",
        "            <Link>Michael M.</Link>",
        "            • Sep 24, 2023, 9:15 AM",
        "          </Typography>",
        "        </Metadata>",
        "      </div>",
        "      <Divider />",
        "      <Overlay.Body>",
        "        <Field>",
        "          <Field.Label>Notes</Field.Label>",
        "          <TextArea />",
        "        </Field>",
        "      </Overlay.Body>",
        "      <Overlay.ActionBar>",
        "        <Overlay.Cancel />",
        "        <Overlay.ForwardActions>",
        "          <Button>Add note</Button>",
        "        </Overlay.ForwardActions>",
        "      </Overlay.ActionBar>",
        "    </Overlay>",
        "  )",
        "}",
      ].join("\n"),
    );
  });
});

describe("the Confirmation Dialog listed under Actions", () => {
  const DIALOGS = [CONFIRMATION_DIALOG];

  it("asks before a repeating shift is changed, each confirmation an example, in Figma's words", () => {
    const { preview, titles } = renderStories(DIALOGS);
    expect(titles("Confirmation Dialog")).toEqual(["Delete repeating shift", "Delete series of shifts"]);
    const dialog = (title?: string) => within(preview("Confirmation Dialog", title));
    expect(dialog().getByRole("dialog", { name: "Editing repeating shift" })).toBeTruthy();
    expect(dialog("Delete repeating shift").getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(dialog("Delete series of shifts").getByRole("button", { name: "Delete all shifts" })).toBeTruthy();
  });

  it("draws each as a Dialog with no Close, only its Cancel", () => {
    const { preview, code } = renderStories(DIALOGS);
    for (const title of [undefined, "Delete repeating shift", "Delete series of shifts"]) {
      const dialog = within(preview("Confirmation Dialog", title)).getByRole("dialog");
      expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    }
    expect(code("Confirmation Dialog")).toContain('<Dialog label="Editing repeating shift" inline>');
    expect(code("Confirmation Dialog")).not.toContain("Overlay");
  });

  it("picks one of a repeating shift's reaches at a time", async () => {
    const { user, preview } = renderStories(DIALOGS);
    const edit = within(preview("Confirmation Dialog"));
    const checked = () => edit.getAllByRole("radio").map((radio) => radio.getAttribute("aria-checked"));
    expect(checked()).toEqual(["true", "false"]);
    await user.click(edit.getByRole("radio", { name: "All 30 upcoming shifts" }));
    expect(checked()).toEqual(["false", "true"]);
  });
});

describe("the Overlay page's examples, at work", () => {
  it("opens Notes & History's notes from its link", async () => {
    const { user, preview } = renderStories(STORIES);
    const notes = preview("Notes & History");
    const by = /^(Mariana Gonzalez|William Denver|Daniella Patrick)$/;
    expect(within(notes).queryAllByRole("button", { name: by })).toHaveLength(0);
    await user.click(within(notes).getByRole("button", { name: "Notes & History" }));
    expect(within(notes).getAllByRole("button", { name: by })).toHaveLength(3);
  });

  it("writes Notes & History as its Link and its Metadata, with no Divider of its own", () => {
    const { code } = renderStories(STORIES);
    const notes = code("Notes & History");
    expect(notes).not.toContain("Divider");
    expect(notes).toContain("<Link>");
    expect(notes).toContain('<Typography tag="div" variant="metadata" color="subdued">');
  });

  it("closes Manual Check-in from its Cancel, and opens and closes it from the button under it", async () => {
    const { preview } = renderStories(STORIES);
    const checkIn = preview("Manual Check-in");
    const trigger = within(checkIn).getByRole("button", { name: "Check in...", expanded: true });
    fireEvent.click(within(within(checkIn).getByRole("dialog", { name: "Check in" })).getByRole("button", { name: "Cancel" }));
    await settle();
    expect(within(checkIn).queryByRole("dialog")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(within(checkIn).getByRole("dialog", { name: "Check in" })).toBeTruthy();
    fireEvent.click(trigger);
    await settle();
    expect(within(checkIn).queryByRole("dialog")).toBeNull();
  });

  it("marks Notes' unread note", () => {
    const { preview } = renderStories(STORIES);
    expect(within(preview("Notes")).getAllByRole("img", { name: "Unread" })).toHaveLength(1);
  });

  it("draws each side sheet's size: the dashboard's worker, and a shift's as wide as the 1216 frame", () => {
    const { preview, code } = renderStories(STORIES);
    const sheets = within(preview("Side Sheet", "Size")).getAllByRole("dialog");
    expect(sheets.map((sheet) => sheet.dataset.size)).toEqual(["small", "large"]);
    expect(code("Side Sheet", "Size")).toContain('<SideSheet size="large" label={template.name} inline>');
  });

  it("holds the note typed in Notes", async () => {
    const { user, preview } = renderStories(STORIES);
    const field = within(preview("Notes")).getByRole("textbox", { name: "Notes" });
    await user.type(field, "Called again.");
    expect((field as HTMLTextAreaElement).value).toBe("Called again.");
  });

  it("opens each overlay from an action ending in an ellipsis, Mark Absent's and the deletions' destructive", () => {
    const { preview } = renderStories([...STORIES, CONFIRMATION_DIALOG]);
    const trigger = (id: string, title?: string) => within(preview(id, title)).getAllByRole("button", { expanded: true }).at(-1)!;
    expect(["Manual Check-in", "Notes", "Mark Absent"].map((id) => trigger(id).textContent)).toEqual([
      "Check in...",
      "Notes...",
      "Mark absent...",
    ]);
    expect(trigger("Mark Absent").dataset.tone).toBe("destructive");
    expect(trigger("Confirmation Dialog", "Delete series of shifts").dataset.tone).toBe("destructive");
  });

  it("ticks Mark Absent's Block this worker by itself", async () => {
    const { user, preview } = renderStories(STORIES);
    const block = within(preview("Mark Absent")).getByRole("checkbox", { name: /Block this worker/ });
    expect(block.getAttribute("aria-checked")).toBe("false");
    await user.click(block);
    expect(block.getAttribute("aria-checked")).toBe("true");
  });

  it("folds Worker Hours Dialog's note away", async () => {
    const { user, preview } = renderStories(STORIES);
    const hours = preview("Worker Hours Dialog");
    expect(within(hours).getAllByRole("button", { name: "Shonda Williams" })).toHaveLength(1);
    await user.click(within(hours).getByRole("button", { name: "1 note" }));
    expect(within(hours).queryAllByRole("button", { name: "Shonda Williams" })).toHaveLength(0);
  });

  it("selects a deselected Billable Duration Card by a press", async () => {
    const { user, preview } = renderStories(STORIES);
    const [selected, deselected] = within(preview("Billable Duration Card", "Posted Hours")).getAllByRole("radio");
    expect([selected, deselected].map((card) => card.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    await user.click(deselected);
    expect(deselected.getAttribute("aria-checked")).toBe("true");
  });

  it("shows the Applicant Selector as the Shift planner draws a worker's day, a cell in a row of its own", () => {
    const { preview } = renderStories(STORIES);
    const days = [...preview("Applicant Selector", "State").querySelectorAll<HTMLElement>("[data-cell] [role=row] > [role=cell]")];
    expect(days.map((day) => day.textContent)).toEqual(["", "Offered", "Waitlisted", "Booked", "Cancelled", "Booked"]);
    expect(days.at(-1)!.hasAttribute("data-past")).toBe(true);
    const picked = [...preview("Applicant Selector", "Is selected").querySelectorAll("[data-cell] [role=row] > [role=cell]")];
    expect(picked.map((day) => day.hasAttribute("data-selected"))).toEqual([false, true]);
  });
});
