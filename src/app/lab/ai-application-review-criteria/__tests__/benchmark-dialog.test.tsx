// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BENCHMARKING_MS } from "../benchmark-dialog";
import { CRITERIA } from "../harness-data";
import { Landing } from "../landing";

// jsdom lacks both; the stubs mirror the platform (close fires `close`, reopening throws).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    if (this.open) throw new DOMException("Already open", "InvalidStateError");
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ALL_MATCH =
  "12/12 results match with their known outcomes on all criteria";

function drawer() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

function overlay() {
  return document.querySelectorAll("dialog")[1] as HTMLDialogElement;
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// Fakes timers once Add custom is chosen; use `fireEvent` after, as `userEvent`
// never resolves under Vitest's fake timers.
async function openRetestMenu() {
  const user = userEvent.setup();
  render(<Landing />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(
    within(drawer()).getByRole("button", { name: "Add criteria" }),
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(
    within(drawer()).getByRole("menuitem", { name: "Add custom" }),
  );
  await act(async () => {
    vi.runAllTimers();
  });
  fireEvent.click(
    within(drawer()).getByRole("button", { name: "Retest criteria" }),
  );
}

async function retestWithPreviousSet() {
  await openRetestMenu();
  fireEvent.click(
    within(drawer()).getByRole("menuitem", {
      name: "Retest with previous candidate set",
    }),
  );
}

async function showResults() {
  await retestWithPreviousSet();
  await advance(BENCHMARKING_MS);
  return screen.getByRole("dialog", { name: "Benchmark results" });
}

const NEW_LOGO = CRITERIA.find((c) => c.id === "new-logo")!;

function titles() {
  return within(drawer()).getAllByLabelText(
    "Short title",
  ) as HTMLInputElement[];
}

function prompts() {
  return within(drawer()).getAllByLabelText("Prompt") as HTMLTextAreaElement[];
}

function rewrite() {
  return within(drawer()).queryByRole("group", { name: "Suggested rewrite" });
}

async function reviewRewrites() {
  const results = await showResults();
  fireEvent.click(
    within(results).getByRole("button", { name: "Review suggested rewrites" }),
  );
  // Focus moves once the results have closed, a promise later.
  await act(async () => {});
}

function row(results: HTMLElement, name: string) {
  return within(results).getByRole("row", { name: new RegExp(name) });
}

describe("retesting with the previous candidate set", () => {
  it("opens an overlay over the drawer that benchmarks the criteria first", async () => {
    await retestWithPreviousSet();
    expect(overlay().open).toBe(true);
    expect(drawer().open).toBe(true);
    expect(
      within(overlay()).getByRole("progressbar", {
        name: "Benchmarking criteria",
      }),
    ).toBeTruthy();
    expect(within(overlay()).queryByRole("table")).toBeNull();
  });

  it("shows the results in the same overlay once benchmarking is done", async () => {
    await retestWithPreviousSet();
    await advance(BENCHMARKING_MS - 1);
    expect(within(overlay()).queryByRole("table")).toBeNull();

    await advance(1);
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(results).toBe(overlay());
    expect(within(results).queryByRole("progressbar")).toBeNull();
    expect(within(results).getAllByRole("row")).toHaveLength(13);
  });

  it("counts the criteria as tested from then on", async () => {
    await retestWithPreviousSet();
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
    expect(
      within(drawer()).queryByRole("button", { name: "Retest criteria" }),
    ).toBeNull();
  });
});

describe("changing the candidates", () => {
  async function changeCandidates() {
    await openRetestMenu();
    fireEvent.click(
      within(drawer()).getByRole("menuitem", { name: "Change candidates..." }),
    );
    return screen.getByRole("dialog", { name: "Benchmark results" });
  }

  it("opens the overlay on the Suggested candidates list at once, benchmarking nothing", async () => {
    const results = await changeCandidates();
    expect(results.hasAttribute("open")).toBe(true);
    expect(within(results).queryByRole("progressbar")).toBeNull();
    const suggested = within(results).getByRole("tab", {
      name: /Suggested candidates/,
    });
    expect(suggested.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(suggested);
    expect(
      within(results).getByRole("tabpanel").getAttribute("aria-labelledby"),
    ).toBe(suggested.id);
    expect(
      within(row(results, "Tomas Reyes")).getByRole("button", {
        name: "Remove",
      }),
    ).toBeTruthy();
    expect(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    ).toBeTruthy();
  });

  it("leaves the next retest to open on the results", async () => {
    const results = await changeCandidates();
    fireEvent.keyDown(results, { key: "Escape" });
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    );
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with previous candidate set",
      }),
    );
    await advance(BENCHMARKING_MS);
    expect(
      within(overlay())
        .getByRole("tab", { name: "Benchmark results" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("benchmark results", () => {
  it("says what each candidate's result is, against what really happened to them", async () => {
    const results = await showResults();
    expect(
      within(row(results, "Renee Acheampong")).getByText("Included"),
    ).toBeTruthy();
    expect(
      within(row(results, "Dana Whitlock")).getByText("Excluded"),
    ).toBeTruthy();
    expect(
      within(row(results, "Dana Whitlock")).getByText("Hired"),
    ).toBeTruthy();
    expect(
      within(row(results, "Tomas Reyes")).getByText("Included"),
    ).toBeTruthy();
  });

  it("counts the mismatches under the table", async () => {
    const results = await showResults();
    expect(
      within(results).getByText(
        "3/12 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
  });

  it("names the criterion behind each mismatch, and no finding elsewhere", async () => {
    const results = await showResults();
    for (const name of ["Dana Whitlock", "Priya Raman", "Tomas Reyes"]) {
      expect(
        within(row(results, name)).getByText("New Logo Acquisition"),
      ).toBeTruthy();
    }
    expect(
      within(row(results, "Renee Acheampong")).queryByText(
        "New Logo Acquisition",
      ),
    ).toBeNull();
  });

  it("opens with the first mismatch's details shown and the rest folded", async () => {
    const results = await showResults();
    const dana = row(results, "Dana Whitlock");
    expect(
      within(dana)
        .getByRole("button", { name: "Hide details" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      within(dana).getByText(
        "“Grew the mid-market SaaS book from 0 to 42 accounts in 18 months.”",
      ),
    ).toBeTruthy();

    const priya = row(results, "Priya Raman");
    expect(
      within(priya)
        .getByRole("button", { name: "Show details" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(within(priya).queryByText("From the resume")).toBeNull();
  });

  it("shows and hides a finding's details", async () => {
    const results = await showResults();
    const priya = row(results, "Priya Raman");
    fireEvent.click(
      within(priya).getByRole("button", { name: "Show details" }),
    );
    expect(within(priya).getByText("From the resume")).toBeTruthy();
    expect(
      within(priya)
        .getByRole("button", { name: "Hide details" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(
      within(priya).getByRole("button", { name: "Hide details" }),
    );
    expect(within(priya).queryByText("From the resume")).toBeNull();
  });
});

describe("closing the results", () => {
  it("closes on Escape and leaves the drawer open, draft and all", async () => {
    const results = await showResults();
    fireEvent.keyDown(
      within(results).getByRole("button", { name: "Hide details" }),
      { key: "Escape" },
    );
    expect(overlay().open).toBe(false);
    expect(drawer().open).toBe(true);
    expect(titles()[0].value).toBe(NEW_LOGO.title);
  });

  it("hands focus to View benchmark results, which took Retest criteria's place", async () => {
    await showResults();
    fireEvent.keyDown(overlay(), { key: "Escape" });
    expect(document.activeElement).toBe(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
  });

  it("closes on a press outside it, and not on one inside it", async () => {
    const results = await showResults();
    fireEvent.pointerDown(within(results).getByRole("table"));
    fireEvent.click(results);
    expect(overlay().open).toBe(true);

    fireEvent.pointerDown(results);
    fireEvent.click(results);
    expect(overlay().open).toBe(false);
    expect(drawer().open).toBe(true);
  });

  it("benchmarks afresh when the criteria are retested again", async () => {
    await showResults();
    fireEvent.keyDown(overlay(), { key: "Escape" });
    fireEvent.change(titles()[0], { target: { value: "New Logos" } });
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    );
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with previous candidate set",
      }),
    );
    expect(
      within(overlay()).getByRole("progressbar", {
        name: "Benchmarking criteria",
      }),
    ).toBeTruthy();
  });
});

describe("reviewing the suggested rewrites", () => {
  it("offers no rewrite until the results are reviewed", async () => {
    await showResults();
    expect(rewrite()).toBeNull();
  });

  it("closes the results and takes the recruiter back to the form", async () => {
    await reviewRewrites();
    expect(overlay().open).toBe(false);
    expect(drawer().open).toBe(true);
  });

  it("puts the rewrite under the prompt of the criterion it is for, its new clause marked", async () => {
    await reviewRewrites();
    const suggestion = rewrite()!;
    expect(suggestion.closest("li")).toBe(titles()[0].closest("li"));
    expect(titles()[0].value).toBe(NEW_LOGO.title);
    expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
    expect(suggestion.textContent).toContain(NEW_LOGO.suggestedRewrite.prompt);
    expect(
      within(suggestion).getByText(NEW_LOGO.suggestedRewrite.addedClause),
    ).toBeTruthy();
    expect(
      within(suggestion).getByRole("button", {
        name: "Apply suggested rewrite",
      }),
    ).toBeTruthy();
    expect(
      within(suggestion).getByRole("button", { name: "Ignore" }),
    ).toBeTruthy();
  });

  it("says the criteria are up to date, now they have been tested", async () => {
    await reviewRewrites();
    const form = within(drawer());
    expect(form.getByText("Up to date")).toBeTruthy();
    expect(
      form.getByRole("button", { name: "View benchmark results" }),
    ).toBeTruthy();
    expect(form.queryByRole("button", { name: "Retest criteria" })).toBeNull();
  });

  it("moves focus to the rewrite", async () => {
    await reviewRewrites();
    expect(document.activeElement).toBe(
      within(rewrite()!).getByRole("button", {
        name: "Apply suggested rewrite",
      }),
    );
  });
});

describe("retesting while the new criterion is still being typed", () => {
  it("finishes typing it first, so the whole criterion is tested", async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(
      within(drawer()).getByRole("button", { name: "Add criteria" }),
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(
      within(drawer()).getByRole("menuitem", { name: "Add custom" }),
    );
    await advance(200);
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    );
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with previous candidate set",
      }),
    );

    expect(titles()[0].value).toBe(NEW_LOGO.title);
    expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
    await advance(10_000);
    expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
  });
});

describe("applying a suggested rewrite", () => {
  async function apply() {
    await reviewRewrites();
    fireEvent.click(
      within(rewrite()!).getByRole("button", {
        name: "Apply suggested rewrite",
      }),
    );
  }

  it("puts the rewrite into the prompt, and the suggestion goes", async () => {
    await apply();
    expect(prompts()[0].value).toBe(NEW_LOGO.suggestedRewrite.prompt);
    expect(titles()[0].value).toBe(NEW_LOGO.title);
    expect(rewrite()).toBeNull();
  });

  it("leaves every other criterion as it was", async () => {
    await apply();
    const rest = CRITERIA.filter((c) => c.id !== "new-logo");
    expect(
      prompts()
        .slice(1)
        .map((field) => field.value),
    ).toEqual(rest.map((c) => c.prompt));
  });

  it("says the criteria have changed since they were tested, and offers a retest again", async () => {
    await apply();
    const form = within(drawer());
    expect(form.getByText("Criteria changed since last test")).toBeTruthy();
    expect(form.getByRole("button", { name: "Retest criteria" })).toBeTruthy();
    expect(form.queryByText("Up to date")).toBeNull();
    expect(
      form.queryByRole("button", { name: "View benchmark results" }),
    ).toBeNull();
  });

  it("moves focus to the rewritten prompt", async () => {
    await apply();
    expect(document.activeElement).toBe(prompts()[0]);
  });
});

describe("ignoring a suggested rewrite", () => {
  async function ignore() {
    await reviewRewrites();
    fireEvent.click(within(rewrite()!).getByRole("button", { name: "Ignore" }));
  }

  it("dismisses the suggestion and leaves the prompt as it was tested", async () => {
    await ignore();
    expect(rewrite()).toBeNull();
    expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
  });

  it("leaves the criteria up to date", async () => {
    await ignore();
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
  });

  it("moves focus to the prompt the suggestion was for", async () => {
    await ignore();
    expect(document.activeElement).toBe(prompts()[0]);
  });
});

describe("viewing the last benchmark results before anything has changed", () => {
  async function viewResults() {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
    return screen.getByRole("dialog", { name: "Benchmark results" });
  }

  it("shows them at once, with nothing to benchmark", async () => {
    const results = await viewResults();
    expect(results).toBe(overlay());
    expect(within(results).queryByRole("progressbar")).toBeNull();
    expect(within(results).getAllByRole("row")).toHaveLength(13);
  });

  it("evaluates each candidate on the three criteria that were running", async () => {
    const results = await viewResults();
    expect(
      within(row(results, "Renee Acheampong")).getByRole("img", {
        name: "2 of 3 criteria met",
      }),
    ).toBeTruthy();
    expect(within(row(results, "Marco Silva")).getByText("3/3")).toBeTruthy();
    expect(
      within(row(results, "Tomas Reyes")).getByText("Excluded"),
    ).toBeTruthy();
  });

  it("has no findings, and so nothing to review", async () => {
    const results = await viewResults();
    expect(within(results).queryByText("New Logo Acquisition")).toBeNull();
    expect(within(results).queryByText(/results mismatch/)).toBeNull();
    expect(
      within(results).queryByRole("button", {
        name: "Review suggested rewrites",
      }),
    ).toBeNull();
  });

  it("says every result matches its known outcome", async () => {
    const results = await viewResults();
    expect(within(results).getByText(ALL_MATCH)).toBeTruthy();
  });

  it("keeps that to the results, not the suggested candidates", async () => {
    const results = await viewResults();
    fireEvent.click(
      within(results).getByRole("tab", { name: /Suggested candidates/ }),
    );
    expect(within(results).queryByText(ALL_MATCH)).toBeNull();
  });

  it("hands focus back to View benchmark results when closed", async () => {
    await viewResults();
    fireEvent.keyDown(overlay(), { key: "Escape" });
    expect(overlay().open).toBe(false);
    expect(document.activeElement).toBe(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
  });
});

describe("retesting once the rewrite is applied", () => {
  async function retestRewrite() {
    await reviewRewrites();
    fireEvent.click(
      within(rewrite()!).getByRole("button", {
        name: "Apply suggested rewrite",
      }),
    );
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    );
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with previous candidate set",
      }),
    );
    expect(
      within(overlay()).getByRole("progressbar", {
        name: "Benchmarking criteria",
      }),
    ).toBeTruthy();
    await advance(BENCHMARKING_MS);
    return screen.getByRole("dialog", { name: "Benchmark results" });
  }

  it("finds no mismatches, and so nothing to review", async () => {
    const results = await retestRewrite();
    expect(within(results).queryByText("New Logo Acquisition")).toBeNull();
    expect(within(results).queryByText(/results mismatch/)).toBeNull();
    expect(
      within(results).queryByRole("button", {
        name: "Review suggested rewrites",
      }),
    ).toBeNull();
  });

  it("says every result matches its known outcome", async () => {
    const results = await retestRewrite();
    expect(within(results).getByText(ALL_MATCH)).toBeTruthy();
  });

  it("includes the two hires the claim test left out, and excludes the claim", async () => {
    const results = await retestRewrite();
    expect(
      within(row(results, "Dana Whitlock")).getByText("Included"),
    ).toBeTruthy();
    expect(
      within(row(results, "Dana Whitlock")).getByRole("img", {
        name: "3 of 4 criteria met",
      }),
    ).toBeTruthy();
    expect(
      within(row(results, "Priya Raman")).getByText("Included"),
    ).toBeTruthy();
    expect(
      within(row(results, "Tomas Reyes")).getByText("Excluded"),
    ).toBeTruthy();
  });

  it("leaves the criteria up to date, and View benchmark results shows this run", async () => {
    await retestRewrite();
    fireEvent.keyDown(overlay(), { key: "Escape" });
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(within(results).queryByRole("progressbar")).toBeNull();
    expect(
      within(row(results, "Dana Whitlock")).getByText("Included"),
    ).toBeTruthy();
  });
});

describe("the other ways to see results from the retest menu", () => {
  it("retests with the 12 suggested candidates — the same twelve — just as with the previous set", async () => {
    await openRetestMenu();
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with 12 suggested candidates",
      }),
    );
    expect(
      within(overlay()).getByRole("progressbar", {
        name: "Benchmarking criteria",
      }),
    ).toBeTruthy();
    await advance(BENCHMARKING_MS);
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(within(results).getAllByRole("row")).toHaveLength(13);
    expect(
      within(results).getByText(
        "3/12 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
  });

  it("opens the last results at once from View last benchmark results", async () => {
    await openRetestMenu();
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "View last benchmark results",
      }),
    );
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(within(results).queryByRole("progressbar")).toBeNull();
    expect(
      within(row(results, "Renee Acheampong")).getByRole("img", {
        name: "2 of 3 criteria met",
      }),
    ).toBeTruthy();
    expect(
      within(drawer()).getByText("Criteria changed since last test"),
    ).toBeTruthy();
  });
});

describe("the suggested candidates tab", () => {
  function tab(results: HTMLElement, name: RegExp) {
    return within(results).getByRole("tab", { name });
  }

  async function showSuggested() {
    const results = await showResults();
    fireEvent.click(tab(results, /Suggested candidates/));
    return results;
  }

  it("opens on the results, with Suggested candidates beside them", async () => {
    const results = await showResults();
    expect(
      tab(results, /Benchmark results/).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      tab(results, /Suggested candidates/).getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("lists the same twelve candidates, each with where they work and how their application ended", async () => {
    const results = await showSuggested();
    expect(
      tab(results, /Suggested candidates/).getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(results).getAllByRole("row")).toHaveLength(13);
    const renee = within(row(results, "Renee Acheampong"));
    for (const text of ["Northwind", "Account Executive", "Hired", "Oct 2024"])
      expect(renee.getByText(text)).toBeTruthy();
    const kevin = within(row(results, "Kevin Tran"));
    for (const text of ["Pellonia", "Interview", "Archived", "Sep 2025"])
      expect(kevin.getByText(text)).toBeTruthy();
    expect(
      within(row(results, "Aisha Mahmoud")).getByText("Pell & Co"),
    ).toBeTruthy();
    expect(
      within(results).getAllByRole("button", { name: "Remove" }),
    ).toHaveLength(12);
  });

  it("gives each candidate's average score before their stage outcome", async () => {
    const results = await showSuggested();
    expect(
      within(results)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["", "Name/Company", "Avg. score", "Stage outcome", "Action"]);
    expect(
      within(row(results, "Renee Acheampong")).getByText("3.4"),
    ).toBeTruthy();
    expect(within(row(results, "Tomas Reyes")).getByText("-")).toBeTruthy();
  });

  it("shows no findings and nothing to review", async () => {
    const results = await showSuggested();
    expect(within(results).queryByText(/results mismatch/)).toBeNull();
    expect(
      within(results).queryByRole("button", {
        name: "Review suggested rewrites",
      }),
    ).toBeNull();
  });

  it("goes back to the results as they were left", async () => {
    const results = await showSuggested();
    fireEvent.click(tab(results, /Benchmark results/));
    expect(
      within(row(results, "Dana Whitlock")).getByRole("button", {
        name: "Hide details",
      }),
    ).toBeTruthy();
    expect(
      within(results).getByRole("button", {
        name: "Review suggested rewrites",
      }),
    ).toBeTruthy();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const results = await showResults();
    fireEvent.keyDown(tab(results, /Benchmark results/), { key: "ArrowRight" });
    expect(
      tab(results, /Suggested candidates/).getAttribute("aria-selected"),
    ).toBe("true");
    expect(document.activeElement).toBe(tab(results, /Suggested candidates/));
    fireEvent.keyDown(tab(results, /Suggested candidates/), {
      key: "ArrowLeft",
    });
    expect(
      tab(results, /Benchmark results/).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("does not offer Candidate search", async () => {
    const results = await showResults();
    const search = tab(results, /Candidate search/);
    expect(search.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(search);
    expect(
      tab(results, /Benchmark results/).getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("the last results, once the criteria have changed since", () => {
  const STALE =
    "These results are no longer valid. Retest the criteria for up to date results.";

  async function viewStale() {
    await openRetestMenu();
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "View last benchmark results",
      }),
    );
    return screen.getByRole("dialog", { name: "Benchmark results" });
  }

  it("say they are no longer valid, and offer a retest in place of anything to review", async () => {
    const results = await viewStale();
    expect(within(results).getByText(STALE)).toBeTruthy();
    expect(within(results).queryByText(ALL_MATCH)).toBeNull();
    expect(
      within(results).getByRole("button", { name: "Retest criteria" }),
    ).toBeTruthy();
    expect(
      within(results).queryByRole("button", {
        name: "Review suggested rewrites",
      }),
    ).toBeNull();
  });

  it("retest the criteria as they are now, in the same overlay", async () => {
    const results = await viewStale();
    fireEvent.click(
      within(results).getByRole("button", { name: "Retest criteria" }),
    );
    expect(overlay().open).toBe(true);
    expect(
      within(overlay()).getByRole("progressbar", {
        name: "Benchmarking criteria",
      }),
    ).toBeTruthy();
    await advance(BENCHMARKING_MS);
    const retested = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(within(retested).queryByText(STALE)).toBeNull();
    expect(
      within(retested).getByText(
        "3/12 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
  });

  it("are not called stale while the criteria are the ones they tested", async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
    expect(within(overlay()).queryByText(STALE)).toBeNull();
    expect(
      within(overlay()).queryByRole("button", { name: "Retest criteria" }),
    ).toBeNull();
  });
});

describe("a stage tag too long for its column", () => {
  // jsdom can't show a popover; this stub stands in.
  const showPopover = vi.fn();
  beforeEach(() => {
    showPopover.mockClear();
    HTMLElement.prototype.showPopover = showPopover;
  });

  async function stageTag(name: string) {
    const results = await showResults();
    fireEvent.click(
      within(results).getByRole("tab", { name: /Suggested candidates/ }),
    );
    const cell = within(row(results, name))
      .getByText(/Archived|Hired/)
      .closest("[data-stage-tag]") as HTMLElement;
    return { results, cell };
  }

  function cutShort(tag: HTMLElement, cut: boolean) {
    Object.defineProperty(tag, "clientWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(tag, "scrollWidth", {
      configurable: true,
      value: cut ? 307 : 200,
    });
  }

  it("shows its whole outcome in a tooltip while the pointer is over it", async () => {
    const { results, cell } = await stageTag("Devon Park");
    cutShort(cell, true);
    fireEvent.pointerEnter(cell);
    const tooltip = within(results).getByRole("tooltip", { hidden: true });
    expect(tooltip.textContent).toBe(
      "Account Manager | Application Review → Archived",
    );
    expect(showPopover.mock.contexts).toEqual([tooltip]);
    fireEvent.pointerLeave(cell);
    expect(within(results).queryByRole("tooltip", { hidden: true })).toBeNull();
  });

  it("shows no tooltip when it fits", async () => {
    const { results, cell } = await stageTag("Renee Acheampong");
    cutShort(cell, false);
    fireEvent.pointerEnter(cell);
    expect(within(results).queryByRole("tooltip", { hidden: true })).toBeNull();
    expect(showPopover).not.toHaveBeenCalled();
  });
});

describe("taking candidates out of the benchmark", () => {
  const STALE =
    "These results are no longer valid. Retest the criteria for up to date results.";

  function showTab(results: HTMLElement, name: RegExp) {
    fireEvent.click(within(results).getByRole("tab", { name }));
  }

  function remove(results: HTMLElement, ...names: string[]) {
    for (const name of names)
      fireEvent.click(
        within(row(results, name)).getByRole("button", { name: "Remove" }),
      );
  }

  async function showSuggested() {
    const results = await showResults();
    showTab(results, /Suggested candidates/);
    return results;
  }

  it("keeps them in the suggested list, offering to add them back", async () => {
    const results = await showSuggested();
    remove(results, "Dana Whitlock");
    const dana = within(row(results, "Dana Whitlock"));
    expect(dana.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(dana.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(within(results).getAllByRole("row")).toHaveLength(13);
  });

  it("takes out every candidate removed in the same moment", async () => {
    const results = await showSuggested();
    const removeButton = (name: string) =>
      within(row(results, name)).getByRole("button", { name: "Remove" });
    const [dana, priya] = [
      removeButton("Dana Whitlock"),
      removeButton("Priya Raman"),
    ];
    act(() => {
      fireEvent.click(dana);
      fireEvent.click(priya);
    });
    expect(
      within(results).getByRole("heading", { name: "10 Candidates" }),
    ).toBeTruthy();
  });

  it("counts only the candidates left", async () => {
    const results = await showSuggested();
    remove(results, "Dana Whitlock");
    expect(
      within(results).getByRole("heading", { name: "11 Candidates" }),
    ).toBeTruthy();
    expect(within(results).getByText("3 Hired")).toBeTruthy();
    expect(within(results).getByText("Balanced")).toBeTruthy();
  });

  it("takes their results out of the Benchmark results, and recounts the rest", async () => {
    const results = await showSuggested();
    remove(results, "Dana Whitlock");
    showTab(results, /Benchmark results/);
    expect(
      within(results).queryByRole("row", { name: /Dana Whitlock/ }),
    ).toBeNull();
    expect(within(results).getAllByRole("row")).toHaveLength(12);
    expect(
      within(results).getByText(
        "2/11 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
  });

  it("lists one put back in the results with their score from the talent pool, and nothing from the benchmark until a retest", async () => {
    const results = await showSuggested();
    remove(results, "Dana Whitlock");
    fireEvent.click(
      within(row(results, "Dana Whitlock")).getByRole("button", {
        name: "Add",
      }),
    );
    expect(
      within(results).getByRole("heading", { name: "12 Candidates" }),
    ).toBeTruthy();
    showTab(results, /Benchmark results/);
    const dana = row(results, "Dana Whitlock");
    expect(within(dana).getByText("Hired")).toBeTruthy();
    const [, avgScore, ...benchmarked] = within(dana).getAllByRole("cell");
    expect(avgScore.textContent).toBe("3.7");
    expect(benchmarked.map((cell) => cell.textContent)).toEqual(["", "", ""]);
    expect(within(dana).queryByRole("img")).toBeNull();
    expect(within(results).getByText(STALE)).toBeTruthy();
    fireEvent.click(
      within(results).getByRole("button", { name: "Retest criteria" }),
    );
    await advance(BENCHMARKING_MS);
    const retested = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(
      within(row(retested, "Dana Whitlock")).getByText("Excluded"),
    ).toBeTruthy();
    expect(
      within(retested).getByText(
        "3/12 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
  });

  it("gives one put back the result they had, when the criteria retested are the ones that ran", async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    showTab(results, /Suggested candidates/);
    remove(results, "Tomas Reyes");
    fireEvent.click(
      within(row(results, "Tomas Reyes")).getByRole("button", { name: "Add" }),
    );
    showTab(results, /Benchmark results/);
    fireEvent.click(
      within(results).getByRole("button", { name: "Retest criteria" }),
    );
    await advance(BENCHMARKING_MS);
    const retested = screen.getByRole("dialog", { name: "Benchmark results" });
    const tomas = within(row(retested, "Tomas Reyes"));
    expect(tomas.getByText("Excluded")).toBeTruthy();
    expect(
      tomas.getByRole("img", { name: "1 of 3 criteria met" }),
    ).toBeTruthy();
    expect(within(retested).getByText(ALL_MATCH)).toBeTruthy();
  });

  it("stay out once the overlay is closed, and out of the next retest", async () => {
    await openRetestMenu();
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "View last benchmark results",
      }),
    );
    const results = screen.getByRole("dialog", { name: "Benchmark results" });
    showTab(results, /Suggested candidates/);
    remove(results, "Dana Whitlock");
    fireEvent.keyDown(overlay(), { key: "Escape" });
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Retest criteria" }),
    );
    fireEvent.click(
      within(drawer()).getByRole("menuitem", {
        name: "Retest with 11 suggested candidates",
      }),
    );
    await advance(BENCHMARKING_MS);
    const retested = screen.getByRole("dialog", { name: "Benchmark results" });
    expect(
      within(retested).queryByRole("row", { name: /Dana Whitlock/ }),
    ).toBeNull();
    expect(within(retested).queryByText(STALE)).toBeNull();
    showTab(retested, /Suggested candidates/);
    expect(
      within(row(retested, "Dana Whitlock")).getByRole("button", {
        name: "Add",
      }),
    ).toBeTruthy();
  });

  it.each([
    [
      "Hired",
      ["Renee Acheampong", "Dana Whitlock", "Marco Silva", "Priya Raman"],
    ],
    [
      "Interview → Archived",
      ["Kevin Tran", "Olivia Brennan", "Sam Okafor", "Nina Castellanos"],
    ],
    [
      "Application Review → Archived",
      ["Tomas Reyes", "Grace Lin", "Devon Park", "Aisha Mahmoud"],
    ],
  ])(
    "says when no %s candidates are left, before asking for more (Figma 115:5909)",
    async (outcome, names) => {
      const results = await showSuggested();
      remove(results, ...names);
      expect(
        within(results).getByText(`Missing ${outcome} candidates`),
      ).toBeTruthy();
      expect(within(results).getByText(`0 ${outcome}`)).toBeTruthy();
    },
  );

  it("says when more than one kind is missing (Figma 117:5944)", async () => {
    const results = await showSuggested();
    remove(
      results,
      ...["Renee Acheampong", "Dana Whitlock", "Marco Silva", "Priya Raman"],
      ...["Tomas Reyes", "Grace Lin", "Devon Park", "Aisha Mahmoud"],
    );
    expect(
      within(results).getByText("Missing multiple candidate types"),
    ).toBeTruthy();
  });

  it("asks for at least ten once fewer are left (Figma 110:5881)", async () => {
    const results = await showSuggested();
    remove(results, "Renee Acheampong", "Kevin Tran");
    expect(within(results).getByText("Balanced")).toBeTruthy();
    remove(results, "Tomas Reyes");
    expect(
      within(results).getByText("Add at least 10 candidates"),
    ).toBeTruthy();
    expect(within(results).queryByText("Balanced")).toBeNull();
  });
});

describe("acting on several candidates at once", () => {
  function showTab(results: HTMLElement, name: RegExp) {
    fireEvent.click(within(results).getByRole("tab", { name }));
  }

  function select(results: HTMLElement, ...names: string[]) {
    for (const name of names)
      fireEvent.click(
        within(results).getByRole("checkbox", { name: `Select ${name}` }),
      );
  }

  function selectAll(results: HTMLElement) {
    return within(results).getByRole("checkbox", {
      name: "Select all candidates",
    }) as HTMLInputElement;
  }

  function actions(results: HTMLElement) {
    return within(results).queryByRole("group", {
      name: "Selected candidates",
    });
  }

  function actionNames(results: HTMLElement) {
    return within(actions(results)!)
      .getAllByRole("button")
      .map((button) => button.textContent);
  }

  function action(results: HTMLElement, name: string) {
    fireEvent.click(within(actions(results)!).getByRole("button", { name }));
  }

  function rowAction(results: HTMLElement, name: string) {
    return within(row(results, name)).getByRole("button", {
      name: /^(Add|Remove)$/,
    }).textContent;
  }

  it("offers nothing until a candidate is selected, then Remove", async () => {
    const results = await showResults();
    expect(actions(results)).toBeNull();
    select(results, "Dana Whitlock");
    expect(actionNames(results)).toEqual(["Remove"]);
  });

  it("removes every selected candidate from the results at once", async () => {
    const results = await showResults();
    select(results, "Dana Whitlock", "Priya Raman");
    action(results, "Remove");
    expect(
      within(results).queryByRole("row", { name: /Dana Whitlock/ }),
    ).toBeNull();
    expect(
      within(results).queryByRole("row", { name: /Priya Raman/ }),
    ).toBeNull();
    expect(
      within(results).getByText(
        "1/10 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
    expect(actions(results)).toBeNull();
    expect(document.activeElement).toBe(selectAll(results));
    showTab(results, /Suggested candidates/);
    expect(rowAction(results, "Dana Whitlock")).toBe("Add");
    expect(rowAction(results, "Priya Raman")).toBe("Add");
  });

  it("selects every candidate from the header, and clears them again", async () => {
    const results = await showResults();
    select(results, "Dana Whitlock");
    expect(selectAll(results).checked).toBe(false);
    expect(selectAll(results).indeterminate).toBe(true);
    fireEvent.click(selectAll(results));
    const boxes = within(results)
      .getAllByRole("checkbox", { name: /^Select (?!all)/ })
      .map((box) => (box as HTMLInputElement).checked);
    expect(boxes).toEqual(Array(12).fill(true));
    expect(selectAll(results).checked).toBe(true);
    fireEvent.click(selectAll(results));
    expect(
      within(results)
        .getAllByRole("checkbox")
        .some((box) => (box as HTMLInputElement).checked),
    ).toBe(false);
    expect(actions(results)).toBeNull();
  });

  it("offers Remove, Add or both for the suggested candidates selected, by whether they are in the benchmark", async () => {
    const results = await showResults();
    showTab(results, /Suggested candidates/);
    fireEvent.click(
      within(row(results, "Dana Whitlock")).getByRole("button", {
        name: "Remove",
      }),
    );
    select(results, "Renee Acheampong");
    expect(actionNames(results)).toEqual(["Remove"]);
    select(results, "Dana Whitlock");
    expect(actionNames(results)).toEqual(["Remove", "Add"]);
    select(results, "Renee Acheampong");
    expect(actionNames(results)).toEqual(["Add"]);
  });

  it("adds back only the selected candidates that are out of the benchmark", async () => {
    const results = await showResults();
    showTab(results, /Suggested candidates/);
    for (const name of ["Dana Whitlock", "Priya Raman", "Tomas Reyes"])
      fireEvent.click(
        within(row(results, name)).getByRole("button", { name: "Remove" }),
      );
    select(
      results,
      "Renee Acheampong",
      "Dana Whitlock",
      "Priya Raman",
      "Tomas Reyes",
    );
    action(results, "Add");
    for (const name of [
      "Renee Acheampong",
      "Dana Whitlock",
      "Priya Raman",
      "Tomas Reyes",
    ])
      expect(rowAction(results, name)).toBe("Remove");
    expect(
      within(results).getByRole("heading", { name: "12 Candidates" }),
    ).toBeTruthy();
    expect(actions(results)).toBeNull();
  });

  it("removes only the selected candidates still in the benchmark", async () => {
    const results = await showResults();
    showTab(results, /Suggested candidates/);
    fireEvent.click(
      within(row(results, "Dana Whitlock")).getByRole("button", {
        name: "Remove",
      }),
    );
    select(results, "Renee Acheampong", "Dana Whitlock");
    action(results, "Remove");
    expect(rowAction(results, "Renee Acheampong")).toBe("Add");
    expect(rowAction(results, "Dana Whitlock")).toBe("Add");
    expect(
      within(results).getByRole("heading", { name: "10 Candidates" }),
    ).toBeTruthy();
  });

  it("starts each tab with nothing selected", async () => {
    const results = await showResults();
    select(results, "Dana Whitlock");
    showTab(results, /Suggested candidates/);
    expect(
      (
        within(results).getByRole("checkbox", {
          name: "Select Dana Whitlock",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(actions(results)).toBeNull();
  });
});
