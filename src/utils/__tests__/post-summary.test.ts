import { describe, expect, it } from "vitest";
import type { BlockNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";
import {
  SUMMARY_MAX_CHARS,
  postDescription,
  postSummary,
} from "../post-summary";

const words = (text: string): BlockNode => ({
  type: "paragraph",
  children: [{ type: "text", text }],
});

const heading = (text: string): BlockNode => ({
  type: "heading",
  level: 2,
  children: [{ type: "text", text }],
});

const picture: BlockNode = {
  type: "media",
  kind: "image",
  src: "/a.png",
};

const doc = (...content: BlockNode[]): Document => ({ type: "doc", content });

describe("postSummary", () => {
  it("is the first thing the post actually says", () => {
    expect(postSummary(doc(words("A study of shift scheduling.")))).toBe(
      "A study of shift scheduling.",
    );
  });

  it("reads past the furniture a post opens with", () => {
    expect(
      postSummary(doc(picture, heading("Overview"), words("The real opening."))),
    ).toBe("The real opening.");
  });

  it("reads past a paragraph holding nothing but space", () => {
    expect(postSummary(doc(words("   "), words("The real opening.")))).toBe(
      "The real opening.",
    );
  });

  it("joins the run of text it starts in, up to the cap", () => {
    const summary = postSummary(doc(words("Shift scheduling."), words("Built for hospital floors.")));
    expect(summary).toBe("Shift scheduling. Built for hospital floors.");
  });

  it("stops at the cap, on a word rather than mid-word", () => {
    const long = "alpha ".repeat(100).trim();
    const summary = postSummary(doc(words(long)))!;
    expect(summary.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS + 1);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).not.toMatch(/alph…$/);
  });

  it("runs the inline pieces of a paragraph together as written", () => {
    expect(
      postSummary(
        doc({
          type: "paragraph",
          children: [
            { type: "text", text: "Redesigning " },
            { type: "text", text: "shift scheduling", marks: [{ type: "bold" }] },
            { type: "text", text: "." },
          ],
        }),
      ),
    ).toBe("Redesigning shift scheduling.");
  });

  it("has nothing to say about a post with no prose in it", () => {
    expect(postSummary(doc(picture))).toBeNull();
    expect(postSummary(doc())).toBeNull();
  });
});

describe("postDescription", () => {
  const opening = doc(words("The opening line of the post."));

  it("is the written description where the author wrote one", () => {
    expect(
      postDescription({ description: "Written for search.", content: opening }),
    ).toBe("Written for search.");
  });

  it("is the summary of the opening where there is none", () => {
    expect(postDescription({ description: null, content: opening })).toBe(
      "The opening line of the post.",
    );
    expect(postDescription({ content: opening })).toBe(
      "The opening line of the post.",
    );
  });

  it("reads a blank description as none", () => {
    expect(postDescription({ description: "   ", content: opening })).toBe(
      "The opening line of the post.",
    );
  });

  it("is null for a post with neither", () => {
    expect(postDescription({ description: null, content: doc() })).toBeNull();
  });
});
