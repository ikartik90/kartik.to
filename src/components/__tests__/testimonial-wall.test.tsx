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
import { scrollIntoView } from "@/test-support";
import { TestimonialWall, loopRun } from "../testimonial-wall";

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

const section = () => screen.getByRole("region", { name: "Music to my ears" });
const scroller = () => section().querySelector<HTMLElement>("[data-testimonial-strip]")!;
const columns = () => [...scroller().firstElementChild!.children] as HTMLElement[];
const quotes = (column: Element) =>
  [...column.querySelectorAll("blockquote")].map((quote) => quote.textContent);
/** The cards a reader meets; the loop's copies are hidden from them. */
const readable = () =>
  [...document.querySelectorAll("figure")].filter((figure) => !figure.closest("[aria-hidden]"));

describe("TestimonialWall", () => {
  it("draws nothing at all when nothing is published", () => {
    const { container } = render(<TestimonialWall testimonials={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("is a landmark named by its heading, which only screen readers meet, with no subheading", () => {
    render(<TestimonialWall testimonials={rows(4)} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Music to my ears" }),
    ).toBeTruthy();
    expect(section()).toBeTruthy();
    expect(section().querySelector("header")).toBeNull();
    expect(screen.queryByText("Affirmations from those who have worked closely with me")).toBeNull();
  });

  it("has nothing to shuffle", () => {
    render(<TestimonialWall testimonials={rows(8)} />);
    expect(screen.queryByRole("button", { name: "Shuffle" })).toBeNull();
  });

  it("stacks the cards two to a column, in the order they were published", () => {
    render(<TestimonialWall testimonials={rows(8)} />);
    expect(quotes(columns()[0])).toEqual(["Quote 1.", "Quote 2."]);
    expect(quotes(columns()[1])).toEqual(["Quote 3.", "Quote 4."]);
  });

  it("gives every column two cards, an odd count included", () => {
    render(<TestimonialWall testimonials={rows(13)} />);
    for (const column of columns()) expect(quotes(column)).toHaveLength(2);
  });

  it("lets a reader meet each testimonial once, in order", () => {
    render(<TestimonialWall testimonials={rows(13)} />);
    expect(
      readable().map((figure) => figure.querySelector("blockquote")?.textContent),
    ).toEqual(rows(13).map((testimonial) => testimonial.quote));
  });

  it("lays a mesh under every card, in Cosmic Track's colours in turn", () => {
    render(<TestimonialWall testimonials={rows(5)} />);
    const cards = readable();
    expect(cards.map((figure) => figure.getAttribute("data-tint"))).toEqual(["1", "2", "3", "1", "2"]);
    for (const figure of cards) {
      expect(figure.querySelector("[data-mesh]")?.getAttribute("aria-hidden")).toBe("true");
      // Over the whole card, not only the mesh.
      expect(figure.querySelector(":scope > [data-grain]")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("varies the mesh's wave from card to card, five in turn", () => {
    render(<TestimonialWall testimonials={rows(6)} />);
    const cards = readable();
    expect(cards.map((figure) => figure.getAttribute("data-shape"))).toEqual(["1", "2", "3", "4", "5", "1"]);
  });

  it("never gives two neighbours the same mesh", () => {
    render(<TestimonialWall testimonials={rows(13)} />);
    const look = (figure: Element | null) =>
      `${figure?.getAttribute("data-tint")}/${figure?.getAttribute("data-shape")}`;
    const grid = columns().map((column) => [...column.querySelectorAll("figure")]);
    grid.forEach((column, x) => {
      expect(look(column[0])).not.toBe(look(column[1]));
      if (grid[x + 1]) {
        expect(look(column[0])).not.toBe(look(grid[x + 1][0]));
        expect(look(column[1])).not.toBe(look(grid[x + 1][1]));
      }
    });
  });

  it("drops each column, both its cards together, by 20, 40, 60 or 80px, no two neighbours alike", () => {
    render(<TestimonialWall testimonials={rows(13)} />);
    const drops = columns().map((column) => column.getAttribute("data-stagger"));
    expect(new Set(drops)).toEqual(new Set(["20", "40", "60", "80"]));
    // Across the loop's seams too: the columns run on into the next copy.
    drops.forEach((drop, x) => x && expect(drop).not.toBe(drops[x - 1]));
    // Not a plain 20, 40, 60, 80 in turn.
    expect(drops.slice(0, 4)).not.toEqual(["20", "40", "60", "80"]);
  });

  it("takes the copies out of the tab order", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    const copies = [...document.querySelectorAll("figure")]
      .map((figure) => figure.closest("[aria-hidden]"))
      .filter((copy) => copy !== null);
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) expect(copy.hasAttribute("inert")).toBe(true);
  });

  describe("drift", () => {
    // One run of the loop is 1000px wide in this fake layout.
    const RUN = 1000;
    let animations: {
      target: Element;
      keyframes: Keyframe[];
      options: KeyframeAnimationOptions;
      state: "running" | "paused" | "idle";
    }[] = [];
    let reduced = false;

    beforeEach(() => {
      vi.useFakeTimers();
      animations = [];
      reduced = false;
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: query.includes("reduced-motion") && reduced,
        })),
      );
      HTMLElement.prototype.animate = function (
        this: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ) {
        const record = { target: this, keyframes, options, state: "running" as const };
        animations.push(record);
        return {
          pause: () => void ((record as { state: string }).state = "paused"),
          play: () => void ((record as { state: string }).state = "running"),
          cancel: () => void ((record as { state: string }).state = "idle"),
          currentTime: 0,
          effect: { getComputedTiming: () => ({ progress: 0 }) },
        } as unknown as Animation;
      } as unknown as HTMLElement["animate"];
      vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
        function (this: HTMLElement) {
          const run = this.dataset.runStart;
          return run === undefined ? 0 : Number(run) * RUN;
        },
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    });

    const drift = () => animations.find(({ state }) => state !== "idle");

    it("moves right to left a run at a time, slowly and without end", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      const { target, keyframes, options } = drift()!;
      expect(target).toBe(scroller().firstElementChild);
      expect(keyframes).toEqual([
        { transform: "translateX(0px)" },
        { transform: `translateX(${-RUN}px)` },
      ]);
      expect(options.iterations).toBe(Infinity);
      // At most 40px a second.
      expect(Number(options.duration)).toBeGreaterThanOrEqual(RUN * 25);
      expect(drift()!.state).toBe("running");
    });

    it("starts the reader on a run with copies either side", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      expect(scroller().scrollLeft).toBe(2 * RUN);
    });

    it("pauses while a mouse is over a card, and carries on when it leaves them", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      fireEvent.pointerMove(scroller().querySelector("figure")!, { pointerType: "mouse" });
      expect(drift()!.state).toBe("paused");
      fireEvent.pointerLeave(scroller(), { pointerType: "mouse" });
      expect(drift()!.state).toBe("running");
    });

    it("keeps moving while a mouse is over the heading", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      fireEvent.pointerEnter(section(), { pointerType: "mouse" });
      fireEvent.pointerMove(screen.getByRole("heading", { name: "Music to my ears" }), {
        pointerType: "mouse",
      });
      expect(drift()!.state).toBe("running");
    });

    it("pauses over the gap between two cards, but not under a shorter column", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      const track = scroller().firstElementChild as HTMLElement;
      // Columns 100px wide with 10px gaps; the second is half as tall as the rest.
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.parentElement !== track) return DOMRect.fromRect();
        const column = [...track.children].indexOf(this);
        return DOMRect.fromRect({ x: column * 110, y: 0, width: 100, height: column === 1 ? 100 : 200 });
      });
      const at = (clientX: number, clientY: number) =>
        fireEvent.pointerMove(track, { pointerType: "mouse", clientX, clientY });

      at(105, 150);
      expect(drift()!.state).toBe("paused");
      at(150, 150);
      expect(drift()!.state).toBe("running");
      at(215, 150);
      expect(drift()!.state).toBe("paused");
      at(105, 250);
      expect(drift()!.state).toBe("running");
    });

    it("pauses while a card has focus", () => {
      render(
        <TestimonialWall
          testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
        />,
      );
      act(() => screen.getByRole("link", { name: "Ada Lovelace on LinkedIn" }).focus());
      expect(drift()!.state).toBe("paused");
    });

    // Chromium focuses a link on a mouse press, so a drag that starts on a card would otherwise hold the strip.
    it("carries on after a mouse press has focused a card", () => {
      render(
        <TestimonialWall
          testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
        />,
      );
      const link = screen.getByRole("link", { name: "Ada Lovelace on LinkedIn" });
      fireEvent.pointerMove(link, { pointerType: "mouse" });
      fireEvent.pointerDown(link, { pointerType: "mouse" });
      act(() => link.focus());
      fireEvent.pointerLeave(scroller(), { pointerType: "mouse" });
      expect(drift()!.state).toBe("running");
    });

    it("holds a touch until the strip comes to rest", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      fireEvent.pointerDown(scroller(), { pointerType: "touch" });
      expect(drift()!.state).toBe("paused");
      fireEvent.scroll(scroller());
      act(() => vi.advanceTimersByTime(50));
      expect(drift()!.state).toBe("paused");
      act(() => vi.advanceTimersByTime(500));
      expect(drift()!.state).toBe("running");
    });

    it("brings the reader back to the middle runs once a scroll comes to rest, onto the same cards", () => {
      render(<TestimonialWall testimonials={rows(13)} />);
      scroller().scrollLeft = 3 * RUN + 200;
      fireEvent.scroll(scroller());
      act(() => vi.advanceTimersByTime(500));
      expect(scroller().scrollLeft).toBe(2 * RUN + 200);

      scroller().scrollLeft = RUN + 100;
      fireEvent.scroll(scroller());
      act(() => vi.advanceTimersByTime(500));
      expect(scroller().scrollLeft).toBe(2 * RUN + 100);
    });

    it("holds still while it is off screen", () => {
      const shown = scrollIntoView();
      render(<TestimonialWall testimonials={rows(13)} />);
      shown(0);
      expect(drift()!.state).toBe("paused");
      shown(0.2);
      expect(drift()!.state).toBe("running");
    });

    it("stays still for reduced motion", () => {
      reduced = true;
      render(<TestimonialWall testimonials={rows(13)} />);
      expect(drift()).toBeUndefined();
    });
  });
});

