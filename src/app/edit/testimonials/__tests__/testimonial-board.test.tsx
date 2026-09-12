import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// The board: a card per row, a rail on the selected one, and the two fields the
// rail writes showing up on the card they belong to.
//
// That last part is the whole point of this surface and the thing most worth
// testing. The value travels a long way — field → action → stored row → card —
// and every hop is somewhere it could be dropped, or land on the wrong card.
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn();
vi.mock("@/app/actions/testimonial", () => ({
  updateTestimonialDetails: (input: unknown) => mockUpdate(input),
}));

// The real dialog reaches a server action, and through it `next/headers`.
// Stubbed to the one fact this file's cases are about: a picture was chosen.
const PICKED = "https://cdn.test/media/uuid-ada.jpg";
vi.mock("@/components/image-insert-dialog", () => ({
  ImageInsertDialog: ({
    open,
    folder,
    onInsert,
  }: {
    open: boolean;
    folder?: string;
    onInsert: (payload: { src: string; kind: string }) => void;
  }) =>
    open ? (
      <button
        data-folder={folder}
        onClick={() => onInsert({ src: PICKED, kind: "image" })}
      >
        pick a picture
      </button>
    ) : null,
}));

const { TestimonialBoard } = await import("../testimonial-board");
type Row = import("@/domain/testimonial").Testimonial;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ada: Row = {
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

const grace: Row = {
  id: "t2",
  name: "Grace Hopper",
  quote: "Read the spec closer than the person who wrote it.",
  createdAt: new Date("2026-03-08T10:00:00.000Z"),
  avatarUrl: null,
  linkedinUrl: null,
  tagline: null,
  excerpt: null,
  publishedAt: null,
};

/**
 * The action's honest behaviour: the stored row, with the write applied.
 *
 * Takes the rows it is standing in for, because a stub that rebuilt them from
 * the module's fixtures would answer with THOSE values for any field the test
 * had overridden — which is how a published row came back unpublished from a
 * write that never mentioned publication.
 */
function storesWhatItIsGiven(seed: Row[] = [ada, grace]) {
  mockUpdate.mockImplementation(async (input) => {
    const row = seed.find((r) => r.id === input.id)!;
    // Mirrors the action: an unnamed excerpt leaves the stored one alone, and a
    // quote that is not a slice of the row's own words is refused outright.
    if (typeof input.excerpt === "string" && input.excerpt !== "") {
      if (!row.quote.includes(input.excerpt.trim())) {
        throw new Error("An excerpt has to be their words.");
      }
    }
    if (typeof input.name === "string" && input.name.trim() === "") {
      throw new Error("A testimonial needs a name on it.");
    }
    return {
      ...row,
      name: input.name ?? row.name,
      avatarUrl: input.avatarUrl,
      linkedinUrl: input.linkedinUrl,
      excerpt:
        input.excerpt === undefined ? row.excerpt : (input.excerpt || null),
      tagline:
        input.tagline === undefined ? row.tagline : (input.tagline || null),
      // The action's three-state rule, mirrored: absent leaves the stored
      // publication alone, and a boolean becomes an instant or a null.
      publishedAt:
        input.published === undefined
          ? row.publishedAt
          : input.published
            ? new Date()
            : null,
    };
  });
}

/**
 * One card, by whose it is. The button is an empty overlay stretched over the
 * card (so the profile beside it can be a real link), so the words are in its
 * PARENT — which is the card.
 */
const card = (name: RegExp | string) =>
  screen.getByRole("button", { name }).parentElement!;

/** The same card's select button, for a press. */
const selectCard = (name: RegExp | string) =>
  screen.getByRole("button", { name });
const rail = () => screen.getByRole("dialog");

beforeEach(() => {
  vi.clearAllMocks();
  storesWhatItIsGiven();
});
afterEach(() => cleanup());

describe("TestimonialBoard", () => {
  it("draws a card for every row", () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    expect(screen.getByText(ada.quote)).toBeTruthy();
    expect(screen.getByText(grace.quote)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the rail on the card that was pressed", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/grace hopper/i));

    expect(within(rail()).getByText("Grace Hopper")).toBeTruthy();
    expect(selectCard(/grace hopper/i).getAttribute("aria-pressed")).toBe("true");
    expect(selectCard(/ada lovelace/i).getAttribute("aria-pressed")).toBe("false");
  });

  // The rail is one surface for the whole board, so moving to another card has
  // to re-point it — not open a second one, and not keep showing the first.
  it("moves the rail to the next card selected", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(selectCard(/grace hopper/i));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(rail()).getByText("Grace Hopper")).toBeTruthy();
  });

  // ...and STAYS UP while it does. The panel dismisses itself on any outside
  // pointerdown, and a card is outside it — so pressing the next card started
  // the rail's slide-out, and the click that followed re-selected into a panel
  // already on its way off screen. The card is the control that OPENS the
  // panel, so it is exempt from that dismiss (`PROPERTIES_TRIGGER_ATTR`).
  //
  // Two things this has to do to be able to fail, both learned the hard way:
  //   • press WITHOUT releasing. A whole click is one task here, so React
  //     coalesces the close and the re-open into a single render and the rail
  //     never leaves the DOM — where a browser commits and paints between the
  //     two, and shows the collapse.
  //   • wait out the exit. The panel outlives the decision to close it by 200ms
  //     so it can slide rather than vanish, so the DOM looks untouched for as
  //     long as the animation runs.
  it("keeps the rail standing when the next card is pressed", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    const standing = rail();

    fireEvent.pointerDown(selectCard(/grace hopper/i));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.queryByRole("dialog")).toBe(standing);

    // ...and the press still selects, in that same standing rail.
    await userEvent.click(selectCard(/grace hopper/i));
    expect(rail()).toBe(standing);
    expect(within(standing).getByText("Grace Hopper")).toBeTruthy();
  });

  // ---- The picture -------------------------------------------------------

  it("puts a picked picture on the card it was picked for", async () => {
    const { container } = render(
      <TestimonialBoard testimonials={[ada, grace]} />,
    );

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /picture/i }));
    await userEvent.click(screen.getByRole("button", { name: /add picture/i }));
    await userEvent.click(screen.getByRole("button", { name: /pick a picture/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", avatarUrl: PICKED }),
      ),
    );
    await waitFor(() =>
      expect(
        container.querySelector(`img[src="${PICKED}"]`),
      ).not.toBeNull(),
    );
    // On ONE card. A picture that landed on every row would pass every
    // assertion above.
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  // A testimonial's face is not library material. The dialog that adds one
  // opens on `profiles/` — the same folder it uploads into, so a picture added
  // here is still there the next time the picker is opened.
  it("picks from the profiles folder rather than the media library", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /picture/i }));
    await userEvent.click(screen.getByRole("button", { name: /add picture/i }));

    expect(
      screen
        .getByRole("button", { name: /pick a picture/i })
        .getAttribute("data-folder"),
    ).toBe("profiles");
  });

  it("takes the picture off again", async () => {
    const { container } = render(
      <TestimonialBoard testimonials={[{ ...ada, avatarUrl: PICKED }]} />,
    );

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(
      within(rail()).getByRole("button", { name: /remove picture/i }),
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", avatarUrl: null }),
      ),
    );
    await waitFor(() =>
      expect(container.querySelector("img")).toBeNull(),
    );
  });

  // ---- The profile -------------------------------------------------------

  it("puts a typed profile on the card, as its handle", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /linkedin/i }));
    await userEvent.type(
      within(rail()).getByLabelText(/url/i),
      "linkedin.com/in/ada-lovelace",
    );

    // CANONICAL, not as typed. The rail normalises before it commits, so the
    // board's own copy of the row is the spelling the column will hold and the
    // card never flashes the raw typing before settling on the stored form.
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t1",
          linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
        }),
      ),
    );
    // The HANDLE, which is what the card shows and what the tooltip carries —
    // `in/` is LinkedIn's routing rather than any part of a name, and it says
    // nothing that the glyph beside it is not already saying.
    await waitFor(() =>
      expect(screen.getByText("ada-lovelace")).toBeTruthy(),
    );
  });

  // The box is labelled LinkedIn. Typing something else is answered rather than
  // stored, and — the load-bearing half — nothing is written while it is wrong.
  it("says so, and writes nothing, when the URL is not a profile", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /linkedin/i }));
    await userEvent.type(
      within(rail()).getByLabelText(/url/i),
      "https://example.com/in/ada",
    );

    await waitFor(() =>
      expect(within(rail()).getByText(/does not look like/i)).toBeTruthy(),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Typing a URL passes through a dozen states that are not one. The message
  // has to go when the value comes good, or it is a complaint about a field
  // that is now correct.
  it("stops complaining once the URL is a profile", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /linkedin/i }));

    const box = within(rail()).getByLabelText(/url/i);
    await userEvent.type(box, "nonsense");
    await waitFor(() =>
      expect(within(rail()).getByText(/does not look like/i)).toBeTruthy(),
    );

    await userEvent.clear(box);
    await userEvent.type(box, "linkedin.com/in/ada");

    await waitFor(() =>
      expect(within(rail()).queryByText(/does not look like/i)).toBeNull(),
    );
  });

  it("takes the profile off again", async () => {
    render(
      <TestimonialBoard
        testimonials={[{ ...ada, linkedinUrl: "https://www.linkedin.com/in/ada" }]}
      />,
    );

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(
      within(rail()).getByRole("button", { name: /remove linkedin/i }),
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", linkedinUrl: null }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("in/ada")).toBeNull());
  });

  // The card cannot hold a link (it is a button), so the rail is the only place
  // the profile is actually reachable from.
  it("offers the stored profile as a link, which the card cannot", async () => {
    render(
      <TestimonialBoard
        testimonials={[{ ...ada, linkedinUrl: "https://www.linkedin.com/in/ada" }]}
      />,
    );

    await userEvent.click(selectCard(/ada lovelace/i));

    const link = within(rail()).getByRole("link");
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/in/ada");
  });

  // A write that fails must not leave the card showing a value the database
  // does not have — that is a board that lies about what is stored.
  it("puts the card back when the write fails", async () => {
    const { container } = render(<TestimonialBoard testimonials={[ada]} />);
    mockUpdate.mockRejectedValue(new Error("connection lost"));

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /picture/i }));
    await userEvent.click(screen.getByRole("button", { name: /add picture/i }));
    await userEvent.click(screen.getByRole("button", { name: /pick a picture/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("img")).toBeNull());
    expect(within(rail()).getByText(/could not save/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// The excerpt — choosing which portion of somebody's words a card carries.
// ---------------------------------------------------------------------------

describe("TestimonialBoard (excerpt)", () => {
  const openExcerpt = async () => {
    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(
      within(rail()).getByRole("button", { name: /excerpt/i }),
    );
    // By ROLE, not by label alone: the section's control group is named
    // "Excerpt" too, so a bare label query matches the box and its container.
    return within(rail()).getByRole("textbox", { name: "Excerpt" });
  };

  it("shows the chosen portion on the card", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    const box = await openExcerpt();
    await userEvent.clear(box);
    await userEvent.type(box, "something we could actually ship");

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t1",
          excerpt: "something we could actually ship",
        }),
      ),
    );
    // Scoped to the CARD: the rail's box holds the same words, so an
    // unscoped query would pass on the textarea alone and prove nothing.
    await waitFor(() =>
      expect(card(/ada lovelace/i).textContent).toContain(
        "something we could actually ship",
      ),
    );
    expect(card(/ada lovelace/i).textContent).not.toContain(
      "Turned a vague brief",
    );
  });

  // Opening the section hands you the whole thing to cut down, which is the
  // gesture the rule expects — trim, do not retype.
  it("opens with the whole quote to trim", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    const box = await openExcerpt();

    expect((box as HTMLTextAreaElement).value).toBe(ada.quote);
  });

  // The board must not let a misquote leave the screen, let alone reach the
  // column. The refusal is shown and the card does not change.
  it("refuses words they never wrote, and says so", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    const box = await openExcerpt();
    await userEvent.clear(box);
    await userEvent.type(box, "Shipped it late and badly.");

    await waitFor(() =>
      expect(within(rail()).getByText(/their words/i)).toBeTruthy(),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(ada.quote)).toBeTruthy();
  });

  it("goes back to the whole quote when the excerpt is removed", async () => {
    render(
      <TestimonialBoard
        testimonials={[{ ...ada, excerpt: "a vague brief" }]}
      />,
    );

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(
      within(rail()).getByRole("button", { name: /remove excerpt/i }),
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", excerpt: null }),
      ),
    );
    await waitFor(() => expect(screen.getByText(ada.quote)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// The name — the one field here that was written by somebody else and is still
// mine to correct. People put job titles in it.
// ---------------------------------------------------------------------------

describe("TestimonialBoard (name)", () => {
  const nameBox = () =>
    within(rail()).getByRole("textbox", { name: "Name" });

  /** The card carrying these words. Found by the QUOTE, which renaming does not
   *  change — and scoped, because the rail's header shows the name too. */
  const cardSaying = (quote: string) =>
    screen.getByText(quote).closest("[class*='testimonial-card__root']")!;

  it("opens with the stored name in it", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);
    await userEvent.click(selectCard(/ada lovelace/i));

    expect((nameBox() as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  it("writes a corrected name and shows it on the card", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);
    await userEvent.click(selectCard(/ada lovelace/i));

    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), "Ada L");

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", name: "Ada L" }),
      ),
    );
    await waitFor(() =>
      expect(cardSaying(ada.quote).textContent).toContain("Ada L"),
    );
    // The other card is untouched.
    expect(cardSaying(grace.quote).textContent).toContain("Grace Hopper");
  });

  // A name cannot be cleared — the column is NOT NULL and a testimonial
  // credited to nobody is not a state worth having. An emptied box is answered,
  // not obeyed, and nothing is written.
  it("refuses an emptied name rather than clearing it", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);
    await userEvent.click(selectCard(/ada lovelace/i));

    await userEvent.clear(nameBox());

    await waitFor(() =>
      expect(within(rail()).getByText(/needs a name/i)).toBeTruthy(),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(cardSaying(ada.quote).textContent).toContain("Ada Lovelace");
  });

  // The line that did not move.
  it("offers no way to edit the words themselves", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);
    await userEvent.click(selectCard(/ada lovelace/i));

    expect(
      within(rail()).queryByRole("textbox", { name: "Quote" }),
    ).toBeNull();
  });
});
// ---------------------------------------------------------------------------
// The tagline, and the rail that stays put while you move between cards.
// ---------------------------------------------------------------------------

