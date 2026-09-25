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

const mockUpdate = vi.fn();
vi.mock("@/app/actions/testimonial", () => ({
  updateTestimonialDetails: (input: unknown) => mockUpdate(input),
}));

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

/** The seeded rows with the write applied; rebuilding from fixtures would lose test overrides. */
function storesWhatItIsGiven(seed: Row[] = [ada, grace]) {
  mockUpdate.mockImplementation(async (input) => {
    const row = seed.find((r) => r.id === input.id)!;
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
      publishedAt:
        input.published === undefined
          ? row.publishedAt
          : input.published
            ? new Date()
            : null,
    };
  });
}

/** The select button is an empty overlay, so the card is its parent. */
const card = (name: RegExp | string) =>
  screen.getByRole("button", { name }).parentElement!;

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

  it("moves the rail to the next card selected", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(selectCard(/grace hopper/i));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(rail()).getByText("Grace Hopper")).toBeTruthy();
  });

  // Press without releasing (a whole click coalesces close and reopen into one
  // render), and wait out the 200ms exit, or this cannot fail.
  it("keeps the rail standing when the next card is pressed", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    const standing = rail();

    fireEvent.pointerDown(selectCard(/grace hopper/i));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.queryByRole("dialog")).toBe(standing);

    await userEvent.click(selectCard(/grace hopper/i));
    expect(rail()).toBe(standing);
    expect(within(standing).getByText("Grace Hopper")).toBeTruthy();
  });

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
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

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

  it("puts a typed profile on the card, as its handle", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(within(rail()).getByRole("button", { name: /linkedin/i }));
    await userEvent.type(
      within(rail()).getByLabelText(/url/i),
      "linkedin.com/in/ada-lovelace",
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t1",
          linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("ada-lovelace")).toBeTruthy(),
    );
  });

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

describe("TestimonialBoard (excerpt)", () => {
  const openExcerpt = async () => {
    await userEvent.click(selectCard(/ada lovelace/i));
    await userEvent.click(
      within(rail()).getByRole("button", { name: /excerpt/i }),
    );
    // By role: the section's control group is also named "Excerpt".
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
    // Scoped to the card: the rail's box holds the same words.
    await waitFor(() =>
      expect(card(/ada lovelace/i).textContent).toContain(
        "something we could actually ship",
      ),
    );
    expect(card(/ada lovelace/i).textContent).not.toContain(
      "Turned a vague brief",
    );
  });

  it("opens with the whole quote to trim", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);

    const box = await openExcerpt();

    expect((box as HTMLTextAreaElement).value).toBe(ada.quote);
  });

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

describe("TestimonialBoard (name)", () => {
  const nameBox = () =>
    within(rail()).getByRole("textbox", { name: "Name" });

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
    expect(cardSaying(grace.quote).textContent).toContain("Grace Hopper");
  });

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

  it("offers no way to edit the words themselves", async () => {
    render(<TestimonialBoard testimonials={[ada]} />);
    await userEvent.click(selectCard(/ada lovelace/i));

    expect(
      within(rail()).queryByRole("textbox", { name: "Quote" }),
    ).toBeNull();
  });
});

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

  it("keeps the rail open when another card is selected", async () => {
    render(<TestimonialBoard testimonials={[ada, grace]} />);

    await userEvent.click(selectCard(/ada lovelace/i));
    const panel = rail();

    await userEvent.click(selectCard(/grace hopper/i));

    expect(rail()).toBe(panel);
    expect(within(rail()).getByText("Grace Hopper")).toBeTruthy();
  });

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

describe("TestimonialBoard (published)", () => {
  const publishedAda = {
    ...ada,
    publishedAt: new Date("2026-03-10T10:00:00.000Z"),
  };

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
    expect(
      within(rail()).getByRole("button", { name: "Unpublish" }),
    ).toBeTruthy();
  });
});
