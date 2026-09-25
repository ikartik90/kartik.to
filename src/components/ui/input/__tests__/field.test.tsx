import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../field";

afterEach(cleanup);

describe("Field.Search", () => {
  const typeInto = (value: string) =>
    fireEvent.input(screen.getByRole("searchbox"), { target: { value } });

  it("emits the raw query string on every keystroke", () => {
    const onValueChange = vi.fn();
    render(<Field.Search onValueChange={onValueChange} />);
    typeInto("dec");
    expect(onValueChange).toHaveBeenCalledWith("dec");
  });

  it("composes a consumer's own onInput without swallowing it", () => {
    const onInput = vi.fn();
    const onValueChange = vi.fn();
    render(<Field.Search onInput={onInput} onValueChange={onValueChange} />);
    typeInto("hi");
    expect(onInput).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith("hi");
  });
});
