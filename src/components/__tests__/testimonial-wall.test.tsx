// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Testimonial } from "@/domain/testimonial";
import { TestimonialWall, dealIntoColumns } from "../testimonial-wall";

// ---------------------------------------------------------------------------
// The band is mostly CSS — the stagger, the bleed past the screen, the overlap
// and the phone's rail are all media queries, and none of them has a failing
// state a jsdom test could see. What IS logic is the part that decides WHICH
// cards go WHERE, because the tower's clearance depends on it: the middle
// column must hold exactly one card however many are published.
//
// The geometry is verified in the browser instead, against the drawing itself:
// the tower's span is known from the viewBox, so "no card overlaps the tower"
// is a measurement rather than an opinion.
// ---------------------------------------------------------------------------

afterEach(() => cleanup());

function row(overrides: Partial<Testimonial> = {}): Testimonial {
  return {
    id: "t1",
    name: "Ada Lovelace",
    quote: "Turned a vague brief into something we could actually ship.",
    createdAt: new Date("2026-03-09T10:00:00.000Z"),
    avatarUrl: null,
    linkedinUrl: null,
    tagline: null,
    excerpt: null,
    publishedAt: new Date("2026-03-10T10:00:00.000Z"),
    ...overrides,
  };
}

/** `n` rows, each with a name and quote of its own so cards can be told apart. */
function rows(n: number): Testimonial[] {
  return Array.from({ length: n }, (_, i) =>
    row({ id: `t${i + 1}`, name: `Person ${i + 1}`, quote: `Quote ${i + 1}.` }),
  );
}

const lists = () => screen.getAllByRole("list");

