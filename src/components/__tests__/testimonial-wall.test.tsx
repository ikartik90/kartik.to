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

function rows(n: number): Testimonial[] {
  return Array.from({ length: n }, (_, i) =>
    row({ id: `t${i + 1}`, name: `Person ${i + 1}`, quote: `Quote ${i + 1}.` }),
  );
}

const lists = () => screen.getAllByRole("list");

describe("TestimonialWall", () => {
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

    const seats = () =>
      new Map(
        // Plain DOM reads, not role queries: role queries pushed the trade tests past the time limit.
        [...document.querySelectorAll("ul")].flatMap((list, column) =>
          [...list.querySelectorAll("li")].map((card, place) => [
            card.querySelector("figcaption")?.textContent ?? "",
            `${column}:${place}`,
          ]),
        ),
      );

    const moved = (before: Map<string, string>) =>
      [...seats()].filter(([name, seat]) => before.get(name) !== seat);

    const press = () =>
      fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    const settle = () => act(() => vi.advanceTimersByTime(2000));

    it("offers a shuffle button", () => {
      render(<TestimonialWall testimonials={rows(8)} />);
      expect(screen.getByRole("button", { name: "Shuffle" })).toBeTruthy();
    });

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

    it("trades a cut-off edge card for one in the middle three columns", () => {
      // Every column in view, the outer two cut by the window's edges.
      layOut([-140, 160, 372, 584, 884]);
      render(<TestimonialWall testimonials={rows(11)} />);

      const { pairs } = trades(100);
      for (const pair of pairs) expect(pair).toMatch(/^[0][123]$|^[123]4$/);
    });

    it("trades an edge card past the window for one in the middle", () => {
      // Just past `md`: the middle column inside, its neighbours cut, the outer two off-screen.
      layOut([-320, -20, 372, 764, 1064]);
      render(<TestimonialWall testimonials={rows(11)} />);

      const { pairs } = trades(100);
      for (const pair of pairs) expect(pair).toMatch(/^[0][123]$|^[123]4$/);
    });

    // Forty turns apiece over 200 presses; the bounds are five standard deviations wide.
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

    describe("with more than eleven published", () => {
      const band = () =>
        [...document.querySelectorAll("[data-testimonial-column]")].map(
          (column) =>
            [...column.querySelectorAll("figcaption")].map(
              (caption) => caption.textContent ?? "",
            ),
        );
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

      // A caption reads the avatar's initial, then the name.
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

    it("ignores a press while a trade is still under way", () => {
      render(<TestimonialWall testimonials={rows(8)} />);
      const before = seats();

      press();
      press();
      settle();

      expect(moved(before)).toHaveLength(2);
    });

    describe("on its own", () => {
      let reduced = false;
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
        // jsdom has no stylesheet to decide band or rail, so this answers for it.
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

      it("leaves the phone's rail alone", () => {
        layout = "flex";
        render(<TestimonialWall testimonials={rows(8)} />);
        const before = seats();

        wait(30000);

        expect(moved(before)).toHaveLength(0);
      });

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

  it("holds no shader stage, now that no card has an icon", () => {
    const { container } = render(<TestimonialWall testimonials={rows(8)} />);
    expect(
      container.querySelectorAll("[data-social-shader-stage]"),
    ).toHaveLength(0);
  });
});

describe("TestimonialQuote (through the wall)", () => {
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

  it("is not a control, unlike the card on the board", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(
      within(screen.getByRole("listitem")).queryAllByRole("button"),
    ).toHaveLength(0);
  });

  it("offers a stored profile as a link", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    const link = screen.getByRole("link", { name: "Ada Lovelace on LinkedIn" });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/ada");
  });

  it("makes the card itself the only way to the profile", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("marks a card that can be followed, and only that one", () => {
    const { container } = render(
      <TestimonialWall
        testimonials={[
          row({ id: "a", linkedinUrl: "https://www.linkedin.com/in/ada" }),
          row({ id: "b", name: "Grace Hopper" }),
        ]}
      />,
    );
    // By the words, not position: the deal seats the first testimonial in the middle column.
    const marked = [...container.querySelectorAll("figure")]
      .filter((figure) => figure.hasAttribute("data-linked"))
      .map((figure) => figure.querySelector("figcaption")?.textContent);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("Ada Lovelace");
  });

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
    expect(tooltip.children).toHaveLength(3);
    expect(tooltip.firstElementChild).toBe(label);
    expect(label.querySelector("svg")).toBeNull();
    expect(tooltip.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  });

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

  it.each([1, 2, 5, 8, 40])(
    "gives the middle column exactly one card, with %i published",
    (count) => {
      expect(deal(count)[2]).toHaveLength(1);
    },
  );

  it("puts the first card in the middle, where the eye goes", () => {
    expect(deal(8)[2]).toEqual([0]);
  });

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

  it("deals the same hand from the same order", () => {
    expect(deal(8)).toEqual(deal(8));
  });
});
