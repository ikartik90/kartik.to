// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProjectsSection } from "../projects-section";
import type { Post } from "@/domain/post";

const post = (n: number): Post => ({
  id: `p${n}`,
  title: `Project ${n}`,
  slug: `project-${n}`,
  category: "WORK",
  publishedAt: new Date("2025-01-01"),
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  content: {
    type: "doc",
    content: [
      { type: "paragraph", children: [{ type: "text", text: `Blurb ${n}.` }] },
    ],
  },
});

const posts = (count: number) =>
  Array.from({ length: count }, (_, i) => post(i + 1));

/** The ceiling the grid was rendered with, as CSS reads it. */
const columnsOf = (count: number) => {
  const { container } = render(<ProjectsSection projects={posts(count)} />);
  return container.querySelector("[data-columns]")?.getAttribute("data-columns");
};

describe("ProjectsSection", () => {
  afterEach(cleanup);

  it("renders every project as a link to its own page", () => {
    render(<ProjectsSection projects={posts(3)} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toBe("/work/project-1");
  });

  it("sizes the grid to the set — a lone card takes it whole", () => {
    expect(columnsOf(1)).toBe("1");
  });

  it("splits two and four in half rather than leaving a ragged row", () => {
    expect(columnsOf(2)).toBe("2");
    expect(columnsOf(4)).toBe("2");
  });

  it("runs three-up for three and for anything past four", () => {
    expect(columnsOf(3)).toBe("3");
    expect(columnsOf(5)).toBe("3");
    expect(columnsOf(8)).toBe("3");
  });

  it("stays a valid grid with nothing to show", () => {
    expect(columnsOf(0)).toBe("1");
  });
});
