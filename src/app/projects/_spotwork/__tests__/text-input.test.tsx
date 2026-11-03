import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextInput } from "../ui";
import { Field } from "../ui";

afterEach(cleanup);

describe("TextInput", () => {
  it("is named by its label, its hint under it in its tone", () => {
    render(
      <Field tone="alert">
        <Field.Label>Full Name</Field.Label>
        <TextInput value="Maria" onChange={() => {}} />
        <Field.HintText>Required</Field.HintText>
      </Field>,
    );
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Full Name" });
    expect(field.value).toBe("Maria");
    const root = field.closest("[data-state]")!;
    expect(root.getAttribute("data-state")).toBe("alert");
    expect(screen.getByText("Required").getAttribute("data-tone")).toBe("alert");
  });

  it("sets a prefix before what's typed and a suffix after it, inside the box", () => {
    render(
      <Field>
        <Field.Label>Distance</Field.Label>
        <TextInput value="5" onChange={() => {}}>
          <TextInput.Suffix>km</TextInput.Suffix>
          <TextInput.Prefix>+1</TextInput.Prefix>
        </TextInput>
      </Field>,
    );
    const box = screen.getByRole("textbox").parentElement!;
    expect(box.hasAttribute("data-box")).toBe(true);
    expect([...box.children].map((part) => part.tagName)).toEqual(["SPAN", "INPUT", "SPAN"]);
    expect(box.firstElementChild!.textContent).toBe("+1");
    expect(box.lastElementChild!.textContent).toBe("km");
  });

  it("types into its value", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Title</Field.Label>
        <TextInput value="" onChange={onChange} />
      </Field>,
    );
    await userEvent.type(screen.getByRole("textbox"), "D");
    expect(onChange).toHaveBeenCalledWith("D");
  });

  it("holds what's typed when not given a value, from its default", async () => {
    const onChange = vi.fn();
    render(
      <Field>
        <Field.Label>Title</Field.Label>
        <TextInput defaultValue="Day" onChange={onChange} />
      </Field>,
    );
    const field = screen.getByRole<HTMLInputElement>("textbox");
    expect(field.value).toBe("Day");
    await userEvent.type(field, "s");
    expect(field.value).toBe("Days");
    expect(onChange).toHaveBeenCalledWith("Days");
  });

  it("takes lines when multiline, holds its Active look, and can be disabled", () => {
    render(
      <Field data-active="">
        <Field.Label>Entrance Instructions</Field.Label>
        <TextInput multiline value="" onChange={() => {}} />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Entrance Instructions" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.closest("[data-multiline]")!.getAttribute("data-state")).toBe("active");
    cleanup();
    render(
      <Field disabled>
        <Field.Label>Unit</Field.Label>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole<HTMLInputElement>("textbox").disabled).toBe(true);
  });

  it("takes the focus as it's drawn, given autoFocus, without scrolling to it", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(
      <Field>
        <Field.Label>Email Address</Field.Label>
        <TextInput autoFocus />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Email Address" });
    expect(document.activeElement).toBe(field);
    expect(focus.mock.contexts.filter((on) => on === field).length).toBeGreaterThan(0);
    expect(focus.mock.calls.every(([options]) => options?.preventScroll)).toBe(true);
    focus.mockRestore();
  });

  it("waits for what it's drawn in to stop moving before it takes the focus", async () => {
    let land = () => {};
    const finished = new Promise<void>((resolve) => (land = resolve));
    const sliding = { effect: { target: null as Element | null, getComputedTiming: () => ({ endTime: 250 }) }, finished };
    const getAnimations = vi.fn(() => [sliding]);
    Object.defineProperty(document, "getAnimations", { value: getAnimations, configurable: true });
    render(
      <div ref={(node) => void (sliding.effect.target = node)}>
        <Field>
          <Field.Label>Email Address</Field.Label>
          <TextInput autoFocus />
        </Field>
      </div>,
    );
    const field = screen.getByRole("textbox", { name: "Email Address" });
    expect(document.activeElement).not.toBe(field);
    land();
    await waitFor(() => expect(document.activeElement).toBe(field));
    delete (document as { getAnimations?: unknown }).getAnimations;
  });

  it("names its parts for the code view", () => {
    expect(TextInput.displayName).toBe("TextInput");
    expect([Field, Field.Label, TextInput.Prefix, TextInput.Suffix, Field.HintText].map((part) => part.displayName)).toEqual([
      "Field",
      "Field.Label",
      "TextInput.Prefix",
      "TextInput.Suffix",
      "Field.HintText",
    ]);
  });
});
