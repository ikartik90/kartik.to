// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { linkCard } from "../../../styled-system/recipes";
import { LinkCard } from "../link-card";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";

describe("LinkCard", () => {
  afterEach(cleanup);

  it("offers exactly the shapes the app's one ratio map defines", () => {
    // The card has no ratio list of its own — the recipe derives its `aspect`
    // variant from `ASPECT_RATIOS`, so a twelfth ratio is one line in one file.
    // The two sides of this are genuinely independent artefacts (the runtime
    // map in src/utils, and the variant metadata Panda generates out of
    // panda.config.ts), so forking one is what makes them disagree. Asserting
    // the CLASS a given `aspect` renders would not catch it: the recipe
    // function builds `--aspect_<value>` from the prop without consulting the
    // variant map at all, so an undeclared ratio names a class that no
    // stylesheet ever emitted and the DOM looks perfectly correct.
    expect(linkCard.variantMap.aspect).toEqual(Object.keys(ASPECT_RATIOS));
  });

  it("is a link to where it points, named by its title", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="16/9" />);

    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.getAttribute("href")).toBe("/work/atlas");
  });

  it("is ONE box at the shape it declares, with the title inside it", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    // The card used to be a shaped cover with the title stacked in a column
    // underneath it, so what is worth pinning is WHICH element wears the shape:
    // the whole card, with the words inside it, not an inner box the words sit
    // below. Put the ratio back on a child and this reads it off the wrong
    // element and fails.
    const link = screen.getByRole("link", { name: "Atlas" });
    expect(link.className).toContain("link-card__root--aspect_3/2");
    expect(link.querySelector("h2")?.textContent).toBe("Atlas");
  });

  it("carries a date over the cover when it is given one", () => {
    render(
      <LinkCard
        href="/writing/on-frames"
        title="On frames"
        aspect="3/2"
        date="21 August 2026"
      />,
    );

    const link = screen.getByRole("link");
    expect(link.contains(screen.getByText("21 August 2026"))).toBe(true);
  });

  it("says nothing but its title when there is no date", () => {
    render(<LinkCard href="/work/atlas" title="Atlas" aspect="3/2" />);

    // A listing without dates — the projects one — must not get an empty meta
    // line reserving space for something it will never have.
    expect(screen.getByRole("link").textContent).toBe("Atlas");
  });
});
