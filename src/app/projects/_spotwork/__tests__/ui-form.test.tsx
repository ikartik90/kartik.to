import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox, Field, RadioButton, Stepper, Switch, TextArea } from "../ui";
import SuccessIcon from "../assets/icons/small/success.svg";

afterEach(cleanup);

describe("Checkbox", () => {
  it("is named by its label, its hint under it in its tone", () => {
    render(
      <Field orientation="horizontal" tone="alert">
        <Checkbox checked onChange={() => {}} />
        <Field.Content>
          <Field.Label>Private job</Field.Label>
          <Field.HintText>Only your pool sees it</Field.HintText>
        </Field.Content>
      </Field>,
    );
    const box = screen.getByRole("checkbox", { name: /Private job/ });
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(box.getAttribute("data-tone")).toBe("alert");
    expect(box.getAttribute("aria-describedby")).toBe(screen.getByText("Only your pool sees it").id);
    // The label and hint stack in one column beside the box.
    const words = box.nextElementSibling!;
    expect([...words.children].map((part) => part.textContent)).toEqual(["Private job", "Only your pool sees it"]);
    expect(words.children[1].firstElementChild!.getAttribute("data-tone")).toBe("alert");
  });

  it("sets its label beside the box on its own without a hint, the box holding only its mark", () => {
    render(
      <Field orientation="horizontal">
        <Checkbox checked={false} onChange={() => {}} />
        <Field.Label>Private job</Field.Label>
      </Field>,
    );
    const box = screen.getByRole("checkbox", { name: "Private job" });
    expect(box.children).toHaveLength(1);
    expect(box.nextElementSibling!.tagName).toBe("LABEL");
  });

  it("is toggled from its label", async () => {
    render(
      <Field orientation="horizontal">
        <Checkbox defaultChecked={false} />
        <Field.Label>Private job</Field.Label>
      </Field>,
    );
    await userEvent.click(screen.getByText("Private job"));
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
  });

  it("toggles when pressed", async () => {
    const onChange = vi.fn();
    render(
      <Field orientation="horizontal">
        <Checkbox checked onChange={onChange} />
        <Field.Label>Private job</Field.Label>
      </Field>,
    );
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("holds its own state when not given one, from its default", async () => {
    render(
      <>
        <Field orientation="horizontal">
          <Checkbox defaultChecked />
          <Field.Label>Private job</Field.Label>
        </Field>
        <Field orientation="horizontal">
          <RadioButton />
          <Field.Label>Hourly</Field.Label>
        </Field>
      </>,
    );
    const box = screen.getByRole("checkbox");
    expect(box.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByRole("radio"));
    expect(screen.getByRole("radio").getAttribute("aria-checked")).toBe("true");
  });

  it("is only a box, named, without a label; small as Figma's filter draws it", () => {
    render(<Checkbox aria-label="Select all" checked={false} onChange={() => {}} size="small" data-tour="pick" />);
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box.textContent).toBe("");
    expect(box.getAttribute("data-size")).toBe("small");
    expect(box.getAttribute("data-tour")).toBe("pick");
  });

  it("can be disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Select all" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names its parts for the code view", () => {
    expect(Checkbox.displayName).toBe("Checkbox");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});

describe("RadioButton", () => {
  it("is a radio, picked rather than toggled", async () => {
    const onChange = vi.fn();
    render(
      <Field orientation="horizontal">
        <RadioButton checked onChange={onChange} />
        <Field.Content>
          <Field.Label>Weekly</Field.Label>
          <Field.HintText>Every Monday</Field.HintText>
        </Field.Content>
      </Field>,
    );
    const radio = screen.getByRole("radio", { name: /Weekly/ });
    expect(radio.getAttribute("data-shape")).toBe("radio");
    await userEvent.click(radio);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("names its parts for the code view", () => {
    expect(RadioButton.displayName).toBe("RadioButton");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});

describe("Switch", () => {
  it("is named by its label, its toggle after the words unless at the left", () => {
    render(
      <Field orientation="horizontal">
        <Field.Content>
          <Field.Label>Spotfill</Field.Label>
          <Field.HintText>Fill it for me</Field.HintText>
        </Field.Content>
        <Switch checked onChange={() => {}} />
      </Field>,
    );
    const toggle = screen.getByRole("switch", { name: /Spotfill/ });
    expect(toggle.nextElementSibling).toBeNull();
    expect([...toggle.previousElementSibling!.children].map((part) => part.textContent)).toEqual([
      "Spotfill",
      "Fill it for me",
    ]);
    cleanup();
    render(
      <Field orientation="horizontal">
        <Switch checked onChange={() => {}} />
        <Field.Label>Spotfill</Field.Label>
      </Field>,
    );
    expect(screen.getByRole("switch").previousElementSibling).toBeNull();
  });

  it("gives its hint its tone", () => {
    render(
      <Field orientation="horizontal" tone="warning">
        <Field.Content>
          <Field.Label>Repeat</Field.Label>
          <Field.HintText>Cancels the shifts</Field.HintText>
        </Field.Content>
        <Switch checked={false} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByText("Cancels the shifts").getAttribute("data-tone")).toBe("warning");
  });

  it("toggles when pressed", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Is active" checked onChange={onChange} size="small" />);
    const toggle = screen.getByRole("switch", { name: "Is active" });
    expect(toggle.getAttribute("data-size")).toBe("small");
    expect(toggle.querySelector("[data-label]")).toBeNull();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("holds its own state when not given one, from its default", async () => {
    const onChange = vi.fn();
    render(
      <>
        <Field orientation="horizontal">
          <Field.Label>Spotfill</Field.Label>
          <Switch defaultChecked onChange={onChange} />
        </Field>
        <Switch aria-label="Repeat" />
      </>,
    );
    const [on, off] = screen.getAllByRole("switch");
    expect([on, off].map((toggle) => toggle.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    await userEvent.click(on);
    expect(on.getAttribute("aria-checked")).toBe("false");
    expect(onChange).toHaveBeenCalledWith(false);
    await userEvent.click(off);
    expect(off.getAttribute("aria-checked")).toBe("true");
  });

  it("names its parts for the code view", () => {
    expect(Switch.displayName).toBe("Switch");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});

describe("TextArea", () => {
  it("names its box by its label, described by its hint", () => {
    render(
      <Field tone="warning">
        <Field.Label>Note</Field.Label>
        <TextArea value="Late again" onChange={() => {}} />
        <Field.HintText>Shared with the worker</Field.HintText>
      </Field>,
    );
    const box = screen.getByRole("textbox", { name: "Note" });
    expect(box.getAttribute("aria-describedby")).toBe(screen.getByText("Shared with the worker").id);
    expect(box.closest("[data-box]")!.getAttribute("data-state")).toBe("warning");
  });

  it("has no description without a hint", () => {
    render(
      <Field>
        <Field.Label>Note</Field.Label>
        <TextArea value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Note" }).hasAttribute("aria-describedby")).toBe(false);
  });

  it("types into its value", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Note</Field.Label>
        <TextArea value="" onChange={onChange} />
      </Field>,
    );
    await userEvent.type(screen.getByRole("textbox"), "A");
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("holds what's typed when not given a value, from its default", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Note</Field.Label>
        <TextArea defaultValue="Late" onChange={onChange} />
      </Field>,
    );
    const box = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(box.value).toBe("Late");
    await userEvent.type(box, "!");
    expect(box.value).toBe("Late!");
    expect(onChange).toHaveBeenCalledWith("Late!");
  });

  it("drops its resize handle when fixed", () => {
    render(
      <Field>
        <Field.Label>Note</Field.Label>
        <TextArea fixed />
      </Field>,
    );
    expect(screen.getByRole("textbox").closest("[data-box]")!.querySelector("svg")).toBeNull();
  });

  it("holds its Active look, sized, and can be disabled", () => {
    render(
      <Field data-active="" disabled={false}>
        <Field.Label>Note</Field.Label>
        <TextArea size="large" value="" onChange={() => {}} />
      </Field>,
    );
    const root = screen.getByRole("textbox").closest("[data-box]")!;
    expect(root.getAttribute("data-state")).toBe("active");
    expect(root.getAttribute("data-size")).toBe("large");
    cleanup();
    render(
      <Field disabled>
        <Field.Label>Note</Field.Label>
        <TextArea value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").disabled).toBe(true);
  });

  it("waits for what it's drawn in to stop moving before it takes the focus, without scrolling to it", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    let land = () => {};
    const finished = new Promise<void>((resolve) => (land = resolve));
    const sliding = { effect: { target: null as Element | null, getComputedTiming: () => ({ endTime: 250 }) }, finished };
    Object.defineProperty(document, "getAnimations", { value: () => [sliding], configurable: true });
    render(
      <div ref={(node) => void (sliding.effect.target = node)}>
        <Field>
          <Field.Label>Note</Field.Label>
          <TextArea autoFocus />
        </Field>
      </div>,
    );
    const box = screen.getByRole("textbox", { name: "Note" });
    expect(document.activeElement).not.toBe(box);
    land();
    await waitFor(() => expect(document.activeElement).toBe(box));
    expect(focus.mock.calls.every(([options]) => options?.preventScroll)).toBe(true);
    focus.mockRestore();
    delete (document as { getAnimations?: unknown }).getAnimations;
  });

  it("names its parts for the code view", () => {
    expect(TextArea.displayName).toBe("TextArea");
    expect([Field, Field.Label, Field.HintText].map((part) => part.displayName)).toEqual(["Field", "Field.Label", "Field.HintText"]);
  });
});

describe("Stepper", () => {
  it("is a group named by its label and described by its hint, its value between Less and More", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Break</Field.Label>
        <Stepper value={30} step={15} onChange={onChange} />
        <Field.HintText>In minutes</Field.HintText>
      </Field>,
    );
    const group = screen.getByRole("group", { name: "Break" });
    expect([...group.children].map((part) => part.getAttribute("aria-label") ?? part.textContent)).toEqual(["Less", "30", "More"]);
    expect(group.getAttribute("aria-describedby")).toBe(screen.getByText("In minutes").id);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(onChange).toHaveBeenLastCalledWith(45);
    await userEvent.click(screen.getByRole("button", { name: "Less" }));
    expect(onChange).toHaveBeenLastCalledWith(15);
  });

  it("stops at its minimum, and gives its hint its tone", () => {
    render(
      <Field tone="alert">
        <Field.Label>No. of Workers</Field.Label>
        <Stepper value={1} min={1} onChange={() => {}} />
        <Field.HintText>Too few</Field.HintText>
      </Field>,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Less" }).disabled).toBe(true);
    expect(screen.getByRole("group").getAttribute("data-state")).toBe("alert");
    expect(screen.getByText("Too few").getAttribute("data-tone")).toBe("alert");
  });

  it("holds its own value when not given one, from its default", async () => {
    const onChange = vi.fn();
    render(
      <>
        <Field>
          <Field.Label>Workers</Field.Label>
          <Stepper defaultValue={1} onChange={onChange} />
        </Field>
        <Field>
          <Field.Label>Breaks</Field.Label>
          <Stepper />
        </Field>
      </>,
    );
    const workers = screen.getByRole("group", { name: "Workers" });
    expect(within(workers).getByText("1")).toBeTruthy();
    await userEvent.click(within(workers).getByRole("button", { name: "More" }));
    expect(within(workers).getByText("2")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(2);
    const breaks = screen.getByRole("group", { name: "Breaks" });
    expect(within(breaks).getByText("0")).toBeTruthy();
  });

  it("holds its Active look", () => {
    render(
      <Field data-active="">
        <Field.Label>Workers</Field.Label>
        <Stepper value={1} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole("group").getAttribute("data-state")).toBe("active");
  });

  it("names its parts for the code view", () => {
    expect(Stepper.displayName).toBe("Stepper");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});

describe("Field.HintText", () => {
  it("draws its tone's icon before its words", () => {
    render(
      <Field>
        <Field.HintText tone="alert">Expired</Field.HintText>
      </Field>,
    );
    expect(screen.getByText("Expired").querySelectorAll("svg")).toHaveLength(1);
  });

  it("takes an icon given first in place of its tone's", () => {
    render(
      <Field>
        <Field.HintText tone="alert">
          <SuccessIcon aria-hidden data-testid="own" />
          Met
        </Field.HintText>
      </Field>,
    );
    const hint = screen.getByText("Met");
    expect(hint.querySelectorAll("svg")).toHaveLength(1);
    expect(hint.firstElementChild!.getAttribute("data-testid")).toBe("own");
  });
});
