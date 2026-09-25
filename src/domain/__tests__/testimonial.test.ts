import { describe, expect, it } from "vitest";

import {
  TESTIMONIAL_NAME_MAX_LENGTH,
  TESTIMONIAL_QUOTE_MAX_LENGTH,
  TestimonialDetailsSchema,
  TESTIMONIAL_TAGLINE_MAX_LENGTH,
  TestimonialSubmissionSchema,
  isExcerptOfQuote,
  testimonialShown,
  testimonialInitial,
  linkedInHandle,
} from "../testimonial";

const valid = {
  name: "Ada Lovelace",
  quote: "Shipped the thing, on time, and it was beautiful.",
};

describe("TestimonialSubmissionSchema", () => {
  it("takes a well-formed submission", () => {
    expect(TestimonialSubmissionSchema.parse(valid)).toEqual(valid);
  });

  it("trims the name and the quote", () => {
    expect(
      TestimonialSubmissionSchema.parse({
        name: "  Ada Lovelace \n",
        quote: "\t Shipped it. ",
      }),
    ).toEqual({ name: "Ada Lovelace", quote: "Shipped it." });
  });

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

  it("counts the quote's length after trimming", () => {
    const quote = "x".repeat(TESTIMONIAL_QUOTE_MAX_LENGTH);
    expect(
      TestimonialSubmissionSchema.safeParse({ ...valid, quote: `  ${quote}  ` })
        .success,
    ).toBe(true);
  });

  it("ignores fields the form no longer collects", () => {
    expect(
      TestimonialSubmissionSchema.parse({
        ...valid,
        linkedinUrl: "https://www.linkedin.com/in/ada",
      }),
    ).toEqual(valid);
  });
});

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

  it("leaves an unnamed name undefined", () => {
    expect(
      TestimonialDetailsSchema.parse({ id, avatarUrl: null, linkedinUrl: null })
        .name,
    ).toBeUndefined();
  });

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

  it.each([
    ["words never written", "Turned a vague brief into gold."],
    ["a single invented word", "Turned a VAGUE brief"],
    ["a stitched-together quote", "Turned a vague brief actually ship."],
  ])("refuses %s", (_label, excerpt) => {
    expect(isExcerptOfQuote(quote, excerpt)).toBe(false);
  });

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

  it.each([null, "", "   "])("reads %j as no excerpt", (excerpt) => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, excerpt }).excerpt,
    ).toBeNull();
  });

  it("leaves an unnamed excerpt undefined rather than null", () => {
    expect(TestimonialDetailsSchema.parse(base).excerpt).toBeUndefined();
  });

  it("trims the excerpt", () => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, excerpt: "  vague brief \n" })
        .excerpt,
    ).toBe("vague brief");
  });
});

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

describe("TestimonialDetailsSchema (published)", () => {
  const base = { id: "t1", avatarUrl: null, linkedinUrl: null };

  it.each([true, false])("takes the switch's position (%s)", (published) => {
    expect(
      TestimonialDetailsSchema.parse({ ...base, published }).published,
    ).toBe(published);
  });

  it("says nothing about publication it was not asked about", () => {
    expect(TestimonialDetailsSchema.parse(base).published).toBeUndefined();
  });

  it.each(["true", "yes", 1, null])("refuses %j as an answer", (published) => {
    expect(() =>
      TestimonialDetailsSchema.parse({ ...base, published }),
    ).toThrow();
  });
});

describe("TestimonialSubmissionSchema (published)", () => {
  it("strips a publication a stranger tried to grant themselves", () => {
    const parsed = TestimonialSubmissionSchema.parse({
      name: "Ada",
      quote: "Worth reading.",
      published: true,
      publishedAt: new Date(),
    });
    expect(parsed).toEqual({ name: "Ada", quote: "Worth reading." });
  });
});

describe("testimonialInitial", () => {
  it("stands in for a missing picture with the first character", () => {
    expect(testimonialInitial("Ada Lovelace")).toBe("A");
  });

  it("ignores the space somebody left in front of their name", () => {
    expect(testimonialInitial("  Grace Hopper")).toBe("G");
  });

  it("takes one character, not a set of initials", () => {
    expect(testimonialInitial("Ada Lovelace")).toHaveLength(1);
  });

  it("draws nothing rather than guessing at an empty name", () => {
    expect(testimonialInitial("   ")).toBe("");
  });

  it("keeps a character that is two code units wide", () => {
    expect(testimonialInitial("𝒜da")).toBe("𝒜");
  });
});

describe("linkedInHandle", () => {
  it("reads a profile URL as the handle alone", () => {
    expect(linkedInHandle("https://www.linkedin.com/in/ada")).toBe("ada");
  });

  it("ignores a trailing slash, which is how a browser hands the URL over", () => {
    expect(linkedInHandle("https://www.linkedin.com/in/ada/")).toBe("ada");
  });

  it("keeps a path that is not a person's", () => {
    expect(linkedInHandle("https://www.linkedin.com/company/acme")).toBe(
      "company/acme",
    );
  });

  it("shows an unparseable value as itself", () => {
    expect(linkedInHandle("not-a-url")).toBe("not-a-url");
  });

  it("falls back to the whole value when there is no handle in it", () => {
    expect(linkedInHandle("https://www.linkedin.com/")).toBe(
      "https://www.linkedin.com/",
    );
  });
});