describe("loopRun", () => {
  it("repeats the cards until they fill whole columns of two, and at least 24", () => {
    expect(loopRun(rows(13).map((t) => t.id))).toHaveLength(26);
    expect(loopRun(rows(8).map((t) => t.id))).toHaveLength(24);
    expect(loopRun(rows(5).map((t) => t.id))).toHaveLength(30);
    expect(loopRun(rows(30).map((t) => t.id))).toHaveLength(30);
  });

  it("keeps their order on every pass", () => {
    const ids = rows(5).map((t) => t.id);
    const run = loopRun(ids);
    for (let i = 0; i < run.length; i++) expect(run[i]).toBe(ids[i % ids.length]);
  });

  it("is empty for no cards", () => {
    expect(loopRun([])).toEqual([]);
  });
});

describe("TestimonialQuote (through the wall)", () => {
  it("marks the words up as a quotation with its attribution", () => {
    render(<TestimonialWall testimonials={[row({ name: "Ada Lovelace" })]} />);
    const [figure] = readable();
    expect(figure.querySelector("blockquote")?.textContent).toContain(
      "vague brief",
    );
    expect(figure.querySelector("figcaption")?.textContent).toContain(
      "Ada Lovelace",
    );
  });

  it("is not a control, unlike the card on the board", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(within(readable()[0]).queryAllByRole("button")).toHaveLength(0);
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

  it("names its destination exactly as the social row does", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );
    expect(screen.getAllByText("LinkedIn").length).toBeGreaterThan(0);
    expect(screen.queryByText("ada")).toBeNull();
    expect(screen.queryByText("in/ada")).toBeNull();
  });

  it("puts the goto past the hairline, as that tooltip always has", () => {
    render(
      <TestimonialWall
        testimonials={[row({ linkedinUrl: "https://www.linkedin.com/in/ada" })]}
      />,
    );

    const label = screen.getAllByText("LinkedIn")[0];
    const tooltip = label.parentElement!;
    expect(tooltip.children).toHaveLength(3);
    expect(tooltip.firstElementChild).toBe(label);
    expect(label.querySelector("svg")).toBeNull();
    expect(tooltip.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("says nothing about a profile that was never added", () => {
    render(<TestimonialWall testimonials={[row()]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("stands in for a missing picture with the first character of the name", () => {
    render(<TestimonialWall testimonials={[row({ name: "Grace Hopper" })]} />);
    expect(within(readable()[0]).getByText("G")).toBeTruthy();
  });

  it("draws a stored picture, undescribed", () => {
    render(
      <TestimonialWall
        testimonials={[row({ avatarUrl: "https://cdn.test/ada.jpg" })]}
      />,
    );
    const img = readable()[0].querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/ada.jpg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("shows the chosen excerpt rather than the whole quote", () => {
    render(
      <TestimonialWall testimonials={[row({ excerpt: "vague brief" })]} />,
    );
    expect(within(readable()[0]).getByText("vague brief")).toBeTruthy();
    expect(screen.queryByText(/actually ship/)).toBeNull();
  });

  it("shows the tagline under the name, when there is one", () => {
    render(<TestimonialWall testimonials={[row({ tagline: "Countess" })]} />);
    expect(within(readable()[0]).getByText("Countess")).toBeTruthy();
  });
});
