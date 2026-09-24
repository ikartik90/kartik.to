// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CashbyHeader } from "../cashby-header";

afterEach(cleanup);

// The bar is scenery, bar one control: the home glyph beside the logo is the
// way back out of the prototype, to the site it sits in.
describe("CashbyHeader", () => {
  it("takes the home glyph to the site's homepage", () => {
    render(<CashbyHeader />);
    const home = screen.getByRole("link", { name: "Home" });
    expect(home.getAttribute("href")).toBe("/");
  });

  it("is the bar's only link", () => {
    render(<CashbyHeader />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
