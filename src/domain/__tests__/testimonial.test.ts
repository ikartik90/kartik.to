import { describe, expect, it } from "vitest";

import {
  TESTIMONIAL_NAME_MAX_LENGTH,
  TESTIMONIAL_QUOTE_MAX_LENGTH,
  TestimonialSubmissionSchema,
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
