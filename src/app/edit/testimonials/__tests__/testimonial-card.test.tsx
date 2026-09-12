import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Testimonial } from "@/domain/testimonial";
import { TestimonialCard } from "../testimonial-card";

// ---------------------------------------------------------------------------
// The card is mostly a layout, and a layout has no failing state worth
// asserting. What IS worth asserting is everything it DERIVES: the initial it
// falls back to, the profile it turns into a link, and the halves of a row that
// are allowed to be absent. Each one is a small piece of logic that would
// otherwise only be checked by looking at it.
// ---------------------------------------------------------------------------

afterEach(() => cleanup());

// Typed as the row rather than inferred from the literal: with `null` literals
// in it, `Partial<typeof testimonial>` would infer `null | undefined` and
// refuse every override below.
const testimonial: Testimonial = {
  id: "t1",
  name: "Ada Lovelace",
  quote: "Turned a vague brief into something we could actually ship.",
  createdAt: new Date("2026-03-09T10:00:00.000Z"),
  avatarUrl: null,
  linkedinUrl: null,
  tagline: null,
  excerpt: null,
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

  // Who said it comes FIRST. Asserted on document order rather than on styling,
  // because that is the half that survives a stylesheet and the half a screen
  // reader follows.
  it("puts the name above the words", () => {
    const { container } = draw();

    const name = screen.getByText("Ada Lovelace");
    const quote = screen.getByText(testimonial.quote);
    expect(
      name.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The byline is the card's first block — the button beside it is an empty
    // overlay and holds no words at all.
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe(
      "BUTTON",
    );
    expect(screen.getByRole("button").textContent).toBe("");
  });

  // Whatever the card is showing, it shows ALL of it. Clamping would hide the
  // end of the very words the board exists to show — and now that a long one
  // can be excerpted by hand, there is nothing left for a clamp to do.
  it("draws the whole quote, however long, when there is no excerpt", () => {
    const long = "x".repeat(280);
    draw({ quote: long });

    expect(screen.getByText(long).textContent).toHaveLength(280);
  });

  // The excerpt is the POINT of the card: a wall of six full testimonials is
  // unreadable, so the chosen portion is what gets drawn.
  it("shows the excerpt in place of the whole quote", () => {
    draw({ excerpt: "something we could actually ship" });

    expect(screen.getByText("something we could actually ship")).toBeTruthy();
    expect(screen.queryByText(testimonial.quote)).toBeNull();
  });

  // The row HAS a `createdAt` and the card does not draw it — the board is read
  // by the words and the face, and the arrival order is already the list's
  // order. Asserted rather than left implicit, because "we removed the date" is
  // exactly the kind of thing a later refactor puts back by accident.
  it("does not print the date", () => {
    draw();

    expect(screen.queryByText("9 Mar 2026")).toBeNull();
    expect(screen.queryByText(/2026/)).toBeNull();
  });

  // The whole card is the target, and it has to be a real button — the rail it
  // opens has to be reachable without a mouse.
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

  // A row arrives with no picture and may keep none, so the empty avatar is the
  // NORMAL state rather than a loading one — it holds its circle and says whose
  // it is.
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

  // Queried by ROLE rather than by tag, and that is the assertion: the name is
  // written immediately beside the picture, so a described one would say the
  // same thing twice to anyone listening rather than looking. An empty `alt`
  // takes it out of the accessibility tree entirely, which is why the test
  // above has to reach for the element itself.
  it("leaves the picture out of the accessibility tree", () => {
    draw({ avatarUrl: "https://cdn.example.com/media/ada.jpg" });

    expect(screen.queryByRole("img")).toBeNull();
  });

  // WHO THEY ARE, under their name — the line the card used to spend on a
  // profile path.
  it("writes the tagline under the name", () => {
    draw({ tagline: "Analyst, Analytical Engine" });

    expect(screen.getByText("Analyst, Analytical Engine")).toBeTruthy();
  });

  it("draws no second line when there is no tagline", () => {
    draw();

    expect(screen.queryByText(/Analyst/)).toBeNull();
  });

  // The profile is a LINK now, and named for whose it is: a board of twelve
  // cards would otherwise be twelve links all called "LinkedIn".
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

  // The card is still one press away from the rail, and the link is still a
  // link: a link nested inside a button is not keyboard-operable in any
  // browser, so the two are SIBLINGS — the button holds the card's content and
  // the link sits over its corner.
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
