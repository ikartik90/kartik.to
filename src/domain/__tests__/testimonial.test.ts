import { describe, expect, it } from "vitest";

import {
  TESTIMONIAL_NAME_MAX_LENGTH,
  TESTIMONIAL_QUOTE_MAX_LENGTH,
  TestimonialDetailsSchema,
  TESTIMONIAL_TAGLINE_MAX_LENGTH,
  TestimonialSubmissionSchema,
  isExcerptOfQuote,
  testimonialShown,
} from "../testimonial";

const valid = {
  name: "Ada Lovelace",
  quote: "Shipped the thing, on time, and it was beautiful.",
};

describe("TestimonialSubmissionSchema", () => {
  it("takes a well-formed submission", () => {
    expect(TestimonialSubmissionSchema.parse(valid)).toEqual(valid);
  });

  // The form posts whatever was typed, and people type trailing spaces. Trimming
  // HERE rather than in the component is what keeps " Ada " out of the column no
  // matter which caller writes the row.
  it("trims the name and the quote", () => {
    expect(
      TestimonialSubmissionSchema.parse({
        name: "  Ada Lovelace \n",
        quote: "\t Shipped it. ",
      }),
    ).toEqual({ name: "Ada Lovelace", quote: "Shipped it." });
  });

  // Trimming and emptiness are one question, not two: a field of spaces is an
  // empty field that happens to have survived a `required` attribute.
  it.each([" ", "", "\n\t"])("refuses a blank name (%j)", (name) => {
    expect(TestimonialSubmissionSchema.safeParse({ ...valid, name }).success).toBe(
      false,
    );
  });

  it.each([" ", "", "\n\t"])("refuses a blank quote (%j)", (quote) => {
    expect(
      TestimonialSubmissionSchema.safeParse({ ...valid, quote }).success,
    ).toBe(false);
  });

  // The counter in the form and the ceiling in the schema are the same number,
  // imported from here, so the box cannot let through what the column refuses.
  it("takes a quote of exactly the maximum length", () => {
    const quote = "x".repeat(TESTIMONIAL_QUOTE_MAX_LENGTH);
    expect(TestimonialSubmissionSchema.parse({ ...valid, quote }).quote).toBe(
      quote,
    );
  });

  it("refuses a quote one character over", () => {
    expect(
      TestimonialSubmissionSchema.safeParse({
        ...valid,
        quote: "x".repeat(TESTIMONIAL_QUOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("refuses a name over the maximum length", () => {
    expect(
      TestimonialSubmissionSchema.safeParse({
        ...valid,
        name: "x".repeat(TESTIMONIAL_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  // The length is counted AFTER trimming, so padding cannot push a legal quote
  // over the edge.
  it("counts the quote's length after trimming", () => {
    const quote = "x".repeat(TESTIMONIAL_QUOTE_MAX_LENGTH);
    expect(
      TestimonialSubmissionSchema.safeParse({ ...valid, quote: `  ${quote}  ` })
        .success,
    ).toBe(true);
  });

  // The form once collected a LinkedIn URL and no longer does. Anything a
  // caller sends beyond the two fields is DROPPED rather than stored: the
  // schema decides what a row is, not the shape of whatever posted it.
  it("ignores fields the form no longer collects", () => {
    expect(
      TestimonialSubmissionSchema.parse({
        ...valid,
        linkedinUrl: "https://www.linkedin.com/in/ada",
      }),
    ).toEqual(valid);
  });
});

// ---------------------------------------------------------------------------
// The author's half of a row. See `TestimonialDetailsSchema`: these two fields
// are mine to write, not the submitter's, and the schema is where that
// separation is actually enforced.
// ---------------------------------------------------------------------------

describe("TestimonialDetailsSchema", () => {
  const id = "ckxyz";

  it("takes a picture and a profile", () => {
    expect(
      TestimonialDetailsSchema.parse({
        id,
        avatarUrl: "https://cdn.example.com/media/ada.jpg",
        linkedinUrl: "https://www.linkedin.com/in/ada",
      }),
    ).toEqual({
      id,
      avatarUrl: "https://cdn.example.com/media/ada.jpg",
      linkedinUrl: "https://www.linkedin.com/in/ada",
    });
  });

  // Both fields are OPTIONAL in the row and clearable in the rail, so "no
  // picture" and "no profile" have to be expressible — and a cleared box sends
  // an empty string, which is the same fact spelled differently.
  it.each([null, "", "   "])("reads %j as no picture", (avatarUrl) => {
    expect(
      TestimonialDetailsSchema.parse({ id, avatarUrl, linkedinUrl: null })
        .avatarUrl,
    ).toBeNull();
  });

  it.each([null, "", "   "])("reads %j as no profile", (linkedinUrl) => {
    expect(
      TestimonialDetailsSchema.parse({ id, avatarUrl: null, linkedinUrl })
        .linkedinUrl,
    ).toBeNull();
  });

  // Nobody types a scheme. A field that refused `linkedin.com/in/ada` would be
  // refusing the exact thing a browser's address bar hands you.
  it.each([
    ["linkedin.com/in/ada", "https://www.linkedin.com/in/ada"],
    ["www.linkedin.com/in/ada", "https://www.linkedin.com/in/ada"],
    ["http://linkedin.com/in/ada", "https://www.linkedin.com/in/ada"],
    ["https://uk.linkedin.com/in/ada", "https://www.linkedin.com/in/ada"],
    ["https://www.linkedin.com/in/ada/", "https://www.linkedin.com/in/ada"],
    [
      "https://www.linkedin.com/in/ada?trk=nav&originalSubdomain=uk",
      "https://www.linkedin.com/in/ada",
    ],
    ["  https://www.linkedin.com/in/ada  ", "https://www.linkedin.com/in/ada"],
  ])("normalises %j", (typed, stored) => {
    expect(
      TestimonialDetailsSchema.parse({
        id,
        avatarUrl: null,
        linkedinUrl: typed,
      }).linkedinUrl,
    ).toBe(stored);
  });

  // The field is labelled LinkedIn, so it holds LinkedIn. A refusal with a
  // message beats silently storing a link to somewhere else under that label.
  it.each([
    "https://example.com/in/ada",
    "https://linkedin.com.evil.example/in/ada",
    "https://notlinkedin.com/in/ada",
    "not a url at all",
  ])("refuses %j", (linkedinUrl) => {
    expect(
      TestimonialDetailsSchema.safeParse({ id, avatarUrl: null, linkedinUrl })
        .success,
    ).toBe(false);
  });

  it("refuses a picture that is not a URL", () => {
    expect(
      TestimonialDetailsSchema.safeParse({
        id,
        avatarUrl: "ada.jpg",
        linkedinUrl: null,
      }).success,
    ).toBe(false);
  });

  it("refuses a row with no id to write to", () => {
    expect(
      TestimonialDetailsSchema.safeParse({
        id: "",
        avatarUrl: null,
        linkedinUrl: null,
      }).success,
    ).toBe(false);
  });

  // THE LINE IS THE QUOTE, not the whole row. The name is a label on an
  // attribution and is mine to tidy — people put job titles in it. The quote is
  // the thing somebody actually said, and no amount of admin convenience is
  // worth a door onto it.
  it("cannot rewrite the words", () => {
    expect(
      TestimonialDetailsSchema.parse({
        id,
        avatarUrl: null,
        linkedinUrl: null,
        quote: "Words I did not write.",
      }),
    ).toEqual({ id, avatarUrl: null, linkedinUrl: null });
  });

  it("takes a corrected name", () => {
    expect(
      TestimonialDetailsSchema.parse({
        id,
        avatarUrl: null,
        linkedinUrl: null,
        name: "Lalit Arya",
      }).name,
    ).toBe("Lalit Arya");
  });

  it("trims a corrected name", () => {
    expect(
      TestimonialDetailsSchema.parse({
        id,
        avatarUrl: null,
        linkedinUrl: null,
        name: "  Lalit Arya \n",
      }).name,
    ).toBe("Lalit Arya");
  });

  // Absent means "leave it alone", as it does for the excerpt — editing the
  // picture must not rename anybody.
  it("leaves an unnamed name undefined", () => {
    expect(
      TestimonialDetailsSchema.parse({ id, avatarUrl: null, linkedinUrl: null })
        .name,
    ).toBeUndefined();
  });

  // UNLIKE the other three, a name cannot be cleared. The column is NOT NULL
  // and a testimonial credited to nobody is not a state worth having, so a
  // blank box is a mistake to answer rather than an instruction to obey.
  it.each(["", "   "])("refuses a blank name (%j)", (name) => {
    expect(
      TestimonialDetailsSchema.safeParse({
        id,
        avatarUrl: null,
        linkedinUrl: null,
        name,
      }).success,
    ).toBe(false);
  });

  it("refuses a name over the maximum length", () => {
    expect(
      TestimonialDetailsSchema.safeParse({
        id,
        avatarUrl: null,
        linkedinUrl: null,
        name: "x".repeat(TESTIMONIAL_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The excerpt — the portion of somebody's words the board puts on a card.
//
// The rule that matters is that an excerpt is THEIRS. It is a slice of what
// they wrote, never a rewrite of it, and `isExcerptOfQuote` is where that is
// decided rather than in the UI that happens to produce one.
// ---------------------------------------------------------------------------

describe("isExcerptOfQuote", () => {
  const quote = "Turned a vague brief into something we could actually ship.";

  it.each([
    ["the opening", "Turned a vague brief"],
    ["the middle", "vague brief into something"],
    ["the end", "we could actually ship."],
    ["the whole thing", quote],
  ])("takes %s", (_label, excerpt) => {
    expect(isExcerptOfQuote(quote, excerpt)).toBe(true);
  });

  // The point of the whole rule. An excerpt that is not a slice is a sentence
  // somebody did not write, published under their name.
  it.each([
    ["words never written", "Turned a vague brief into gold."],
    ["a single invented word", "Turned a VAGUE brief"],
    ["a stitched-together quote", "Turned a vague brief actually ship."],
  ])("refuses %s", (_label, excerpt) => {
    expect(isExcerptOfQuote(quote, excerpt)).toBe(false);
  });

  // A selection dragged with a mouse picks up the space either side of it. That
  // is the tool's noise, not an edit — trimmed, it is still their words.
  it("forgives whitespace around the selection", () => {
    expect(isExcerptOfQuote(quote, "  vague brief  ")).toBe(true);
  });

  it("refuses an empty excerpt", () => {
    expect(isExcerptOfQuote(quote, "   ")).toBe(false);
  });
});

describe("testimonialShown", () => {
  const row = {
    id: "t1",
    name: "Ada",
    quote: "The whole thing, every word of it.",
    createdAt: new Date(),
    avatarUrl: null,
    linkedinUrl: null,
    excerpt: null,
  };

  // The fallback is the WHOLE quote, not an empty card: a row with no excerpt
  // chosen yet is the normal state, and the words are still the point.
  it("falls back to the whole quote", () => {
    expect(testimonialShown(row)).toBe(row.quote);
  });

  it("prefers the excerpt once one is chosen", () => {
    expect(testimonialShown({ ...row, excerpt: "every word" })).toBe(
      "every word",
    );
  });
});

describe("TestimonialDetailsSchema (excerpt)", () => {
  const base = { id: "t1", avatarUrl: null, linkedinUrl: null };

  it("carries an excerpt through", () => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, excerpt: "vague brief" })
        .excerpt,
    ).toBe("vague brief");
  });

  // Cleared the same way the other two are — an emptied box is "show the whole
  // thing again", not an excerpt of nothing.
  it.each([null, "", "   "])("reads %j as no excerpt", (excerpt) => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, excerpt }).excerpt,
    ).toBeNull();
  });

  // ABSENT is not the same as cleared, and the schema has to keep them apart:
  // a caller editing only the picture is saying nothing about the excerpt, and
  // must not be read as asking for it to be thrown away.
  it("leaves an unnamed excerpt undefined rather than null", () => {
    expect(TestimonialDetailsSchema.parse(base).excerpt).toBeUndefined();
  });

  // Trimmed HERE so the stored value is the words and not the drag.
  it("trims the excerpt", () => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, excerpt: "  vague brief \n" })
        .excerpt,
    ).toBe("vague brief");
  });
});

// ---------------------------------------------------------------------------
// The tagline — who they are, under their name.
// ---------------------------------------------------------------------------

describe("TestimonialDetailsSchema (tagline)", () => {
  const base = { id: "t1", avatarUrl: null, linkedinUrl: null };

  it("takes a line about who said it", () => {
    const details = TestimonialDetailsSchema.parse({
      ...base,
      tagline: "Senior Product Designer at Shyft",
    });
    expect(details.tagline).toBe("Senior Product Designer at Shyft");
  });

  it("reads a blank box as no tagline at all", () => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, tagline: "   " }).tagline,
    ).toBeNull();
  });

  // The same three states the excerpt has, and for the same reason: a board
  // saving a picture must not silently drop a tagline it said nothing about.
  it("says nothing about a tagline it was not given", () => {
    expect(TestimonialDetailsSchema.parse(base).tagline).toBeUndefined();
  });

  it("refuses a paragraph pasted into the tagline box", () => {
    expect(() =>
      TestimonialDetailsSchema.parse({
        ...base,
        tagline: "x".repeat(TESTIMONIAL_TAGLINE_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });
});
