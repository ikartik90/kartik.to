import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { PropertiesPanel } from "../properties-panel";
import { Field } from "../input/field";
import { ColorInput } from "../input/color-input";

afterEach(() => cleanup());

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
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);

    unmount();
    expect(document.body.hasAttribute("data-properties-panel")).toBe(false);
  });

  it("hands the width back the moment it is dismissed, not when it has gone", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));

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

  it("stays up while a surface opened from one of its fields is used", async () => {
    const onDismiss = vi.fn();
    render(
      <PropertiesPanel ariaLabel="Media properties" onDismiss={onDismiss}>
        <PropertiesPanel.Control label="Colour">
          <ColorInput value="#FF0000FF" onValueChange={vi.fn()} />
        </PropertiesPanel.Control>
      </PropertiesPanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit colour" }));
    const picker = screen.getByRole("dialog", { name: "Color picker" });

    fireEvent.pointerDown(picker);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Color picker" })).toBe(picker);
  });

  it("dismisses on Escape", async () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await userEvent.setup().keyboard("{Escape}");
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  it("plays its exit before telling the consumer to unmount it", async () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));

    expect(onDismiss).not.toHaveBeenCalled();
    const panel = screen.getByRole("dialog", { name: "Media properties" });
    expect(panel.className).toMatch(/properties-panel__exiting/);

    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  // Asserts the exit, not `onDismiss`, which only arrives once the slide ends.
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

    fireEvent.keyDown(document, { key: "Escape" });
    expect(isLeaving()).toBe(true);
  });

  it("sends an earlier panel away when another docks", () => {
    const first = vi.fn();
    const { rerender } = render(
      <>
        <PropertiesPanel ariaLabel="First" onDismiss={first}>
          <PropertiesPanel.Header>First</PropertiesPanel.Header>
        </PropertiesPanel>
      </>,
    );
    rerender(
      <>
        <PropertiesPanel ariaLabel="First" onDismiss={first}>
          <PropertiesPanel.Header>First</PropertiesPanel.Header>
        </PropertiesPanel>
        <PropertiesPanel ariaLabel="Second" onDismiss={vi.fn()}>
          <PropertiesPanel.Header>Second</PropertiesPanel.Header>
        </PropertiesPanel>
      </>,
    );
    const leaving = (name: string) =>
      screen
        .getByRole("dialog", { name })
        .className.includes("properties-panel__exiting");
    expect(leaving("First")).toBe(true);
    expect(leaving("Second")).toBe(false);
  });

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

describe("PropertiesPanel.Header", () => {
  it("draws its actions before the control that sends the panel away", () => {
    render(
      <PropertiesPanel ariaLabel="Media properties" onDismiss={() => {}}>
        <PropertiesPanel.Header
          actions={<button type="button">Publish</button>}
        >
          Ada Lovelace
        </PropertiesPanel.Header>
      </PropertiesPanel>,
    );

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(["Publish", "Close properties panel"]);
  });

  it("is the title and the way out when it is given no actions", () => {
    render(<Harness />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("PropertiesPanel.Section", () => {
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
    maxLength,
  }: {
    onValueChange: (v: string) => void;
    maxLength?: number;
  }) {
    const [value, setValue] = useState("");
    return (
      <PropertiesPanel ariaLabel="Media properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Section defaultEnabled>
          <PropertiesPanel.SectionHeader>Caption</PropertiesPanel.SectionHeader>
          <PropertiesPanel.ControlPanel>
            <PropertiesPanel.Text
              ariaLabel="Image caption"
              maxLength={maxLength}
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

  it("stops at a length it is given", async () => {
    const onValueChange = vi.fn();
    render(<TextHarness onValueChange={onValueChange} maxLength={3} />);
    await userEvent
      .setup()
      .type(screen.getByRole("textbox", { name: "Image caption" }), "Hello");
    expect(onValueChange.mock.calls.at(-1)).toEqual(["Hel"]);
  });

  it("reports every keystroke", async () => {
    const onValueChange = vi.fn();
    render(<TextHarness onValueChange={onValueChange} />);
    await userEvent
      .setup()
      .type(screen.getByRole("textbox", { name: "Image caption" }), "Hi");
    expect(onValueChange.mock.calls.at(-1)).toEqual(["Hi"]);
  });

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

describe("PropertiesPanel.Group", () => {
  it("draws no panel for a group whose children come to nothing", () => {
    const nothing: boolean[] = [];
    render(
      <PropertiesPanel ariaLabel="Film properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Group
          title="Aliases"
          actions={<button type="button">Add</button>}
        >
          {false}
          {nothing.map((_, at) => (
            <span key={at} />
          ))}
        </PropertiesPanel.Group>
      </PropertiesPanel>,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Aliases" })).toBeNull();
  });
});

describe("PropertiesPanel.Tie", () => {
  const tied = () =>
    render(
      <PropertiesPanel ariaLabel="Icon properties" onDismiss={vi.fn()}>
        <PropertiesPanel.Group title="Icon">
          <PropertiesPanel.Tie
            action={<button type="button">Link size and stroke</button>}
          >
            <PropertiesPanel.Control label="Size">
              <Field.Frame>
                <Field.Control defaultValue="64" />
              </Field.Frame>
            </PropertiesPanel.Control>
            <PropertiesPanel.Control label="Stroke">
              <Field.Frame>
                <Field.Control defaultValue="4" />
              </Field.Frame>
            </PropertiesPanel.Control>
          </PropertiesPanel.Tie>
        </PropertiesPanel.Group>
      </PropertiesPanel>,
    );

  it("stands its action beside the rows, in neither of them", () => {
    tied();

    const rows = ["Size", "Stroke"].map(
      (name) =>
        screen
          .getByRole("textbox", { name })
          .closest("[data-property-control]") as HTMLElement,
    );
    for (const row of rows) expect(within(row).queryByRole("button")).toBeNull();

    const tie = screen
      .getByRole("button", { name: "Link size and stroke" })
      .closest("[data-property-tie]") as HTMLElement;
    expect(tie).toBeTruthy();
    for (const row of rows) expect(tie.contains(row)).toBe(true);
  });

  it("keeps the rows inside the group the panel names", () => {
    tied();

    const group = screen.getByRole("group", { name: "Icon" });
    expect(within(group).getByRole("textbox", { name: "Size" })).toBeTruthy();
    expect(within(group).getByRole("textbox", { name: "Stroke" })).toBeTruthy();
  });

  it("insists on the panel's context, as every row-level part does", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<PropertiesPanel.Tie action={null}>rows</PropertiesPanel.Tie>),
    ).toThrow(/must be used within <PropertiesPanel>/);
    spy.mockRestore();
  });
});

describe("PropertiesPanel.Footer", () => {
  it("renders its content inside the panel, after the sections", () => {
    render(
      <PropertiesPanel ariaLabel="Parser settings" onDismiss={vi.fn()}>
        <PropertiesPanel.Section enabled>
          <p>Preferences</p>
        </PropertiesPanel.Section>
        <PropertiesPanel.Footer>
          <p>Package card</p>
        </PropertiesPanel.Footer>
      </PropertiesPanel>,
    );
    const panel = screen.getByRole("dialog", { name: "Parser settings" });
    const footer = screen.getByText("Package card");
    expect(panel.contains(footer)).toBe(true);
    expect(
      screen.getByText("Preferences").compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("says it was misplaced outside a panel", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(<PropertiesPanel.Footer>Orphan</PropertiesPanel.Footer>),
    ).toThrow(/PropertiesPanel.Footer must be used within <PropertiesPanel>/);
    spy.mockRestore();
  });
});
