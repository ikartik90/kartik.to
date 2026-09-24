// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("is a landmark named by its heading", () => {
    render(<TestimonialWall testimonials={rows(4)} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Music to my ears" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Music to my ears" }),
    ).toBeTruthy();
  });

  it("carries its subheading under the heading", () => {
    render(<TestimonialWall testimonials={rows(4)} />);
    expect(
      screen.getByText(
        "Affirmations from those who have worked closely with me",
      ),
    ).toBeTruthy();
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

  describe("shuffle", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    /** Where every card is, by name: column, then place in the column. */
    const seats = () =>
      new Map(
        lists().flatMap((list, column) =>
          within(list)
            .getAllByRole("listitem")
            .map((card, place) => [
              card.querySelector("figcaption")?.textContent ?? "",
              `${column}:${place}`,
            ]),
        ),
      );

    /** The cards sitting somewhere other than where they were. */
    const moved = (before: Map<string, string>) =>
      [...seats()].filter(([name, seat]) => before.get(name) !== seat);

    const press = () =>
      fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    // The fade out, the trade and the fade back in, with room to spare.
    const settle = () => act(() => vi.advanceTimersByTime(2000));

    it("offers a shuffle button", () => {
      render(<TestimonialWall testimonials={rows(8)} />);
      expect(screen.getByRole("button", { name: "Shuffle" })).toBeTruthy();
    });

    // ONE TRADE A PRESS, the same exchange the band has always made: two cards
    // swap seats and nothing else moves.
    it("trades two cards on each press", () => {
      render(<TestimonialWall testimonials={rows(8)} />);
      const before = seats();

      press();
      settle();

      const changed = moved(before);
      expect(changed).toHaveLength(2);
      const [[a, seatOfA], [b, seatOfB]] = changed;
      expect(seatOfA).toBe(before.get(b));
      expect(seatOfB).toBe(before.get(a));
    });

    it("trades again on the next press", () => {
      render(<TestimonialWall testimonials={rows(8)} />);

      press();
      settle();
      const before = seats();
      press();
      settle();

      expect(moved(before)).toHaveLength(2);
    });

    /** Lay the five columns out at these left edges, 280px wide each, in
     *  jsdom's 1024px window. */
    const layOut = (left: number[]) =>
      vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          const list = this.parentElement;
          const column = [...(list?.parentElement?.children ?? [])].indexOf(
            list as Element,
          );
          const card = this.matches("li");
          return DOMRect.fromRect({
            x: card ? left[column] : 0,
            width: card ? 280 : 0,
          });
        });

    /** Press `times` times and collect every trade as its two seats' columns,
     *  and how often each seat was traded. */
    const trades = (times: number) => {
      const pairs: string[] = [];
      const turns = new Map<string, number>();
      for (let i = 0; i < times; i++) {
        const before = seats();
        press();
        settle();
        const traded = moved(before).map(([name]) => before.get(name) ?? "");
        pairs.push(
          traded
            .map((seat) => seat.split(":")[0])
            .sort()
            .join(""),
        );
        for (const seat of traded) turns.set(seat, (turns.get(seat) ?? 0) + 1);
      }
      return { pairs, turns };
    };

    // THE EDGES TRADE WITH THE MIDDLE, NEVER WITH EACH OTHER. The outer two
    // columns are the ones the window cuts off, and the whole point of a trade
    // is to bring one of those cards forward. Swapping two of them — a hidden
    // one for a half-cut one in the same column — moved a card from one place
    // nobody could read it to another.
    it("trades a cut-off edge card for one in the middle three columns", () => {
      // Every column in view, the outer two cut by the window's edges.
      layOut([-140, 160, 372, 584, 884]);
      render(<TestimonialWall testimonials={rows(11)} />);

      const { pairs } = trades(100);
      for (const pair of pairs) expect(pair).toMatch(/^[0][123]$|^[123]4$/);
    });

    it("trades an edge card past the window for one in the middle", () => {
      // Just past `md`: the middle column inside, its neighbours cut, the
      // outer two past the edges entirely.
      layOut([-320, -20, 372, 764, 1064]);
      render(<TestimonialWall testimonials={rows(11)} />);

      const { pairs } = trades(100);
      for (const pair of pairs) expect(pair).toMatch(/^[0][123]$|^[123]4$/);
    });

    // EVERY MIDDLE CARD TAKES AN EQUAL TURN. The centre column's one card and
    // the two in each of its neighbours: five seats, forty turns apiece over
    // two hundred presses. The bounds are five standard deviations wide.
    it("gives every card in the middle three columns the same turns", () => {
      layOut([-320, -20, 372, 764, 1064]);
      render(<TestimonialWall testimonials={rows(11)} />);

      const { turns } = trades(200);
      const middle = [...turns].filter(([seat]) => /^[123]:/.test(seat));
      expect(middle.map(([seat]) => seat).sort()).toEqual([
        "1:0",
        "1:1",
        "2:0",
        "3:0",
        "3:1",
      ]);
      for (const [, count] of middle) {
        expect(count).toBeGreaterThan(10);
        expect(count).toBeLessThan(90);
      }
    });

    // ELEVEN ON THE BAND, THE REST IN A QUEUE. A trade moves the cut-off edge
    // card into the middle, sends the middle card to the back of the queue, and
    // brings the card at the front of the queue in at the edge — so every card
    // goes waiting → edge → middle → waiting, and all of them are read in turn.
    describe("with more than eleven published", () => {
      /** The names in each band column, left to right. */
      const band = () =>
        [...document.querySelectorAll("[data-testimonial-column]")].map(
          (column) =>
            [...column.querySelectorAll("figcaption")].map(
              (caption) => caption.textContent ?? "",
            ),
        );
      /** The names waiting off the band, in queue order. */
      const queue = () =>
        [
          ...document.querySelectorAll(
            "ul:not([data-testimonial-column]) figcaption",
          ),
        ].map((caption) => caption.textContent ?? "");

      it("shows eleven at a time, dealt 3·2·1·2·3", () => {
        render(<TestimonialWall testimonials={rows(13)} />);
        expect(band().map((column) => column.length)).toEqual([3, 2, 1, 2, 3]);
      });

      // The phone's rail swipes through every card and never trades, so the
      // two waiting there would otherwise be out of reach for good.
      // (A caption reads the avatar's initial, then the name.)
      it("keeps the rest in the document for the phone's rail", () => {
        render(<TestimonialWall testimonials={rows(13)} />);
        expect(queue()).toEqual(["PPerson 12", "PPerson 13"]);
        expect(screen.getAllByRole("listitem")).toHaveLength(13);
      });

      it("moves the edge card to the middle and the queue's first to the edge", () => {
        layOut([-320, -20, 372, 764, 1064]);
        render(<TestimonialWall testimonials={rows(13)} />);
        const before = band();
        const waiting = queue();

        press();
        settle();

        const after = band();
        const edgeSeat = [0, 4]
          .flatMap((c) => before[c].map((name, place) => [c, place] as const))
          .find(([c, place]) => after[c][place] !== before[c][place]);
        const middleSeat = [1, 2, 3]
          .flatMap((c) => before[c].map((name, place) => [c, place] as const))
          .find(([c, place]) => after[c][place] !== before[c][place]);
        if (!edgeSeat || !middleSeat) throw new Error("nothing traded");

        const [ec, ep] = edgeSeat;
        const [mc, mp] = middleSeat;
        expect(after[mc][mp]).toBe(before[ec][ep]);
        expect(after[ec][ep]).toBe(waiting[0]);
        expect(queue()).toEqual([waiting[1], before[mc][mp]]);
      });

      it("brings every card to the middle in time", () => {
        layOut([-320, -20, 372, 764, 1064]);
        render(<TestimonialWall testimonials={rows(13)} />);
        const read = new Set(band().slice(1, 4).flat());

        for (let i = 0; i < 200; i++) {
          press();
          settle();
          for (const name of band().slice(1, 4).flat()) read.add(name);
        }

        expect(read.size).toBe(13);
      });
    });

    // A press while two cards are still faded out would start a second trade
    // over the first, and the band would move four cards — or put the first two
    // straight back.
    it("ignores a press while a trade is still under way", () => {
      render(<TestimonialWall testimonials={rows(8)} />);
      const before = seats();

      press();
      press();
      settle();

      expect(moved(before)).toHaveLength(2);
    });

    // THE BUTTON IS AS WELL AS THE TIMER, NOT INSTEAD OF IT. Left alone the
    // band still trades a card every eight seconds; the button only lets a
    // reader ask for one sooner.
    describe("on its own", () => {
      /** Whether the reader has asked for reduced motion. */
      let reduced = false;
      /** What the stylesheet has made of the wall: the band, or the rail. */
      let layout = "grid";

      beforeEach(() => {
        reduced = false;
        layout = "grid";
        vi.stubGlobal(
          "matchMedia",
          vi.fn((query: string) => ({
            matches: query.includes("reduced-motion") && reduced,
          })),
        );
        // The band, not the phone's rail: the stylesheet decides which, and
        // jsdom has no stylesheet to ask.
        const real = window.getComputedStyle.bind(window);
        vi.spyOn(window, "getComputedStyle").mockImplementation(
          (element, pseudo) => {
            const style = real(element, pseudo);
            return new Proxy(style, {
              get: (target, key) =>
                key === "display" ? layout : Reflect.get(target, key, target),
            });
          },
        );
      });
      afterEach(() => vi.unstubAllGlobals());

      const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
      const wall = () => lists()[0].parentElement as HTMLElement;

      it("trades two cards every eight seconds", () => {
        render(<TestimonialWall testimonials={rows(8)} />);
        const before = seats();

        wait(7000);
        expect(moved(before)).toHaveLength(0);

        wait(1000);
        settle();
        expect(moved(before)).toHaveLength(2);
      });

      it("keeps trading after the first", () => {
        render(<TestimonialWall testimonials={rows(8)} />);
        wait(8000);
        settle();
        const before = seats();

        wait(6000);
        settle();

        expect(moved(before)).toHaveLength(2);
      });

      // A reader in the middle of a card must not have it taken away.
      it("holds still while the pointer rests on the cards", () => {
        render(<TestimonialWall testimonials={rows(8)} />);
        const before = seats();

        fireEvent.pointerEnter(wall());
        wait(30000);

        expect(moved(before)).toHaveLength(0);
      });

      it("holds still while focus is inside the cards", () => {
        render(
          <TestimonialWall
            testimonials={rows(8).map((testimonial) => ({
              ...testimonial,
              linkedinUrl: "https://www.linkedin.com/in/someone",
            }))}
          />,
        );
        const before = seats();

        fireEvent.focus(within(wall()).getAllByRole("link")[0]);
        wait(30000);

        expect(moved(before)).toHaveLength(0);
      });

      it("never moves a card unasked for a reader who wants less motion", () => {
        reduced = true;
        render(<TestimonialWall testimonials={rows(8)} />);
        const before = seats();

        wait(30000);

        expect(moved(before)).toHaveLength(0);
      });

      // The phone's rail is swiped by the reader, who can reach every card that
      // way — and a card swapped out from under a thumb is worse than none.
      it("leaves the phone's rail alone", () => {
        layout = "flex";
        render(<TestimonialWall testimonials={rows(8)} />);
        const before = seats();

        wait(30000);

        expect(moved(before)).toHaveLength(0);
      });

      // A press starts the countdown again, so the band never trades a card on
      // its own a moment after the reader asked for one.
      it("waits a full eight seconds after a press", () => {
        render(<TestimonialWall testimonials={rows(8)} />);
        wait(6000);
        const before = seats();

        press();
        wait(7000);

        expect(moved(before)).toHaveLength(2);
      });
    });
  });

  // The wall used to carry one — a single WebGL context moved between the
  // LinkedIn icons on the cards. The icons are gone (the whole card is the link
  // now), and a context kept for nothing is a context off a budget of about
  // sixteen that the rest of the page is sharing.
  it("holds no shader stage, now that no card has an icon", () => {
    const { container } = render(<TestimonialWall testimonials={rows(8)} />);
    expect(
      container.querySelectorAll("[data-social-shader-stage]"),
    ).toHaveLength(0);
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
  // contributes no controls at all. The band's own shuffle is not the card's.
  it("is not a control, unlike the card on the board", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(
      within(screen.getByRole("listitem")).queryAllByRole("button"),
    ).toHaveLength(0);
  });

  // ...and where there IS a profile it is a real link, which the board's card
  // could not manage: a link inside a button is not keyboard-operable.
  it("offers a stored profile as a link", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
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
    render(
      <TestimonialWall testimonials={[row({ excerpt: "vague brief" })]} />,
    );
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
    expect(
      deal(8)
        .flat()
        .sort((a, b) => a - b),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
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

  // THE SHAPE PAST NINE IS 3·2·1·2·3. Two rows fill from the middle out; every
  // card after that goes to the outermost columns, because they are the ones
  // with room for it — the stagger starts them at the top of the band and steps
  // every column inwards further down. The columns either side of the tower
  // stop at two, and the tower's own at one, however many are published.
  it.each([
    [10, [3, 2, 1, 2, 2]],
    [11, [3, 2, 1, 2, 3]],
    [12, [4, 2, 1, 2, 3]],
    [13, [4, 2, 1, 2, 4]],
  ])(
    "gives the edges every card past nine, with %i published",
    (count, shape) => {
      expect(deal(count).map((column) => column.length)).toEqual(shape);
    },
  );

  it("keeps the columns beside the tower to two", () => {
    for (let count = 9; count <= 40; count++) {
      const dealt = deal(count);
      expect(dealt[1]).toHaveLength(2);
      expect(dealt[3]).toHaveLength(2);
    }
  });

  it.each([10, 11, 12, 13, 40])(
    "still deals every card once, with %i",
    (count) => {
      expect(
        deal(count)
          .flat()
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: count }, (_, i) => i));
    },
  );

  it("has a column for every column, even with nothing to put in them", () => {
    expect(deal(0)).toEqual([[], [], [], [], []]);
  });

  // Deterministic: the server and the client deal the same hand from the same
  // order, so hydration matches and the shuffle moves cards by reordering the
  // list rather than by dealing it differently.
  it("deals the same hand from the same order", () => {
    expect(deal(8)).toEqual(deal(8));
  });
});
