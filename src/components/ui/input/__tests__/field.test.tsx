import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../field";

afterEach(cleanup);

// Field.Search is a deliberately DUMB search box: it emits nothing but the raw
// query string. Interpreting that query — parsing a date, filtering a list — is
// the container's job (Calendar's `queryParser`, OptionList's `filter`), since
// only the container holds what the query is matched against. These specs pin
// that the box itself carries no interpretation.
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
