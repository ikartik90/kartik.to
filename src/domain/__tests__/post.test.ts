import { describe, expect, it } from "vitest";
import {
  BlockNodeSchema,
  COLLECTION_MAX_ITEMS,
  MarkSchema,
  TextNodeSchema,
} from "../nodes";
import {
  CreatePostInputSchema,
  DocumentSchema,
  PostCategorySchema,
  PostSchema,
} from "../post";

// ---------------------------------------------------------------------------
// MarkSchema
// ---------------------------------------------------------------------------

describe("MarkSchema", () => {
  it("accepts bold", () => {
    expect(MarkSchema.safeParse({ type: "bold" }).success).toBe(true);
  });

  it("accepts italic", () => {
    expect(MarkSchema.safeParse({ type: "italic" }).success).toBe(true);
  });

  it("accepts code", () => {
    expect(MarkSchema.safeParse({ type: "code" }).success).toBe(true);
  });

  it("accepts underline", () => {
    expect(MarkSchema.safeParse({ type: "underline" }).success).toBe(true);
  });

  it("accepts strikethrough", () => {
    expect(MarkSchema.safeParse({ type: "strikethrough" }).success).toBe(true);
  });

  it("accepts highlight", () => {
    expect(MarkSchema.safeParse({ type: "highlight" }).success).toBe(true);
  });

  it("accepts link with a valid href", () => {
    expect(
      MarkSchema.safeParse({ type: "link", href: "https://example.com" }).success
    ).toBe(true);
  });

  it("rejects link without href", () => {
    expect(MarkSchema.safeParse({ type: "link" }).success).toBe(false);
  });

  it("rejects link with a non-URL href", () => {
    expect(
      MarkSchema.safeParse({ type: "link", href: "not-a-url" }).success
    ).toBe(false);
  });

  it("rejects an unknown mark type", () => {
    expect(MarkSchema.safeParse({ type: "wavy_underline" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TextNodeSchema
// ---------------------------------------------------------------------------

describe("TextNodeSchema", () => {
  it("accepts a plain text node", () => {
    expect(
      TextNodeSchema.safeParse({ type: "text", text: "hello" }).success
    ).toBe(true);
  });

  it("accepts a text node with marks", () => {
    expect(
      TextNodeSchema.safeParse({
        type: "text",
        text: "hello",
        marks: [{ type: "bold" }],
      }).success
    ).toBe(true);
  });

  it("accepts a text node with empty text", () => {
    expect(TextNodeSchema.safeParse({ type: "text", text: "" }).success).toBe(
      true
    );
  });

  it("rejects a text node missing text", () => {
    expect(TextNodeSchema.safeParse({ type: "text" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BlockNodeSchema
// ---------------------------------------------------------------------------

describe("BlockNodeSchema", () => {
  it("accepts a paragraph node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "paragraph",
        children: [{ type: "text", text: "Hello" }],
      }).success
    ).toBe(true);
  });

  it("accepts a heading node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Title" }],
      }).success
    ).toBe(true);
  });

  it("rejects a heading with an invalid level", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "heading",
        level: 7,
        children: [{ type: "text", text: "Title" }],
      }).success
    ).toBe(false);
  });

  it("accepts a heading node with a caption", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Title" }],
        caption: "Section",
      }).success
    ).toBe(true);
  });

  it("accepts a blockquote node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "blockquote",
        children: [{ type: "text", text: "A quote" }],
      }).success
    ).toBe(true);
  });

  it("accepts a blockquote node with a caption", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "blockquote",
        children: [{ type: "text", text: "A quote" }],
        caption: "Some Author",
      }).success
    ).toBe(true);
  });

  it("accepts a list_item node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "list_item",
        children: [{ type: "text", text: "First item" }],
      }).success
    ).toBe(true);
  });

  it("rejects a list_item node missing children", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "list_item" }).success
    ).toBe(false);
  });

  it("accepts a bullet_list_item node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "bullet_list_item",
        children: [{ type: "text", text: "First bullet" }],
      }).success
    ).toBe(true);
  });

  it("accepts a code_block node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "code_block",
        language: "typescript",
        children: [{ type: "text", text: "const x = 1;" }],
      }).success
    ).toBe(true);
  });

  it("rejects an unsupported code_block language", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "code_block",
        language: "python",
        children: [{ type: "text", text: "print('hi')" }],
      }).success
    ).toBe(false);
  });

  it("accepts a horizontal_rule node", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "horizontal_rule" }).success
    ).toBe(true);
  });

  it("accepts an image node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "image",
        src: "/uploads/photo.jpg",
        alt: "A photo",
      }).success
    ).toBe(true);
  });

  it("accepts a component block node with caption", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "component",
        componentId: "placeholder",
        caption: "Demo caption",
      }).success,
    ).toBe(true);
  });

  it("accepts a component block node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "component",
        componentId: "placeholder",
      }).success,
    ).toBe(true);
  });

  it("rejects a component node with an empty componentId", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "component",
        componentId: "",
      }).success,
    ).toBe(false);
  });

  it("accepts a metric node with a caption, value, and subtext", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "metric",
        children: [{ type: "text", text: "$377k" }],
        caption: "GMV impact",
        subtext: "Additional GMV contributed since launch (Mar–Sep)",
      }).success,
    ).toBe(true);
  });

  it("accepts a metric node without a caption or subtext", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "metric",
        children: [{ type: "text", text: "$377k" }],
      }).success,
    ).toBe(true);
  });

  it("accepts a collection node with items and a block caption", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "collection",
        items: [
          { src: "/uploads/a.jpg", alt: "A", caption: "First" },
          { src: "/uploads/b.jpg" },
        ],
        caption: "Field notes",
      }).success,
    ).toBe(true);
  });

  // The editor can empty a collection slot by slot; a minimum would make the
  // document unparseable mid-edit.
  it("accepts a collection node with no items", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "collection", items: [] }).success,
    ).toBe(true);
  });

  it("rejects a collection node past COLLECTION_MAX_ITEMS", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "collection",
        items: Array.from({ length: COLLECTION_MAX_ITEMS + 1 }, (_, i) => ({
          src: `/uploads/${i}.jpg`,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects a collection item without a src", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "collection",
        items: [{ alt: "No source" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown block type", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "table", children: [] }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DocumentSchema
// ---------------------------------------------------------------------------

describe("DocumentSchema", () => {
  const minimalDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Hello world" }],
      },
    ],
  };

  it("accepts a valid document", () => {
    expect(DocumentSchema.safeParse(minimalDoc).success).toBe(true);
  });

  it("accepts a document with an empty content array", () => {
    expect(
      DocumentSchema.safeParse({ type: "doc", content: [] }).success
    ).toBe(true);
  });

  it("rejects a document missing type", () => {
    expect(DocumentSchema.safeParse({ content: [] }).success).toBe(false);
  });

  it("rejects a document with a malformed block", () => {
    expect(
      DocumentSchema.safeParse({
        type: "doc",
        content: [{ type: "paragraph" }],
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PostCategorySchema
// ---------------------------------------------------------------------------

describe("PostCategorySchema", () => {
  it.each(["ARTICLE", "WORK", "PAGE"])(
    "accepts %s",
    (category) => {
      expect(PostCategorySchema.safeParse(category).success).toBe(true);
    }
  );

  it("rejects an unknown category", () => {
    expect(PostCategorySchema.safeParse("NEWSLETTER").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PostSchema
// ---------------------------------------------------------------------------

const validPost = {
  id: "clxyz123",
  slug: "my-first-post",
  category: "ARTICLE",
  content: { type: "doc", content: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PostSchema", () => {
  it("accepts a valid post", () => {
    expect(PostSchema.safeParse(validPost).success).toBe(true);
  });

  it("accepts a post without a title (titleless content)", () => {
    expect(
      PostSchema.safeParse({ ...validPost, title: undefined }).success
    ).toBe(true);
  });

  it("accepts a published post (publishedAt is a Date)", () => {
    expect(
      PostSchema.safeParse({ ...validPost, publishedAt: new Date() }).success
    ).toBe(true);
  });

  it("accepts a draft post (publishedAt is null)", () => {
    expect(
      PostSchema.safeParse({ ...validPost, publishedAt: null }).success
    ).toBe(true);
  });

  it("rejects a post with an empty slug", () => {
    expect(PostSchema.safeParse({ ...validPost, slug: "" }).success).toBe(false);
  });

  it("rejects a post missing slug", () => {
    const { slug, ...withoutSlug } = validPost;
    expect(PostSchema.safeParse(withoutSlug).success).toBe(false);
  });

  it("rejects a post with an invalid category", () => {
    expect(
      PostSchema.safeParse({ ...validPost, category: "DRAFT" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreatePostInputSchema
// ---------------------------------------------------------------------------

describe("CreatePostInputSchema", () => {
  it("accepts valid create input without server-generated fields", () => {
    const input = {
      slug: "new-post",
      content: { type: "doc", content: [] },
    };
    expect(CreatePostInputSchema.safeParse(input).success).toBe(true);
  });

  it("strips id when included (Zod default strip mode)", () => {
    const input = {
      id: "clxyz123",
      slug: "new-post",
      content: { type: "doc", content: [] },
    };
    const result = CreatePostInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("id" in result.data).toBe(false);
    }
  });
});
