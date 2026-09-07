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
  postCardMedia,
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

  it("accepts a media node", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "media",
        kind: "image",
        src: "/uploads/photo.jpg",
        alt: "A photo",
      }).success
    ).toBe(true);
  });

  // A clip is the same block as a picture, distinguished by `kind` — see
  // `MediaNodeSchema`. The union has to carry media in BOTH of the places it
  // is written down, and only the schema half of that pair is testable.
  it("accepts a clip, with everything a picture takes", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "media",
        kind: "video",
        src: "/uploads/demo.mp4",
        alt: "A demo",
        caption: "The flow, end to end",
      }).success,
    ).toBe(true);
  });

  // Nothing sniffs the src any more: the block says which element it is.
  it("accepts a clip whose src does not look like one", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "media",
        kind: "video",
        src: "/media/8f2c-key",
      }).success,
    ).toBe(true);
  });

  // The block spelling every document on disk actually uses. `type: "image"`
  // was this block's IDENTITY, never a claim about the file, so the migration
  // reads the src and not the stored word — which is the whole reason `kind`
  // is a new field rather than a reuse of that one.
  it("migrates a legacy image block, taking its kind from the src", () => {
    const picture = BlockNodeSchema.parse({
      type: "image",
      src: "/uploads/photo.jpg",
      alt: "A photo",
    });
    expect(picture).toEqual({
      type: "media",
      kind: "image",
      src: "/uploads/photo.jpg",
      alt: "A photo",
    });

    // Every mp4 ever inserted as a standalone block is stored under
    // `type: "image"`. Believing that literal would strand each one.
    expect(
      BlockNodeSchema.parse({ type: "image", src: "/uploads/demo.mp4" }),
    ).toEqual({ type: "media", kind: "video", src: "/uploads/demo.mp4" });
  });

  // A BLOCK has always had to say what it is. The old `ImageNodeSchema` made
  // `type` a required literal, so a typeless object could never have parsed as
  // one — every media block in every document that has ever loaded carries it.
  // The migration's tolerance of an absent `type` exists for COLLECTION ITEMS,
  // which were written `{ src, alt? }` with no type at all, and letting that
  // tolerance reach the block union quietly turned every malformed block into a
  // media block instead of a parse error.
  it("refuses a block that never says what it is", () => {
    expect(BlockNodeSchema.safeParse({ src: "/a.png" }).success).toBe(false);
    expect(
      BlockNodeSchema.safeParse({ src: "/a.png", alt: "A" }).success,
    ).toBe(false);
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

  it("accepts a collection node holding a clip beside a picture", () => {
    expect(
      BlockNodeSchema.safeParse({
        type: "collection",
        items: [
          { type: "media", kind: "image", src: "/uploads/a.jpg" },
          { type: "media", kind: "video", src: "/uploads/demo.mp4" },
        ],
      }).success,
    ).toBe(true);
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

  // A post pins to the homepage grid exactly the way a published component
  // does — same field, same rules — so these mirror the `ComponentSchema`
  // cases in `component.test.ts`.

  // Asserts the parsed VALUE, not just success — Zod strips unknown keys, so a
  // post carrying a `gridIndex` the schema has never heard of parses happily
  // and drops the pin on the floor.
  it("accepts a post pinned to a grid position and keeps the pin", () => {
    const result = PostSchema.safeParse({ ...validPost, gridIndex: 3 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gridIndex).toBe(3);
  });

  it("accepts an unpinned post (gridIndex is null)", () => {
    expect(
      PostSchema.safeParse({ ...validPost, gridIndex: null }).success
    ).toBe(true);
  });

  it("rejects a post pinned to a negative grid position", () => {
    expect(PostSchema.safeParse({ ...validPost, gridIndex: -1 }).success).toBe(
      false
    );
  });

  it("rejects a post pinned to a fractional grid position", () => {
    expect(PostSchema.safeParse({ ...validPost, gridIndex: 1.5 }).success).toBe(
      false
    );
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

// ---------------------------------------------------------------------------
// The card a post draws on the homepage, beyond what the post decides for it
// ---------------------------------------------------------------------------

describe("PostSchema — card", () => {
  const picture = { type: "media", kind: "image", src: "/a.png" };

  it("accepts a post with no card of its own", () => {
    expect(PostSchema.safeParse(validPost).success).toBe(true);
    expect(PostSchema.safeParse({ ...validPost, card: null }).success).toBe(
      true,
    );
  });

  it("carries a picture per theme, a scrim and a tone", () => {
    const card = {
      media: { light: picture, dark: picture },
      scrim: false,
      tone: "dark",
    };
    const result = PostSchema.safeParse({ ...validPost, card });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.card).toEqual(card);
  });

  // The one line of the caption a post can leave unwritten — see the schema.
  it("carries the meta line for a card the post files under nothing", () => {
    const result = PostSchema.safeParse({
      ...validPost,
      card: { meta: "Case Study" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.card).toEqual({ meta: "Case Study" });
  });

  // A post's card has no content section — the words are the post's — so the
  // ground sits at the top level, where a link card's sits under `content`. A
  // blob written the link card's way is stripped, not read.
  it("holds the ground beside the media, not under a content key", () => {
    const result = PostSchema.safeParse({
      ...validPost,
      card: { content: { scrim: true } },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.card).toEqual({});
  });

  // `parsePost` is the one reader of a post, and it throws on failure — so a
  // card blob that no longer parses would 404 the article over its tile. The
  // card is the trim; the post is the page. Lose the trim.
  it("drops a card that no longer parses rather than the post", () => {
    const result = PostSchema.safeParse({
      ...validPost,
      card: { tone: "sepia" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.card).toBeNull();
  });
});

describe("postCardMedia", () => {
  const derived = { type: "media", kind: "image", src: "/first.png" } as const;
  const light = { type: "media", kind: "image", src: "/light.png" } as const;
  const dark = { type: "media", kind: "image", src: "/dark.png" } as const;

  it("shows the document's first picture when nobody has chosen one", () => {
    expect(postCardMedia({}, derived)).toEqual({ light: derived, dark: null });
  });

  it("shows nothing when the document has none either", () => {
    expect(postCardMedia({}, null)).toEqual({ light: null, dark: null });
  });

  it("shows what the author chose once the media has been taken over", () => {
    expect(postCardMedia({ media: { light, dark } }, derived)).toEqual({
      light,
      dark,
    });
  });

  // Taken over is taken over: an emptied slot is a flat plate, not the
  // document's picture coming back. See `PostCardConfigSchema`.
  it("leaves an emptied slot empty rather than falling back to the document", () => {
    expect(postCardMedia({ media: { dark } }, derived)).toEqual({
      light: null,
      dark,
    });
    expect(postCardMedia({ media: {} }, derived)).toEqual({
      light: null,
      dark: null,
    });
  });
});
