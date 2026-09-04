// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { createCalchemy, type Calchemy } from "@calchemy/date-core";
import { useCalchemyQuery } from "../use-calchemy-query";

afterEach(cleanup);

// A Wednesday, fixed, so "tomorrow" has an answer that does not move with the
// wall clock — the same reference `calchemy-query`'s own tests use.
const REFERENCE = Temporal.PlainDate.from("2026-09-02");
const CONTEXT = {
  locale: "en-US",
  weekStartsOn: 0 as const,
  referenceDate: REFERENCE,
};

/** A slashed date nobody has said the order of — three readings. */
const AMBIGUOUS = "03/04/25";

let calchemy: Calchemy;
beforeAll(async () => {
  calchemy = await createCalchemy();
});

function open(kind: "single" | "multiple" = "multiple") {
  const rendered = renderHook(() =>
    useCalchemyQuery(calchemy, CONTEXT, kind),
  );
  const type = (phrase: string) =>
    act(() => rendered.result.current.setQuery(phrase));
  return { ...rendered, type };
}

describe("useCalchemyQuery", () => {
  it("holds nothing until a phrase is typed", () => {
    const { result } = open();
    expect(result.current.query).toBe("");
    expect(result.current.dates).toEqual([]);
    expect(result.current.candidates).toEqual([]);
  });

  it("answers an unambiguous phrase with its days, and offers no reading to pick", () => {
    const { result, type } = open();
    type("tomorrow");

    expect(result.current.dates.map(String)).toEqual(["2026-09-03"]);
    expect(result.current.candidates).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  // The point of the readings: the one being pointed at is DRAWN, so moving
  // through the list shows what each would select rather than describing it.
  it("previews the first reading of an ambiguous phrase", () => {
    const { result, type } = open("single");
    type(AMBIGUOUS);

    expect(result.current.candidates.map((c) => c.label)).toEqual([
      "April 3, 2025",
      "March 4, 2025",
      "April 25, 2003",
    ]);
    expect(result.current.activeId).toBe(result.current.candidates[0].id);
    expect(result.current.dates.map(String)).toEqual(["2025-04-03"]);
  });

  it("moves the preview with the arrows, and wraps", () => {
    const { result, type } = open("single");
    type(AMBIGUOUS);

    act(() => result.current.movePreview(1));
    expect(result.current.dates.map(String)).toEqual(["2025-03-04"]);

    // Three readings, so a fourth step is back at the first.
    act(() => result.current.movePreview(1));
    act(() => result.current.movePreview(1));
    expect(result.current.activeId).toBe(result.current.candidates[0].id);

    act(() => result.current.movePreview(-1));
    expect(result.current.dates.map(String)).toEqual(["2003-04-25"]);
  });

  // Previewing and settling are two different things: the highlight moves
  // freely, and committing is the separate act that says "this one".
  it("commits the reading being previewed", () => {
    const { result, type } = open("single");
    type(AMBIGUOUS);
    act(() => result.current.movePreview(1));

    expect(result.current.committed).toBeNull();
    act(() => result.current.commitPreview());
    expect(result.current.committed).toBe(result.current.activeId);
    expect(result.current.dates.map(String)).toEqual(["2025-03-04"]);
  });

  // A click is not an Enter: it names the reading it landed on, which need not
  // be the one the arrows were sitting on.
  it("commits the reading it is given, not the one highlighted", () => {
    const { result, type } = open("single");
    type(AMBIGUOUS);
    const third = result.current.candidates[2].id;

    act(() => {
      result.current.preview(third);
      result.current.commit(third);
    });

    expect(result.current.committed).toBe(third);
    expect(result.current.dates.map(String)).toEqual(["2003-04-25"]);
  });

  it("drops both the preview and the commitment when the phrase changes", () => {
    const { result, type } = open("single");
    type(AMBIGUOUS);
    act(() => result.current.movePreview(1));
    act(() => result.current.commitPreview());

    type("03/04/25 ");
    expect(result.current.committed).toBeNull();
    // Back to the first reading, not the one settled on for the last phrase.
    expect(result.current.activeId).toBe(result.current.candidates[0].id);
  });

  // A phrase whose readings the kind cannot use offers no choice, because
  // there is none to make — and nothing to draw either. Every reading of this
  // one is a single day, which `range` has no use for.
  it("offers no readings the asked-for kind cannot use", () => {
    const { result } = renderHook(() =>
      useCalchemyQuery(calchemy, CONTEXT, "range"),
    );
    act(() => result.current.setQuery(AMBIGUOUS));

    expect(result.current.candidates).toEqual([]);
    expect(result.current.dates).toEqual([]);
  });

  it("answers with nothing at all until the engine lands", () => {
    const { result } = renderHook(() => useCalchemyQuery(null, CONTEXT));
    act(() => result.current.setQuery("tomorrow"));

    expect(result.current.query).toBe("tomorrow");
    expect(result.current.dates).toEqual([]);
  });
});