describe("TestimonialBoard (tagline)", () => {
  it("writes a typed tagline to the row it was typed for", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.type(
      within(rail()).getByLabelText("Tagline"),
      "Analyst, Analytical Engine",
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t1",
          tagline: "Analyst, Analytical Engine",
        }),
      ),
    );
  });

  it("puts the stored tagline on the card, under the name", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.type(within(rail()).getByLabelText("Tagline"), "Analyst");

    await waitFor(() =>
      expect(within(card(/ada lovelace/i)).getByText("Analyst")).toBeTruthy(),
    );
  });

  // A stage holds ONE WebGL context and moves it to whichever icon is hovered.
  // One per card would be a context per card, against a browser limit of about
  // sixteen — so the board wraps the whole grid in a single stage.
  it("gives the whole board one shader stage, not one per card", async () => {
    render(
      <TestimonialBoard
        testimonials={[
          { ...ada, linkedinUrl: "https://www.linkedin.com/in/ada" },
          { ...grace, linkedinUrl: "https://www.linkedin.com/in/grace" },
        ]}
      />,
    );

    expect(
      document.querySelectorAll("[data-social-shader-stage]").length,
    ).toBe(1);
    expect(screen.getAllByRole("link").length).toBe(2);
  });

  // Moving between cards used to tear the panel down and build it again — the
  // rail slid out and back in on every press. It is ONE surface for the whole
  // board and it stays open until it is closed.
  it("keeps the rail open when another card is selected", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    const panel = rail();

    await userEvent.click(selectCard(/grace hopper/i));

    // The same element, not a replacement wearing the same role.
    expect(rail()).toBe(panel);
    expect(within(rail()).getByText("Grace Hopper")).toBeTruthy();
  });

  // What the remount used to buy, kept: the boxes belong to the row on screen,
  // so a value half-typed for one card can never be sitting in another's.
  it("carries no half-typed value across a selection", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    const box = within(rail()).getByLabelText("Tagline");
    await userEvent.type(box, "Analyst");

    await userEvent.click(selectCard(/grace hopper/i));

    expect(
      (within(rail()).getByLabelText("Tagline") as HTMLInputElement).value,
    ).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Publishing — the one press between a private table and the homepage.
//
// The one control on this board whose effect is not on this board. Everything
// else here changes how a card is DRAWN; this changes who can see it at all, so
// what these cases check is that the button says what is stored and that a save
// of something else never moves it.
//
// ONE button with two faces rather than two buttons, so the thing to assert is
// which face it is wearing: the name IS the state, and a row that is already
// published offers to take it down.
// ---------------------------------------------------------------------------

describe("TestimonialBoard (published)", () => {
  const publishedAda = {
    ...ada,
    publishedAt: new Date("2026-03-10T10:00:00.000Z"),
  };

  /** Select a card and hand back the button that publishes it. */
  async function openPublishButton(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /Edit Ada/ }));
    return within(rail()).getByRole("button", {
      name: /^(Publish|Unpublish)$/,
    });
  }

  it("offers to publish a row that is not published", async () => {
    const user = userEvent.setup();
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    expect((await openPublishButton(user)).getAttribute("aria-label")).toBe(
      "Publish",
    );
  });

  it("offers to take down a row that is", async () => {
    const user = userEvent.setup();
    storesWhatItIsGiven([publishedAda, grace]);
    render(<TestimonialBoard testimonials={[publishedAda, grace]} />);

    expect((await openPublishButton(user)).getAttribute("aria-label")).toBe(
      "Unpublish",
    );
  });

  it("publishes the row the button belongs to", async () => {
    const user = userEvent.setup();
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await user.click(await openPublishButton(user));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", published: true }),
      ),
    );
  });

  it("takes a published row back off the homepage", async () => {
    const user = userEvent.setup();
    storesWhatItIsGiven([publishedAda]);
    render(<TestimonialBoard testimonials={[publishedAda]} />);

    await user.click(await openPublishButton(user));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1", published: false }),
      ),
    );
  });

  // The press flips what it offers next, which is the whole of "one button with
  // two faces" — and it is drawn off the STORED row, so this also proves the
  // board's optimistic copy reached the rail.
  it("turns into its opposite once the row has moved", async () => {
    const user = userEvent.setup();
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await user.click(await openPublishButton(user));

    await waitFor(() =>
      expect(
        within(rail()).getByRole("button", { name: "Unpublish" }),
      ).toBeTruthy(),
    );
  });

  // The case the three-state rule in the action exists for, asserted from the
  // surface that would trip it. The board sends the other five fields whole on
  // every save; this one must NOT go along for the ride, or `publishedAt` is
  // re-stamped on every keystroke's worth of save and quietly becomes "last
  // edited" rather than "published".
  it("says nothing about publication when an unrelated field is edited", async () => {
    const user = userEvent.setup();
    storesWhatItIsGiven([publishedAda]);
    render(<TestimonialBoard testimonials={[publishedAda]} />);

    await user.click(screen.getByRole("button", { name: /Edit Ada/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Tagline" }),
      "Countess",
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ tagline: "Countess" }),
      ),
    );
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("published");
  });

  // ...and the row stays on the homepage through it. The assertion above is
  // about the payload; this is about what the reader ends up with, which is the
  // thing that would actually be broken.
  it("leaves the row published while an unrelated field is edited", async () => {
    const user = userEvent.setup();
    storesWhatItIsGiven([publishedAda]);
    render(<TestimonialBoard testimonials={[publishedAda]} />);

    await user.click(screen.getByRole("button", { name: /Edit Ada/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Tagline" }),
      "Countess",
    );

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    // Still offering to take it DOWN, which is the button saying the row is
    // still up.
    expect(
      within(rail()).getByRole("button", { name: "Unpublish" }),
    ).toBeTruthy();
  });
});
