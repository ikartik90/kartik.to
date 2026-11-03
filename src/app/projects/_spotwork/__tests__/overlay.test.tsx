import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsxOf } from "../ds-code";
import { Dropdown } from "../dropdown";
import { TypeAhead } from "../search";
import { TagsField } from "../tags-field";
import { TimePicker } from "../time-picker";
import { Button, Chip, Dialog, Field, LabelValuePair, Overlay, SideSheet, Typography, glyph } from "../ui";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Overlay", () => {
  it("is a dialog named by its label, its header's Close and its action bar's Cancel closing it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Overlay label="Add a note" onClose={onClose} inline>
        <Overlay.Header>
          <Typography variant="heading">Add a note</Typography>
          <Overlay.Close />
        </Overlay.Header>
        <Overlay.Body>Body</Overlay.Body>
        <Overlay.ActionBar>
          <Overlay.Cancel />
          <Overlay.ForwardActions>
            <Button>Add note</Button>
          </Overlay.ForwardActions>
        </Overlay.ActionBar>
      </Overlay>,
    );
    const dialog = screen.getByRole("dialog", { name: "Add a note" });
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on the Escape its layer is sent", () => {
    const onClose = vi.fn();
    render(
      <Overlay label="View location" onClose={onClose} inline>
        <Overlay.Header>
          <Typography variant="heading">View location</Typography>
        </Overlay.Header>
      </Overlay>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("escape-layer"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes itself without an onClose", async () => {
    render(
      <Overlay label="Notes" inline>
        <Overlay.Header>
          <Typography variant="heading">Notes</Typography>
        </Overlay.Header>
        <Overlay.ActionBar>
          <Overlay.Cancel />
        </Overlay.ActionBar>
      </Overlay>,
    );
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets a header and a Cancel close something of their own", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <Overlay.Header>
          <Typography variant="heading">Worker</Typography>
          <Overlay.Close onClick={onClose} />
        </Overlay.Header>
        <Overlay.ActionBar>
          <Overlay.Cancel onClick={onCancel}>Close</Overlay.Cancel>
        </Overlay.ActionBar>
      </>,
    );
    const [close, cancel] = screen.getAllByRole("button", { name: "Close" });
    await user.click(close);
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("SideSheet", () => {
  const page = (sheet: ReactNode) => (
    <div data-check-ins-app="">
      <button type="button">Behind</button>
      <div>{sheet}</div>
    </div>
  );

  it("is modal when large: the app walled off under a scrim, a press on it closing the sheet unless it holds", () => {
    const onClose = vi.fn();
    const { rerender } = render(page(<SideSheet size="large" label="General Labour" onClose={onClose} style={{ height: 600 }} />));
    expect(screen.getByRole("dialog", { name: "General Labour" }).getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Behind").closest("[inert]")).not.toBeNull();
    fireEvent.pointerDown(document.querySelector("[data-scrim]")!);
    expect(onClose).toHaveBeenCalledOnce();
    rerender(page(<SideSheet size="large" label="General Labour" onClose={onClose} style={{ height: 600 }} holds />));
    fireEvent.pointerDown(document.querySelector("[data-scrim]")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("leaves the app open beside it when small, or drawn inline", () => {
    render(
      page(
        <>
          <SideSheet label="Maria Franci" />
          <SideSheet size="large" label="Forklift Operator" inline />
        </>,
      ),
    );
    for (const name of ["Maria Franci", "Forklift Operator"])
      expect(screen.getByRole("dialog", { name }).hasAttribute("aria-modal"), name).toBe(false);
    expect(document.querySelector("[data-scrim]")).toBeNull();
    expect(screen.getByText("Behind").closest("[inert]")).toBeNull();
  });

  const glimpse = (
    <div>
      <Typography variant="body">Forklift</Typography>
    </div>
  );

  describe("where it can watch its way in", () => {
    beforeEach(() => {
      Element.prototype.getAnimations = () => [];
    });
    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    });

    it("holds itself and its scrim back until drawn, so its way in plays in full, unless drawn inline", async () => {
      render(
        page(
          <>
            <SideSheet size="large" label="General Labour" style={{ height: 600 }} />
            <SideSheet label="Maria Franci" inline />
          </>,
        ),
      );
      const held = () =>
        [screen.getByRole("dialog", { name: "General Labour" }), document.querySelector("[data-scrim]")!].map((node) =>
          node.hasAttribute("data-entering"),
        );
      expect(held()).toEqual([true, true]);
      expect(screen.getByRole("dialog", { name: "Maria Franci" }).hasAttribute("data-entering")).toBe(false);
      await waitFor(() => expect(held()).toEqual([false, false]));
    });

    it("builds what it defers once it's in, its fallback loading under its header till then", async () => {
      render(
        page(
          <SideSheet size="large" label="General Labour" style={{ height: 600 }}>
            <SideSheet.Header>
              <Typography variant="heading">General Labour</Typography>
              <SideSheet.Close />
            </SideSheet.Header>
            <SideSheet.Deferred fallback={glimpse}>
              <Typography variant="body">Forklift certified</Typography>
            </SideSheet.Deferred>
          </SideSheet>,
        ),
      );
      const sheet = screen.getByRole("dialog", { name: "General Labour" });
      expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
      expect(within(sheet).queryByText("Forklift certified")).toBeNull();
      const loading = within(sheet).getByText("Forklift").closest("[aria-busy=true]");
      expect(loading?.hasAttribute("inert")).toBe(true);
      await waitFor(() => expect(within(sheet).getByText("Forklift certified")).toBeTruthy());
      expect(within(sheet).queryByText("Forklift")).toBeNull();
      expect(sheet.querySelector("[aria-busy]")).toBeNull();
    });

    it("builds it at once when drawn inline", () => {
      render(
        <SideSheet size="large" label="General Labour" inline>
          <SideSheet.Deferred fallback={glimpse}>
            <Typography variant="body">Forklift certified</Typography>
          </SideSheet.Deferred>
        </SideSheet>,
      );
      expect(screen.getByText("Forklift certified")).toBeTruthy();
    });
  });

  it("builds what it defers at once where it can't watch its way in", () => {
    render(
      page(
        <SideSheet size="large" label="General Labour" style={{ height: 600 }}>
          <SideSheet.Deferred fallback={glimpse}>
            <Typography variant="body">Forklift certified</Typography>
          </SideSheet.Deferred>
        </SideSheet>,
      ),
    );
    expect(screen.getByRole("dialog", { name: "General Labour" }).hasAttribute("data-entering")).toBe(false);
    expect(screen.getByText("Forklift certified")).toBeTruthy();
  });
});

describe("Overlay, given the app's height", () => {
  it("covers the app, a press on its scrim closing it unless it holds", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Overlay label="Send message" onClose={onClose} height={600}>
        <Overlay.Header>
          <Typography variant="heading">Send message</Typography>
        </Overlay.Header>
      </Overlay>,
    );
    const dialog = screen.getByRole("dialog", { name: "Send message" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Marked as a scrim whatever its shade.
    expect(dialog.parentElement!.hasAttribute("data-scrim")).toBe(true);
    fireEvent.pointerDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
    rerender(
      <Overlay label="Send message" onClose={onClose} height={600} holds>
        <Overlay.Header>
          <Typography variant="heading">Send message</Typography>
        </Overlay.Header>
      </Overlay>,
    );
    fireEvent.pointerDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Safari's Tab skips buttons, so from its last field it lands past the overlay, on what's around the app.
  it("brings back a Tab that leaves the app to its first item, or a Shift-Tab to its last, but not a press outside", async () => {
    render(
      <>
        <div data-check-ins-app="">
          <Overlay label="New team" onClose={() => {}} height={600}>
            <Overlay.Header>
              <Typography variant="heading">New team</Typography>
              <Overlay.Close />
            </Overlay.Header>
            <Overlay.Body>
              <input aria-label="Team Name" />
            </Overlay.Body>
            <Overlay.ActionBar>
              <Overlay.Cancel />
              <Overlay.ForwardActions>
                <Button>Add team</Button>
              </Overlay.ForwardActions>
            </Overlay.ActionBar>
          </Overlay>
        </div>
        <button tabIndex={0}>Design system</button>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "New team" });
    const name = within(dialog).getByRole("textbox", { name: "Team Name" });
    const outside = screen.getByRole("button", { name: "Design system" });
    const tabOut = (shiftKey: boolean) => {
      name.focus();
      fireEvent.keyDown(name, { key: "Tab", shiftKey });
      outside.focus();
    };
    tabOut(false);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    tabOut(true);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Add team" }));

    // A Tab that goes nowhere, to the browser's own bar, leaves the next press alone.
    fireEvent.keyDown(name, { key: "Tab" });
    await new Promise((done) => setTimeout(done));
    outside.focus();
    expect(document.activeElement).toBe(outside);
  });
});

describe("Overlay, given the app's height, and the form controls in it", () => {
  it("hangs each control's popover from its scrim, over the dialog, and takes a pick from there", async () => {
    const user = userEvent.setup();
    render(
      <Overlay label="Post a Shift" onClose={vi.fn()} height={600}>
        <Overlay.Body>
          <Field>
            <Field.Label>Size</Field.Label>
            <Dropdown defaultValue="small">
              <Dropdown.Item value="small"><Typography variant="bodyLarge">Small</Typography></Dropdown.Item>
              <Dropdown.Item value="large"><Typography variant="bodyLarge">Large</Typography></Dropdown.Item>
            </Dropdown>
          </Field>
          <Field>
            <Field.Label>Worker</Field.Label>
            <TypeAhead>
              <TypeAhead.Item value="anna"><Typography variant="bodyLarge">Anna</Typography></TypeAhead.Item>
              <TypeAhead.Item value="omar"><Typography variant="bodyLarge">Omar</Typography></TypeAhead.Item>
            </TypeAhead>
          </Field>
          <Field>
            <Field.Label>Tags</Field.Label>
            <TagsField options={["Licensed", "Warehouse"]} />
          </Field>
          <Field>
            <Field.Label>Start</Field.Label>
            <TimePicker defaultValue={9 * 60} />
          </Field>
        </Overlay.Body>
      </Overlay>,
    );
    const dialog = screen.getByRole("dialog", { name: "Post a Shift" });
    const hung = (popover: HTMLElement) => !dialog.contains(popover) && dialog.parentElement!.contains(popover);

    await user.click(screen.getByRole("button", { name: /Size/ }));
    expect(hung(screen.getByRole("listbox", { name: "Size" }))).toBe(true);
    await user.click(screen.getByRole("option", { name: "Large" }));
    expect(screen.getByRole("button", { name: /Size/ }).textContent).toContain("Large");

    await user.type(screen.getByRole("combobox", { name: "Worker" }), "an");
    expect(hung(screen.getByRole("listbox", { name: "Worker" }))).toBe(true);
    await user.click(screen.getByRole("option", { name: "Anna" }));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Worker" }).value).toBe("Anna");

    await user.click(screen.getByRole("combobox", { name: "Tags" }));
    expect(hung(screen.getByRole("listbox", { name: "Tags" }))).toBe(true);
    await user.click(screen.getByRole("option", { name: "Licensed" }));
    expect(screen.getByRole("button", { name: "Remove Licensed" })).toBeDefined();

    await user.click(screen.getByRole("combobox", { name: "Start" }));
    expect(hung(screen.getByRole("listbox", { name: "Start" }))).toBe(true);
    await user.click(screen.getByRole("option", { name: "10:00 AM" }));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Start" }).value).toBe("10:00 AM");
  });
});

describe("the overlays' and dialogs' widths", () => {
  it("are Overlay/Small for an overlay, modal or hung, and Dialog for a dialog, modal or inline", () => {
    const width = (name: string) => screen.getByRole("dialog", { name }).className.match(/\bw_var\(([^)]+)\)/)?.[1];
    render(
      <>
        <Overlay label="Send message" onClose={() => {}} height={600}>
          <Overlay.Body />
        </Overlay>
        <Overlay label="Add a note" inline>
          <Overlay.Body />
        </Overlay>
        <Dialog label="Deleting repeating shift" onClose={() => {}} height={600}>
          <Dialog.Body />
        </Dialog>
        <Dialog label="Editing repeating shift" inline>
          <Dialog.Body />
        </Dialog>
      </>,
    );
    expect(width("Send message")).toBe("--sw-width-overlay-small");
    expect(width("Add a note")).toBe("--sw-width-overlay-small");
    expect(width("Deleting repeating shift")).toBe("--sw-width-dialog");
    expect(width("Editing repeating shift")).toBe("--sw-width-dialog");
  });
});

describe("Dialog", () => {
  it("draws a Close only where one is placed, as a confirmation leaves it out", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog label="Deleting repeating shift" onClose={onClose} inline>
        <Dialog.Header>
          <Typography variant="heading">Deleting repeating shift</Typography>
        </Dialog.Header>
        <Dialog.ActionBar>
          <Dialog.Cancel />
        </Dialog.ActionBar>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Deleting repeating shift" });
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("names its parts after itself, as a side sheet and an overlay name theirs", () => {
    expect(Dialog.displayName).toBe("Dialog");
    expect(Dialog.Header.displayName).toBe("Dialog.Header");
    expect(Dialog.Close.displayName).toBe("Dialog.Close");
    expect(SideSheet.ActionBar.displayName).toBe("SideSheet.ActionBar");
    expect(Overlay.Cancel.displayName).toBe("Overlay.Cancel");
  });
});

describe("SideSheet", () => {
  it("closes with its onClose from its Close and its Cancel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SideSheet label="Forklift Operator" onClose={onClose} inline>
        <SideSheet.Header>
          <Typography variant="heading">Forklift Operator</Typography>
          <SideSheet.Close />
        </SideSheet.Header>
        <SideSheet.ActionBar>
          <SideSheet.Cancel />
        </SideSheet.ActionBar>
      </SideSheet>,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

});

describe("Overlay.Header", () => {
  it("sets its sheet actions beside its title, before Close, and the rest under it", () => {
    render(
      <Overlay.Header>
        <Typography variant="heading">Forklift Operator</Typography>
        <Typography variant="metadata" className={glyph.subdued}>Day Shift M/W/F</Typography>
        <Overlay.SheetActions>
          <Button size="small" emphasis="secondary">
            Edit schedule...
          </Button>
        </Overlay.SheetActions>
        <Overlay.Close />
      </Overlay.Header>,
    );
    const row = screen.getByText("Forklift Operator").parentElement!;
    expect(within(row).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Edit schedule...",
      "Close",
    ]);
    expect([...row.parentElement!.children].slice(1).map((node) => node.textContent)).toEqual(["Day Shift M/W/F"]);
  });
});

describe("Overlay.ActionBar", () => {
  it("holds Cancel and its forward actions, the change summary among them", () => {
    render(
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Overlay.ChangeSummary>
            <LabelValuePair>
              <Typography variant="metadata" className={glyph.subdued}>Unsaved Changes</Typography>
              <Typography variant="body">1 Assigned</Typography>
            </LabelValuePair>
          </Overlay.ChangeSummary>
          <Button emphasis="secondary">Save as draft</Button>
          <Button tone="destructive">Update offers</Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const forward = cancel.nextElementSibling!;
    expect(forward.textContent).toBe("Unsaved Changes1 AssignedSave as draftUpdate offers");
    expect(screen.getByRole("button", { name: "Update offers" }).dataset.tone).toBe("destructive");
  });
});

describe("LabelValuePair", () => {
  it("shows its label over its value, and its time difference when it has one", () => {
    render(
      <LabelValuePair>
        <Typography variant="metadata" className={glyph.subdued}>Check-in Time</Typography>
        <Typography variant="body">11:47 PM</Typography>
        <Chip size="small" state="warning">-13m (-1 Day)</Chip>
      </LabelValuePair>,
    );
    const pair = screen.getByText("Check-in Time").parentElement!;
    expect([...pair.children].map((node) => node.textContent)).toEqual(["Check-in Time", "11:47 PM", "-13m (-1 Day)"]);
    expect(screen.getByText("-13m (-1 Day)").dataset.tone).toBe("warning");
  });
});

describe("the overlay's code", () => {
  it("prints as its parts", () => {
    expect(
      jsxOf(
        <Overlay label="Notes" onClose={() => {}} inline>
          <Overlay.Header>
            <Typography variant="heading">Notes</Typography>
          </Overlay.Header>
          <Overlay.ActionBar>
            <Overlay.Cancel />
          </Overlay.ActionBar>
        </Overlay>,
      ),
    ).toBe(
      [
        '<Overlay label="Notes" onClose={() => {}} inline>',
        "  <Overlay.Header>",
        '    <Typography variant="heading">Notes</Typography>',
        "  </Overlay.Header>",
        "  <Overlay.ActionBar>",
        "    <Overlay.Cancel />",
        "  </Overlay.ActionBar>",
        "</Overlay>",
      ].join("\n"),
    );
  });
});
