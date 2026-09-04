// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { createCalchemy, type Calchemy } from "@calchemy/date-core";
import { useCalchemyQuery } from "@/hooks/use-calchemy-query";
import { CalchemySuggestion } from "../calchemy-suggestion";

afterEach(cleanup);

// The same fixed Wednesday the parser's own suites use, so "tomorrow until
// march" is backwards by a knowable amount and the rewrite names 2027.
const CONTEXT = {
  locale: "en-US",
  weekStartsOn: 0 as const,
  referenceDate: Temporal.PlainDate.from("2026-09-02"),
};

/**
 * The arrangement the row actually ships in: a real engine, the real hook, and
 * a box to type the phrase into. Building a `CalchemyQuery` by hand would let
 * the row pass against a shape the hook never produces.
 */
function Harness({ onQueryChange }: { onQueryChange?: (raw: string) => void }) {
  const [engine, setEngine] = useState<Calchemy | null>(null);
  useEffect(() => {
    createCalchemy({ defaultContext: CONTEXT }).then(setEngine);
  }, []);
  const query = useCalchemyQuery(engine, CONTEXT);

  return (
    <>
      <CalchemySuggestion query={query} onQueryChange={onQueryChange} />
      <input
        aria-label="phrase"
        value={query.query}
        onChange={(event) => {
          query.setQuery(event.target.value);
          onQueryChange?.(event.target.value);
        }}
      />
    </>
  );
}

async function open(onQueryChange?: (raw: string) => void) {
  render(<Harness onQueryChange={onQueryChange} />);
  const field = screen.getByLabelText("phrase");
  return { field, user: userEvent.setup() };
}

describe("CalchemySuggestion", () => {
  it("stays out of the way while the phrase reads", async () => {
    const { field, user } = await open();
    await user.type(field, "tomorrow");

    // Nothing at all — not an empty row holding space open.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says nothing about an empty box", async () => {
    await open();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the phrase the parser would have read", async () => {
    const { field, user } = await open();
    await user.type(field, "tomorrow until march");

    const offer = await screen.findByRole("button");
    expect(offer.textContent).toContain("tomorrow until march 2027");
  });

  it("retypes the phrase when the offer is taken, and then withdraws it", async () => {
    const onQueryChange = vi.fn();
    const { field, user } = await open(onQueryChange);
    await user.type(field, "tomorrow until march");

    await user.click(await screen.findByRole("button"));

    expect((field as HTMLInputElement).value).toBe("tomorrow until march 2027");
    // The consumer hears about it exactly as it would a keystroke — the
    // playground drops its hand-made selection on either.
    expect(onQueryChange).toHaveBeenLastCalledWith("tomorrow until march 2027");
    // The rewritten phrase reads, so there is nothing left to offer.
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });
});
