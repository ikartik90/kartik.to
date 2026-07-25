import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field } from "../field";

afterEach(cleanup);

// Field.Search is a generic search box: it can run a consumer-supplied
// `string → T` parser and hand the result to `onQuery`, but carries no opinion
// about what T is (a date, a filter token, …). These specs pin that contract so
// the Calendar's date wiring lives entirely on the Calendar side.
describe("Field.Search", () => {
  const typeInto = (value: string) =>
    fireEvent.input(screen.getByRole("searchbox"), { target: { value } });

  it("emits the raw query string on every keystroke", () => {
    const onValueChange = vi.fn();
    render(<Field.Search onValueChange={onValueChange} />);
    typeInto("dec");
    expect(onValueChange).toHaveBeenCalledWith("dec");
  });

  it("runs a queryParser and delivers its result to onQuery", () => {
    const onQuery = vi.fn();
    render(<Field.Search queryParser={(q) => q.length} onQuery={onQuery} />);
    typeInto("dec");
    expect(onQuery).toHaveBeenCalledWith(3, "dec");
  });

  it("defaults to a direct string match — onQuery fires with the raw query", () => {
    // No queryParser = a "dumb" search: the parsed result IS the query string.
    const onQuery = vi.fn();
    render(<Field.Search onQuery={onQuery} />);
    typeInto("dec");
    expect(onQuery).toHaveBeenCalledWith("dec", "dec");
  });

  it("keeps onValueChange (raw) and onQuery (parsed) independent", () => {
    const onValueChange = vi.fn();
    const onQuery = vi.fn();
    render(
      <Field.Search
        queryParser={(q) => q.toUpperCase()}
        onValueChange={onValueChange}
        onQuery={onQuery}
      />,
    );
    typeInto("hi");
    expect(onValueChange).toHaveBeenCalledWith("hi");
    expect(onQuery).toHaveBeenCalledWith("HI", "hi");
  });
});
