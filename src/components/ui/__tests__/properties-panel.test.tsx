import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { PropertiesPanel } from "../properties-panel";
import { Field } from "../input/field";

afterEach(() => cleanup());

/** The smallest complete panel: a header and one togglable section. */
function Harness({
  onDismiss = vi.fn(),
  onEnabledChange,
  defaultEnabled = false,
  dismissOnOutsidePointer,
}: {
  onDismiss?: () => void;
  onEnabledChange?: (enabled: boolean) => void;
  defaultEnabled?: boolean;
  dismissOnOutsidePointer?: boolean;
}) {
  return (
    <PropertiesPanel
      ariaLabel="Media properties"
      onDismiss={onDismiss}
      dismissOnOutsidePointer={dismissOnOutsidePointer}
    >
      <PropertiesPanel.Header>Media Properties</PropertiesPanel.Header>
      <PropertiesPanel.Section
        defaultEnabled={defaultEnabled}
        onEnabledChange={onEnabledChange}
      >
        <PropertiesPanel.SectionHeader>
          Background
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Control label="Rotation">
            <Field.Frame>
              <Field.Control defaultValue="90" />
            </Field.Frame>
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </PropertiesPanel>
  );
}

const toggle = () => screen.getByRole("button", { name: /background$/i });

describe("PropertiesPanel", () => {
  it("names itself as a dialog", () => {
    render(<Harness />);
    expect(
      screen.getByRole("dialog", { name: "Media properties" }),
    ).toBeDefined();
  });

  it("makes the page give up its width while docked", () => {
    const { unmount } = render(<Harness />);
    // The rule is `body[data-properties-panel]` in globals.css — the panel is
    // fixed to the viewport, so the PAGE is what has to make the room.
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);

    unmount();
    expect(document.body.hasAttribute("data-properties-panel")).toBe(false);
  });

  it("hands the width back the moment it is dismissed, not when it has gone", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));

    // Still mounted, still sliding out — and the page is already expanding, so
    // the two move together instead of the content snapping open behind it.
    await waitFor(() =>
      expect(document.body.hasAttribute("data-properties-panel")).toBe(false),
    );
    expect(screen.getByRole("dialog", { name: "Media properties" })).toBeTruthy();
  });

  it("dismisses from the header", async () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  it("dismisses on Escape", async () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await userEvent.setup().keyboard("{Escape}");
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  // `onDismiss` is "it has finished leaving", not "it was asked to leave" —
  // the consumer unmounts on that call, and firing it up front would take the
  // closing slide away with the element playing it.
  it("plays its exit before telling the consumer to unmount it", async () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));

    expect(onDismiss).not.toHaveBeenCalled();
    // Still on screen, and inert, for the length of the slide.
    const panel = screen.getByRole("dialog", { name: "Media properties" });
    expect(panel.className).toMatch(/properties-panel__exiting/);

    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  // A panel docked beside the thing it edits is usually transient — press the
  // canvas and it goes. A panel that IS the page's settings is not: it is
  // opened deliberately and closed deliberately, and every press on the surface
  // it configures would otherwise take it away.
  // Asserted on the EXIT rather than on `onDismiss`, which only arrives once
  // the slide is over — by which time an Escape fired in between would have
  // reported the same thing whether the press was heard or not.
  const isLeaving = () =>
    screen
      .getByRole("dialog", { name: "Media properties" })
      .className.includes("properties-panel__exiting");

  it("closes on an outside press by default", () => {
    render(<Harness />);
    fireEvent.pointerDown(document.body);
    expect(isLeaving()).toBe(true);
  });

  it("holds through an outside press when told to", () => {
    render(<Harness dismissOnOutsidePointer={false} />);
    fireEvent.pointerDown(document.body);
    expect(isLeaving()).toBe(false);

    // Escape is not what was withdrawn — a dialog still has to be escapable.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isLeaving()).toBe(true);
  });

  // Escape, the header and an outside press all reach the same close, so a
  // second one arriving mid-slide must not queue a second dismissal.
  it("only finishes leaving once", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<Harness onDismiss={onDismiss} />);
    await user.click(
      screen.getByRole("button", { name: "Close properties panel" }),
    );
    await user.keyboard("{Escape}");

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("PropertiesPanel.Section", () => {
  // Mounted, not hidden: a collapsed section must hold no focusable control to
  // tab into and no stale value to read back.
  it("keeps its control panel out of the DOM until it is enabled", async () => {
    render(<Harness />);
    expect(screen.queryByRole("group", { name: "Background" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Rotation" })).toBeNull();

    await userEvent.setup().click(toggle());

    expect(screen.getByRole("group", { name: "Background" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Rotation" })).toBeDefined();
  });

  it("takes the control panel away again when it is removed", async () => {
    const user = userEvent.setup();
    render(<Harness defaultEnabled />);
    expect(screen.getByRole("textbox", { name: "Rotation" })).toBeDefined();

    await user.click(toggle());

    expect(screen.queryByRole("textbox", { name: "Rotation" })).toBeNull();
  });

  // One button, because a section is either open or it is not — two hit
  // targets for one piece of state would leave one of them permanently inert.
  it("renames its one button to say what it will do next", async () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: "Add background" }),
    ).toBeDefined();

    await userEvent.setup().click(toggle());

    expect(
      screen.getByRole("button", { name: "Remove background" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add background" })).toBeNull();
  });

  it("publishes the open state, and points at the panel only once it exists", async () => {
    render(<Harness />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBeNull();

    await userEvent.setup().click(toggle());

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const controls = toggle().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBe(
      screen.getByRole("group", { name: "Background" }),
    );
  });

  it("reports every flip", async () => {
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onEnabledChange={onEnabledChange} />);

    await user.click(toggle());
    await user.click(toggle());

    expect(onEnabledChange.mock.calls).toEqual([[true], [false]]);
  });

  // Open is a fact about the PANEL, not about the value it edits — a section
  // deriving it from the value would unmount its own field on the keystroke
  // that cleared it.
  it("opens from the default without being told again", () => {
    render(<Harness defaultEnabled />);
    expect(screen.getByRole("group", { name: "Background" })).toBeDefined();
  });

  it("defers to a controlled `enabled`", async () => {
    function Controlled() {
      const [enabled, setEnabled] = useState(false);
      return (
        <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
          <PropertiesPanel.Section
            enabled={enabled}
            onEnabledChange={setEnabled}
          >
            <PropertiesPanel.SectionHeader>
              Background
            </PropertiesPanel.SectionHeader>
            <PropertiesPanel.ControlPanel>
              <PropertiesPanel.Control label="Rotation">
                <Field.Frame>
                  <Field.Control defaultValue="90" />
                </Field.Frame>
              </PropertiesPanel.Control>
            </PropertiesPanel.ControlPanel>
          </PropertiesPanel.Section>
        </PropertiesPanel>
      );
    }
    render(<Controlled />);
    expect(screen.queryByRole("textbox", { name: "Rotation" })).toBeNull();

    await userEvent.setup().click(toggle());

    expect(screen.getByRole("textbox", { name: "Rotation" })).toBeDefined();
  });

  // A section that ignored its controlled prop would open on its own the
  // moment the consumer declined the change.
  it("stays shut when a controlled owner declines the flip", async () => {
    render(
      <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Section enabled={false} onEnabledChange={vi.fn()}>
          <PropertiesPanel.SectionHeader>
            Background
          </PropertiesPanel.SectionHeader>
          <PropertiesPanel.ControlPanel>
            <PropertiesPanel.Control label="Rotation">
              <Field.Frame>
                <Field.Control defaultValue="90" />
              </Field.Frame>
            </PropertiesPanel.Control>
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      </PropertiesPanel>,
    );

    await userEvent.setup().click(toggle());

    expect(screen.queryByRole("textbox", { name: "Rotation" })).toBeNull();
  });

  it("keeps sections independent of one another", async () => {
    render(
      <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Section>
          <PropertiesPanel.SectionHeader>Caption</PropertiesPanel.SectionHeader>
          <PropertiesPanel.ControlPanel>
            <PropertiesPanel.Control label="Text">
              <Field.Frame>
                <Field.Control />
              </Field.Frame>
            </PropertiesPanel.Control>
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
        <PropertiesPanel.Section>
          <PropertiesPanel.SectionHeader>
            Background
          </PropertiesPanel.SectionHeader>
          <PropertiesPanel.ControlPanel>
            <PropertiesPanel.Control label="Rotation">
              <Field.Frame>
                <Field.Control />
              </Field.Frame>
            </PropertiesPanel.Control>
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      </PropertiesPanel>,
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Add caption" }));

    expect(screen.getByRole("textbox", { name: "Text" })).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Rotation" })).toBeNull();
  });
});

describe("PropertiesPanel.Control", () => {
  // The row is a real Field, relaid by the recipe — so the label keeps the
  // native association it would have anywhere else, rather than an aria-label
  // hand-written per row.
  it("associates its label with the control it wraps", () => {
    render(<Harness defaultEnabled />);
    const input = screen.getByRole("textbox", { name: "Rotation" });
    const label = screen.getByText("Rotation");
    expect(label.getAttribute("for")).toBe(input.getAttribute("id"));
  });
});

describe("PropertiesPanel.Text", () => {
  function TextHarness({
    onValueChange,
  }: {
    onValueChange: (v: string) => void;
  }) {
    const [value, setValue] = useState("");
    return (
      <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Section defaultEnabled>
          <PropertiesPanel.SectionHeader>Caption</PropertiesPanel.SectionHeader>
          <PropertiesPanel.ControlPanel>
            <PropertiesPanel.Text
              ariaLabel="Image caption"
              value={value}
              onValueChange={(next) => {
                setValue(next);
                onValueChange(next);
              }}
            />
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      </PropertiesPanel>
    );
  }

  it("reports every keystroke", async () => {
    const onValueChange = vi.fn();
    render(<TextHarness onValueChange={onValueChange} />);
    await userEvent
      .setup()
      .type(screen.getByRole("textbox", { name: "Image caption" }), "Hi");
    expect(onValueChange.mock.calls.at(-1)).toEqual(["Hi"]);
  });

  // It wraps because a caption wraps, but the value is still one line: Enter
  // must not smuggle a newline into it.
  it("declines Enter", async () => {
    const onValueChange = vi.fn();
    render(<TextHarness onValueChange={onValueChange} />);
    const field = screen.getByRole("textbox", { name: "Image caption" });
    await userEvent.setup().type(field, "One{Enter}Two");
    expect((field as HTMLTextAreaElement).value).toBe("OneTwo");
  });
});

describe("PropertiesPanel parts outside their parent", () => {
  it("says which part was misplaced", () => {
    // React logs the thrown error; the assertion is what it says.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<PropertiesPanel.Header>Orphan</PropertiesPanel.Header>),
    ).toThrow(/PropertiesPanel.Header must be used within <PropertiesPanel>/);
    spy.mockRestore();
  });

  it("says which part was misplaced outside a section", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
          <PropertiesPanel.SectionHeader>Loose</PropertiesPanel.SectionHeader>
        </PropertiesPanel>,
      ),
    ).toThrow(/must be used within <PropertiesPanel.Section>/);
    spy.mockRestore();
  });
});
