// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArticleIntro } from "../article-intro";

describe("ArticleIntro", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title and the Home back link", () => {
    render(<ArticleIntro title="Hello World" />);

    expect(screen.getByRole("heading", { name: "Hello World" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
  });

  it("still renders the Home back link when there is no title", () => {
    render(<ArticleIntro />);

    expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("omits the heading for an empty or null title", () => {
    const { rerender } = render(<ArticleIntro title="" />);
    expect(screen.queryByRole("heading")).toBeNull();

    rerender(<ArticleIntro title={null} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
  });
});
