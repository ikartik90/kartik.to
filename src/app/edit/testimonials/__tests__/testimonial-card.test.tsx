import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Testimonial } from "@/domain/testimonial";
import { TestimonialCard } from "../testimonial-card";

afterEach(() => cleanup());

// Typed as the row: inferred `null` literals would reject every override below.
const testimonial: Testimonial = {
  id: "t1",
  name: "Ada Lovelace",
  quote: "Turned a vague brief into something we could actually ship.",
  createdAt: new Date("2026-03-09T10:00:00.000Z"),
  avatarUrl: null,
  linkedinUrl: null,
  tagline: null,
  excerpt: null,
  publishedAt: null,
};

function draw(overrides: Partial<Testimonial> = {}, onSelect = vi.fn()) {
  const { container } = render(
    <TestimonialCard
      testimonial={{ ...testimonial, ...overrides }}
      selected={false}
      onSelect={onSelect}
    />,
  );
  return { onSelect, container };
}

describe("TestimonialCard", () => {
  it("shows the words and the name", () => {
    draw();

    expect(screen.getByText(testimonial.quote)).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("puts the name above the words", () => {
    const { container } = draw();

    const name = screen.getByText("Ada Lovelace");
    const quote = screen.getByText(testimonial.quote);
    expect(
      name.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByRole("button").textContent).toBe("");
  });

  it("draws the whole quote, however long, when there is no excerpt", () => {
    const long = "x".repeat(280);
    draw({ quote: long });

    expect(screen.getByText(long).textContent).toHaveLength(280);
  });

  it("shows the excerpt in place of the whole quote", () => {
    draw({ excerpt: "something we could actually ship" });

    expect(screen.getByText("something we could actually ship")).toBeTruthy();
    expect(screen.queryByText(testimonial.quote)).toBeNull();
  });

  it("does not print the date", () => {
    draw();

    expect(screen.queryByText("9 Mar 2026")).toBeNull();
    expect(screen.queryByText(/2026/)).toBeNull();
  });

  it("is one button that selects the row", async () => {
    const { onSelect } = draw();

    await userEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("says which card the rail is on", () => {
    const { rerender } = render(
      <TestimonialCard
        testimonial={testimonial}
        selected
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");

    rerender(
      <TestimonialCard
        testimonial={testimonial}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("stands an initial in for a picture that has not been added", () => {
    const { container } = draw();

    expect(screen.getByText("A")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the picture once there is one", () => {
    const { container } = draw({
      avatarUrl: "https://cdn.example.com/media/ada.jpg",
    });

    const picture = container.querySelector("img");
    expect(picture?.getAttribute("src")).toBe(
      "https://cdn.example.com/media/ada.jpg",
    );
    expect(screen.queryByText("A")).toBeNull();
  });

  it("leaves the picture out of the accessibility tree", () => {
    draw({ avatarUrl: "https://cdn.example.com/media/ada.jpg" });

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("writes the tagline under the name", () => {
    draw({ tagline: "Analyst, Analytical Engine" });

    expect(screen.getByText("Analyst, Analytical Engine")).toBeTruthy();
  });

  it("draws no second line when there is no tagline", () => {
    draw();

    expect(screen.queryByText(/Analyst/)).toBeNull();
  });

  it("offers a stored profile as a link to it", () => {
    draw({ linkedinUrl: "https://www.linkedin.com/in/ada-lovelace" });

    const link = screen.getByRole("link", { name: /ada lovelace on linkedin/i });
    expect(link.getAttribute("href")).toBe(
      "https://www.linkedin.com/in/ada-lovelace",
    );
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("draws no profile link at all when there is none", () => {
    draw();

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps the profile link outside the button that selects the row", () => {
    draw({ linkedinUrl: "https://www.linkedin.com/in/ada" });

    const select = screen.getByRole("button", { name: /ada lovelace/i });
    expect(select.querySelector("a")).toBeNull();
    expect(screen.getByRole("link")).toBeTruthy();
  });

  it("does not select the row when the profile link is pressed", async () => {
    const { onSelect } = draw({
      linkedinUrl: "https://www.linkedin.com/in/ada",
    });

    await userEvent.click(screen.getByRole("link"));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
