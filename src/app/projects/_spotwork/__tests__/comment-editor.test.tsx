import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR } from "../copy";
import { CommentEditor, EditCommentsToggle } from "../comment-editor";
import { TourProvider } from "../tour";

// The editor is the author's, run in development.
beforeEach(() => vi.stubEnv("NODE_ENV", "development"));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllEnvs();
});

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

function Harness() {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root}>
      <TourProvider root={root}>
        <div data-check-ins-app="">
          <div data-worker="Maria Franci">
            <button type="button" data-tour="open-check-in">
              Check In…
            </button>
            <span>Absent</span>
          </div>
          <button type="button" data-tour="excuse-late">
            Excuse late check-in
          </button>
        </div>
        <EditCommentsToggle />
        <CommentEditor />
      </TourProvider>
    </div>
  );
}

async function setup() {
  const user = userEvent.setup();
  render(<Harness />);
  await wait(50);
  await user.click(screen.getByRole("button", { name: "Edit comments" }));
  const pinNamed = (start: string) => screen.queryByRole("button", { name: (name) => name.startsWith(`Kartik Iyer ${start}`) });
  const field = (index: number) => screen.getByRole("textbox", { name: `${index + 1}. ${TOUR.steps[index].title}` });
  return { user, pinNamed, field };
}

describe("the comment editor", () => {
  it("edits a comment's text, and the comment on the page says it", async () => {
    const { user, pinNamed, field } = await setup();
    await user.clear(field(0));
    await user.type(field(0), "Check her in here.");
    expect(pinNamed("Check her in here.")).toBeTruthy();
  });

  it("turns each return into its own paragraph, blank lines and all", async () => {
    const { user, field } = await setup();
    await user.clear(field(0));
    await user.type(field(0), "First paragraph.{Enter}Second paragraph.{Enter}{Enter}Third.");
    const note = screen.getAllByRole("note")[0];
    expect([...note.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "First paragraph.",
      "Second paragraph.",
      "Third.",
    ]);
  });

  it("deletes a comment, showing the next one, and restores it", async () => {
    const { user, pinNamed } = await setup();
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(pinNamed("Sometimes, technical limitations")).toBeNull();
    expect(pinNamed("Beyond checking a worker in or out")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(pinNamed("Sometimes, technical limitations")).toBeTruthy();
  });

  it("copies only what changed, with the old text beside the new", async () => {
    const { user, field } = await setup();
    await user.clear(field(0));
    await user.type(field(0), "Check her in here.");
    await user.click(screen.getByRole("button", { name: "Copy values" }));
    const copied = JSON.parse(await navigator.clipboard.readText());
    expect(copied.comments).toEqual([
      expect.objectContaining({ step: "open-check-in", was: TOUR.steps[0].body, now: "Check her in here." }),
    ]);
    expect(copied.added).toEqual([]);
  });

  it("pastes copied values back", async () => {
    const { user, pinNamed } = await setup();
    await navigator.clipboard.writeText(
      JSON.stringify({ comments: [{ step: "open-check-in", now: "Pasted text." }], added: [] }),
    );
    await user.click(screen.getByRole("button", { name: "Paste values" }));
    // The clipboard reads back asynchronously.
    await waitFor(() => expect(pinNamed("Pasted text.")).toBeTruthy());
  });

  it("resets every edit", async () => {
    const { user, pinNamed } = await setup();
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(pinNamed("Sometimes, technical limitations")).toBeTruthy();
  });

  it("adds a comment where the app is clicked next, without the click reaching the app", async () => {
    const { user, pinNamed } = await setup();
    let reached = false;
    screen.getByText("Absent").addEventListener("click", () => (reached = true));
    await user.click(screen.getByRole("button", { name: "Add comment" }));
    await user.click(screen.getByText("Absent"));
    expect(reached).toBe(false);
    const added = screen.getByRole("textbox", { name: /^Added comment/ });
    expect(screen.getByText(/Points at span “Absent” in Maria Franci's row/)).toBeTruthy();
    await user.type(added, "A new note.");
    await wait(50);
    expect(pinNamed("A new note.")).toBeTruthy();
  });

  it("keeps the edits after a reload", async () => {
    const { user, field } = await setup();
    await user.clear(field(0));
    await user.type(field(0), "Kept.");
    cleanup();
    render(<Harness />);
    await wait(50);
    expect(screen.getByRole("button", { name: (name) => name.startsWith("Kartik Iyer Kept.") })).toBeTruthy();
  });
});