describe("TestimonialWall", () => {
  // The real state of a brand new site, and of any site whose author has not
  // published anything yet — every row starts unpublished.
  it("draws nothing at all when nothing is published", () => {
    const { container } = render(<TestimonialWall testimonials={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("is a landmark with a name, since it has no heading", () => {
    render(<TestimonialWall testimonials={rows(4)} />);
    expect(screen.getByRole("region", { name: "Testimonials" })).toBeTruthy();
  });

  it("draws a card for every published testimonial", () => {
    render(<TestimonialWall testimonials={rows(8)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("Quote 8.")).toBeTruthy();
  });

  it("deals the cards into columns", () => {
    render(<TestimonialWall testimonials={rows(8)} />);
    expect(lists().length).toBeGreaterThan(1);
    const counted = lists().reduce(
      (total, list) => total + within(list).getAllByRole("listitem").length,
      0,
    );
    expect(counted).toBe(8);
  });

  // An empty `<ul>` is a list announced to anyone listening with nothing in it,
  // and a column drawn around no cards. With fewer testimonials than columns,
  // most of the columns are empty.
  it("draws no empty columns", () => {
    render(<TestimonialWall testimonials={rows(2)} />);
    for (const list of lists()) {
      expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });

  it("draws a single testimonial as one column", () => {
    render(<TestimonialWall testimonials={rows(1)} />);
    expect(lists()).toHaveLength(1);
  });

  // The wall used to carry one — a single WebGL context moved between the
  // LinkedIn icons on the cards. The icons are gone (the whole card is the link
  // now), and a context kept for nothing is a context off a budget of about
  // sixteen that the rest of the page is sharing.
  it("holds no shader stage, now that no card has an icon", () => {
    const { container } = render(<TestimonialWall testimonials={rows(8)} />);
    expect(container.querySelectorAll("[data-social-shader-stage]")).toHaveLength(
      0,
    );
  });
});

describe("TestimonialQuote (through the wall)", () => {
  // A quote attributed to somebody, in the markup HTML has for exactly that.
  // The admin board's card cannot do this — it is a button — so this is the
  // one thing the public card genuinely does differently.
  it("marks the words up as a quotation with its attribution", () => {
    const { container } = render(
      <TestimonialWall testimonials={[row({ name: "Ada Lovelace" })]} />,
    );
    const figure = container.querySelector("figure");
    expect(figure?.querySelector("blockquote")?.textContent).toContain(
      "vague brief",
    );
    expect(figure?.querySelector("figcaption")?.textContent).toContain(
      "Ada Lovelace",
    );
  });

  // Nothing on this card is pressable except a profile, so a card without one
  // contributes no controls at all.
  it("is not a control, unlike the card on the board", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // ...and where there IS a profile it is a real link, which the board's card
  // could not manage: a link inside a button is not keyboard-operable.
  it("offers a stored profile as a link", () => {
    render(
      <TestimonialWall
        testimonials={[
          row({ linkedinUrl: "https://www.linkedin.com/in/ada" }),
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "Ada Lovelace on LinkedIn" });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/ada");
  });

  // THE WHOLE CARD, not an icon in the corner of it. There is exactly one way
  // into a profile from a card, and it is the card.
  it("makes the card itself the only way to the profile", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  // Which is a fact the card has to carry, because it is what decides whether
  // the edge lights up under the pointer — a card with nothing behind it must
  // not offer.
  it("marks a card that can be followed, and only that one", () => {
    const { container } = render(
      <TestimonialWall
        testimonials={[
          row({ id: "a", linkedinUrl: "https://www.linkedin.com/in/ada" }),
          row({ id: "b", name: "Grace Hopper" }),
        ]}
      />,
    );
    // By the words on the card rather than by position: the deal puts the
    // first testimonial in the MIDDLE column, so source order is not DOM order.
    const marked = [...container.querySelectorAll("figure")]
      .filter((figure) => figure.hasAttribute("data-linked"))
      .map((figure) => figure.querySelector("figcaption")?.textContent);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("Ada Lovelace");
  });

  // `LinkedIn ∣ ↗` — the row under the homepage's intro says exactly this over
  // its LinkedIn icon, and a reader meets one tooltip for one destination
  // rather than two spellings of it. NOT the handle: the name is already the
  // largest thing on the card, and `ada` under "Ada Lovelace" is the same fact
  // spelled worse. What the tooltip adds is WHERE pressing goes.
  it("names its destination exactly as the social row does", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    expect(screen.getByText("LinkedIn")).toBeTruthy();
    expect(screen.queryByText("ada")).toBeNull();
    expect(screen.queryByText("in/ada")).toBeNull();
  });

  it("puts the goto past the hairline, as that tooltip always has", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );

    const label = screen.getByText("LinkedIn");
    const tooltip = label.parentElement!;
    // Label, hairline, goto — in that order, and nothing else in it.
    expect(tooltip.children).toHaveLength(3);
    expect(tooltip.firstElementChild).toBe(label);
    expect(label.querySelector("svg")).toBeNull();
    expect(tooltip.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  // The goto says the card opens elsewhere; it is not a second way of getting
  // there. A tooltip trailing the cursor cannot be aimed at anyway.
  it("draws the goto as a glyph, not a control", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("says nothing about a profile that was never added", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("stands in for a missing picture with the first character of the name", () => {
    render(<TestimonialWall testimonials={[row({ name: "Grace Hopper" })]} />);
    expect(screen.getByText("G")).toBeTruthy();
  });

  // The picture is DECORATIVE — the name is written beside it, so describing it
  // would say the same thing twice to anyone listening rather than looking.
  it("draws a stored picture, undescribed", () => {
    const { container } = render(
      <TestimonialWall
        testimonials={[row({ avatarUrl: "https://cdn.test/ada.jpg" })]}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/ada.jpg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  // Asked of the domain, so the board, this wall and any link preview cannot
  // disagree about which words a testimonial shows.
  it("shows the chosen excerpt rather than the whole quote", () => {
    render(<TestimonialWall testimonials={[row({ excerpt: "vague brief" })]} />);
    expect(screen.getByText("vague brief")).toBeTruthy();
    expect(screen.queryByText(/actually ship/)).toBeNull();
  });

  it("shows the tagline under the name, when there is one", () => {
    render(<TestimonialWall testimonials={[row({ tagline: "Countess" })]} />);
    expect(screen.getByText("Countess")).toBeTruthy();
  });
});


// ---------------------------------------------------------------------------
// The deal. The only real logic in the band, and the reason it matters is the
// tower: everything below the middle column has to stay clear of the antenna,
// which is only true while that column holds ONE card.
// ---------------------------------------------------------------------------

describe("dealIntoColumns", () => {
  const deal = (n: number, columns = 5) =>
    dealIntoColumns(
      Array.from({ length: n }, (_, i) => i),
      columns,
    );

  it("keeps every card, once", () => {
    expect(deal(8).flat().sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  // THE RULE THE TOWER DEPENDS ON. A second card in the middle column would
  // stack below the first and reach straight into the antenna, whatever the
  // band reserves above it.
  it.each([1, 2, 5, 8, 40])(
    "gives the middle column exactly one card, with %i published",
    (count) => {
      expect(deal(count)[2]).toHaveLength(1);
    },
  );

  it("puts the first card in the middle, where the eye goes", () => {
    expect(deal(8)[2]).toEqual([0]);
  });

  // Nearest the middle first, so a short list clusters where it can be read
  // rather than stranding cards at the edges, which are half off-screen.
  it("fills outwards from the middle", () => {
    const dealt = deal(3);
    expect(dealt[2]).toHaveLength(1);
    expect(dealt[1]).toHaveLength(1);
    expect(dealt[3]).toHaveLength(1);
    expect(dealt[0]).toHaveLength(0);
    expect(dealt[4]).toHaveLength(0);
  });

  it("spreads a full set evenly over the outer columns", () => {
    expect(deal(9).map((column) => column.length)).toEqual([2, 2, 1, 2, 2]);
  });

  // THE THIRD ROW GOES TO THE EDGES. Two rows fill from the middle out; past
  // that the outermost columns take their third card first, because they are
  // the ones with room for it — the stagger starts them at the top of the band
  // and steps every column inwards further down, so depth is cheapest at the
  // edges and most expensive over the tower.
  it.each([
    [10, [3, 2, 1, 2, 2]],
    [11, [3, 2, 1, 2, 3]],
    [12, [3, 3, 1, 2, 3]],
    [13, [3, 3, 1, 3, 3]],
  ])("gives the edges the third card, with %i published", (count, shape) => {
    expect(deal(count).map((column) => column.length)).toEqual(shape);
  });

  // ...and holds them there. Anything past a third row goes back to filling
  // from the middle out, so the edges stop at three while there is a band's
  // worth of cards to deal.
  it("keeps the outermost columns to three", () => {
    for (let count = 10; count <= 13; count++) {
      const dealt = deal(count);
      expect(dealt[0].length).toBeLessThanOrEqual(3);
      expect(dealt[4].length).toBeLessThanOrEqual(3);
    }
  });

  it.each([10, 11, 12, 13])("still deals every card once, with %i", (count) => {
    expect(
      deal(count)
        .flat()
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: count }, (_, i) => i));
  });

  it("has a column for every column, even with nothing to put in them", () => {
    expect(deal(0)).toEqual([[], [], [], [], []]);
  });

  // Deterministic: the server and the client deal the same hand from the same
  // order, so hydration matches and the rotation moves cards by reordering the
  // list rather than by dealing it differently.
  it("deals the same hand from the same order", () => {
    expect(deal(8)).toEqual(deal(8));
  });
});
