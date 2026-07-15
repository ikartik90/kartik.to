// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  inlineNodesToHtml,
  domToInlineNodes,
  ArticleEditor,
  transformMarksInRange,
  rangeHasMark,
  findLinkRangeAt,
  mergeAdjacentInlineNodes,
} from "../article-editor";
import type { InlineNode, Mark } from "@/domain/nodes";
import type { Document } from "@/domain/post";
import { useEditorStore } from "@/store/editor";
import { notifyContentUpdated } from "@/utils/content-sync";
import { createDraft, saveDraft } from "@/app/actions/post";

// ---------------------------------------------------------------------------
// Mock SVG icons and slash menu for component tests
// ---------------------------------------------------------------------------

vi.mock("@/assets/icons/subheading.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/paragraph.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/media.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/quote.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/code.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/border.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/trash.svg", () => ({ default: () => null }));

vi.mock("@/components/slash-menu", () => ({
  SlashMenu: ({
    onSelect,
    onDismiss,
  }: {
    onSelect: (t: string) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid="slash-menu">
      <button onClick={() => onSelect("heading")}>heading</button>
      <button onClick={() => onSelect("paragraph")}>paragraph</button>
      <button onClick={() => onSelect("media")}>media</button>
      <button onClick={() => onSelect("list_item")}>list_item</button>
      <button onClick={() => onSelect("bullet_list_item")}>bullet_list_item</button>
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
  slashMenuHasResults: () => true,
}));

vi.mock("@/components/image-insert-dialog", () => ({
  ImageInsertDialog: ({
    open,
    mode,
    onClose,
  }: {
    open: boolean;
    mode?: "insert" | "change";
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="image-dialog" data-mode={mode ?? "insert"}>
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

vi.mock("@/components/demo-frame", () => ({
  DemoFrame: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="demo-frame" {...props}>
      {children}
    </div>
  ),
}));

const demoRegistryEntry = vi.hoisted(() => ({
  id: "calchemy-demo",
  label: "Calchemy Demo",
  Component: () => (
    <button type="button" data-testid="demo-interact" onClick={() => undefined}>
      Demo
    </button>
  ),
}));

vi.mock("@/components/demo/registry", () => ({
  getDemoComponent: () => demoRegistryEntry,
  demoComponents: [demoRegistryEntry],
}));

// The editor imports server actions (⌘S save) and the router — stub both so the
// component renders under jsdom without pulling in Prisma / the app router.
const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/edit/new",
}));

const postActions = vi.hoisted(() => ({
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
}));
vi.mock("@/app/actions/post", () => postActions);

vi.mock("@/utils/content-sync", () => ({
  notifyContentUpdated: vi.fn(),
  subscribeContentUpdated: () => () => {},
}));

// ---------------------------------------------------------------------------
// inlineNodesToHtml
// ---------------------------------------------------------------------------

describe("inlineNodesToHtml", () => {
  it("renders plain text", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "hello" }];
    expect(inlineNodesToHtml(nodes)).toBe("hello");
  });

  it("wraps bold text in <strong>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<strong>bold</strong>");
  });

  it("wraps italic text in <em>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<em>italic</em>");
  });

  it("wraps code text in <code>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "fn()", marks: [{ type: "code" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<code>fn()</code>");
  });

  it("wraps highlighted text in <mark>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "note", marks: [{ type: "highlight" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">note</mark>',
    );
  });

  it("coalesces a styled sub-span within a highlight into a single <mark>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "hello ", marks: [{ type: "highlight" }] },
      {
        type: "text",
        text: "world",
        marks: [{ type: "highlight" }, { type: "italic" }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">hello <em>world</em></mark>',
    );
  });

  it("extracts highlight as the outer wrapper regardless of mark order", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "x",
        marks: [{ type: "italic" }, { type: "highlight" }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight"><em>x</em></mark>',
    );
  });

  it("keeps non-adjacent highlights in separate marks", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "a", marks: [{ type: "highlight" }] },
      { type: "text", text: "b" },
      { type: "text", text: "c", marks: [{ type: "highlight" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">a</mark>b<mark class="article-highlight">c</mark>',
    );
  });

  it("escapes HTML entities in text", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "<script>&" }];
    expect(inlineNodesToHtml(nodes)).toBe("&lt;script&gt;&amp;");
  });

  it("concatenates multiple nodes", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "hello " },
      { type: "text", text: "world", marks: [{ type: "bold" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("hello <strong>world</strong>");
  });

  it("returns empty string for empty array", () => {
    expect(inlineNodesToHtml([])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// domToInlineNodes
// ---------------------------------------------------------------------------

describe("domToInlineNodes", () => {
  function parse(html: string): InlineNode[] {
    const div = document.createElement("div");
    div.innerHTML = html;
    return domToInlineNodes(div);
  }

  it("extracts a plain text node", () => {
    expect(parse("hello")).toEqual([{ type: "text", text: "hello" }]);
  });

  it("extracts bold from <strong>", () => {
    expect(parse("<strong>bold</strong>")).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
  });

  it("extracts bold from <b>", () => {
    expect(parse("<b>bold</b>")).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
  });

  it("extracts italic from <em>", () => {
    expect(parse("<em>italic</em>")).toEqual([
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ]);
  });

  it("extracts code from <code>", () => {
    expect(parse("<code>fn()</code>")).toEqual([
      { type: "text", text: "fn()", marks: [{ type: "code" }] },
    ]);
  });

  it("extracts highlight from <mark>", () => {
    expect(parse("<mark>note</mark>")).toEqual([
      { type: "text", text: "note", marks: [{ type: "highlight" }] },
    ]);
  });

  it("extracts nested marks", () => {
    const result = parse("<strong><em>both</em></strong>");
    expect(result).toEqual([
      {
        type: "text",
        text: "both",
        marks: expect.arrayContaining([{ type: "bold" }, { type: "italic" }]),
      },
    ]);
  });

  it("returns empty array for empty element", () => {
    expect(parse("")).toEqual([]);
  });

  it("ignores BR tags", () => {
    expect(parse("hello<br>world")).toEqual([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ArticleEditor component
// ---------------------------------------------------------------------------

function openSlashMenuOnBlock(block: HTMLElement) {
  block.focus();
  block.textContent = "/";
  const textNode = block.firstChild!;
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(textNode, 1);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  fireEvent.keyUp(block, { key: "/" });
}

describe("ArticleEditor", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  it("renders the title input with placeholder 'Title'", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    expect(input).toBeDefined();
  });

  it("renders the body placeholder on the first block when body is empty", () => {
    render(<ArticleEditor />);
    const el = document.querySelector("[data-placeholder='Tell your story...']");
    expect(el).not.toBeNull();
  });

  it("renders the body placeholder on the first block when body is empty", () => {
    render(<ArticleEditor />);
    const el = document.querySelector("[data-placeholder='Tell your story...']");
    expect(el).not.toBeNull();
  });

  it("updates the code block language from the editor select", () => {
    const post = {
      id: "code1",
      slug: "code1",
      title: "Code Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "code_block" as const,
            children: [{ type: "text" as const, text: "const x = 1;" }],
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const select = screen.getByLabelText("Code language") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "typescript" } });

    expect(select.value).toBe("typescript");
  });

  it("appends a trailing paragraph after a terminal code block", () => {
    const post = {
      id: "code2",
      slug: "code2",
      title: "Code Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "code_block" as const,
            children: [{ type: "text" as const, text: "const x = 1;" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    // A code block is the last authored block; Enter inside it inserts a literal
    // newline, so the editor must synthesise an empty paragraph to escape into.
    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("code_block");
    expect(blocks[1].type).toBe("paragraph");
    expect((blocks[1] as { children: InlineNode[] }).children[0].text).toBe("");
  });

  // Regression: code blocks carry 32px (3xl) vertical padding — larger than the
  // ~24px code line height. Line detection used to measure the caret against the
  // element's border-box edge with a one-line tolerance, so the boundary line
  // fell outside the band and ArrowUp/ArrowDown could never leave the block.
  // Detection now measures against the content box (padding subtracted).
  describe("padded code block caret escape", () => {
    const rect = (top: number, bottom: number): DOMRect =>
      ({
        top,
        bottom,
        height: bottom - top,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;

    // Border box 0..100 with 32px vertical padding → content box 32..68.
    const mockGeometry = (pre: HTMLElement, caret: DOMRect) => {
      pre.getBoundingClientRect = () => rect(0, 100);
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) =>
        el === pre
          ? ({ paddingTop: "32px", paddingBottom: "32px" } as CSSStyleDeclaration)
          : realGetComputedStyle(el as Element, pseudo),
      );
      vi.spyOn(window, "getSelection").mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => ({ getBoundingClientRect: () => caret }),
        removeAllRanges: () => {},
        addRange: () => {},
      } as unknown as Selection);
    };

    afterEach(() => vi.restoreAllMocks());

    it("ArrowDown on the last visual line escapes to the block below", () => {
      const post = {
        id: "cbnav1",
        slug: "cbnav1",
        title: "Code Nav",
        category: "ARTICLE" as const,
        content: {
          type: "doc" as const,
          content: [
            {
              type: "code_block" as const,
              children: [{ type: "text" as const, text: "const x = 1;" }],
            },
            { type: "paragraph" as const, children: [{ type: "text" as const, text: "after" }] },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(<ArticleEditor initialPost={post} />);

      const pre = document.querySelector("[data-block-index='0']") as HTMLElement;
      const next = document.querySelector("[data-block-index='1']") as HTMLElement;
      // Caret bottom (68) sits at the content-box bottom, 32px above the border
      // edge — the geometry the old border-box check misread as "not last line".
      mockGeometry(pre, rect(44, 68));

      pre.focus();
      fireEvent.keyDown(pre, { key: "ArrowDown" });

      expect(document.activeElement).toBe(next);
    });

    it("ArrowUp on the first visual line escapes to the block above", () => {
      const post = {
        id: "cbnav2",
        slug: "cbnav2",
        title: "Code Nav",
        category: "ARTICLE" as const,
        content: {
          type: "doc" as const,
          content: [
            { type: "paragraph" as const, children: [{ type: "text" as const, text: "before" }] },
            {
              type: "code_block" as const,
              children: [{ type: "text" as const, text: "const x = 1;" }],
            },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(<ArticleEditor initialPost={post} />);

      const prev = document.querySelector("[data-block-index='0']") as HTMLElement;
      const pre = document.querySelector("[data-block-index='1']") as HTMLElement;
      // Caret top (32) sits at the content-box top, 32px below the border edge.
      mockGeometry(pre, rect(32, 56));

      pre.focus();
      fireEvent.keyDown(pre, { key: "ArrowUp" });

      expect(document.activeElement).toBe(prev);
    });
  });

  it("renders a figcaption with placeholder on image blocks", () => {
    const post = {
      id: "img1",
      slug: "img1",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
            alt: "Example photo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
    expect(document.querySelector("figure img")?.getAttribute("src")).toBe(
      "https://example.com/photo.png",
    );
  });

  it("renders a figcaption with placeholder on component blocks", () => {
    const post = {
      id: "comp1",
      slug: "comp1",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
    expect(screen.getByTestId("demo-interact")).toBeDefined();
    expect(document.querySelector("[inert]")).not.toBeNull();
  });

  it("does not allow interacting with the demo preview in edit mode", () => {
    const post = {
      id: "comp2",
      slug: "comp2",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const demoButton = screen.getByTestId("demo-interact");
    const clickSpy = vi.spyOn(demoButton, "click");

    fireEvent.click(demoButton);

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows delete action when the component block is focused", () => {
    const post = {
      id: "comp3",
      slug: "comp3",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const showcaseMedia = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(showcaseMedia);

    expect(screen.getByRole("button", { name: "Delete component" })).toBeDefined();
  });

  it("shows delete action when the horizontal rule is focused", () => {
    const post = {
      id: "hr1",
      slug: "hr1",
      title: "HR Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "horizontal_rule" as const },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const hr = document.querySelector("[role='separator']") as HTMLElement;
    fireEvent.focus(hr);

    expect(screen.getByRole("button", { name: "Delete horizontal rule" })).toBeDefined();
  });

  it("inserts a paragraph before the horizontal rule when Enter is pressed", () => {
    const post = {
      id: "hr-enter-before",
      slug: "hr-enter-before",
      title: "HR Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "horizontal_rule" as const },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const hr = document.querySelector("[role='separator']") as HTMLElement;
    hr.focus();
    fireEvent.keyDown(hr, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("horizontal_rule");
    expect(blocks[2].type).toBe("paragraph");
  });

  it("updates the image caption in the store when typing in figcaption", () => {
    const post = {
      id: "img2",
      slug: "img2",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    caption.textContent = "A sunny day";
    fireEvent.input(caption);

    const imageBlock = useEditorStore.getState().document.content[0];
    expect(imageBlock.type).toBe("image");
    if (imageBlock.type === "image") {
      expect(imageBlock.caption).toBe("A sunny day");
    }
  });

  it("does not delete the image block when pressing Delete in figcaption", () => {
    const post = {
      id: "img3",
      slug: "img3",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Keep me",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Delete" });

    expect(useEditorStore.getState().document.content[0]?.type).toBe("image");
    expect(document.querySelector("figure img")).not.toBeNull();
  });

  it("renders the focus overlay only over the image, not the caption", () => {
    const post = {
      id: "img4",
      slug: "img4",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const figure = document.querySelector("figure[data-showcase-block]") as HTMLElement;
    const img = figure.querySelector("img") as HTMLElement;
    fireEvent.focus(img);

    const overlay = figure.querySelector("[aria-hidden='true']");
    const caption = figure.querySelector("figcaption");
    expect(overlay).not.toBeNull();
    expect(caption?.contains(overlay)).toBe(false);
  });

  it("inserts a paragraph before the figure when Enter is pressed on showcase media", () => {
    const post = {
      id: "img-enter-before",
      slug: "img-enter-before",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("image");
    expect(blocks[2].type).toBe("paragraph");
  });

  it("moves focus from image to caption on ArrowDown", () => {
    const post = {
      id: "img5",
      slug: "img5",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "ArrowDown" });

    expect(document.activeElement).toBe(caption);
  });

  it("moves focus from image to caption on ArrowDown, but swallows Tab", () => {
    const post = {
      id: "img5b",
      slug: "img5b",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;

    // Tab is swallowed — it must not move the caret into the caption.
    img.focus();
    const notPrevented = fireEvent.keyDown(img, { key: "Tab" });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(img);

    // ArrowDown still descends into the caption.
    fireEvent.keyDown(img, { key: "ArrowDown" });
    expect(document.activeElement).toBe(caption);
  });

  it("inserts a paragraph after the figure when Enter is pressed in the caption", () => {
    const post = {
      id: "img-enter-after",
      slug: "img-enter-after",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Caption",
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Next block" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("image");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[2].type).toBe("paragraph");
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
    if (blocks[2].type === "paragraph") {
      expect(blocks[2].children[0]?.type === "text" && blocks[2].children[0].text).toBe(
        "Next block",
      );
    }
  });

  it("focuses the trailing paragraph when Enter is pressed in the caption on the last figure", async () => {
    const post = {
      id: "img-enter-trailing",
      slug: "img-enter-trailing",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    const trailingParagraph = document.querySelector(
      "p[data-block-index='1']",
    ) as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("image");
    expect(blocks[1].type).toBe("paragraph");
    expect(document.activeElement).toBe(trailingParagraph);
  });

  it("adds a hard line break in the caption on Shift+Enter", () => {
    const execCommand = vi.fn();
    document.execCommand = execCommand;

    const post = {
      id: "img-shift-enter",
      slug: "img-shift-enter",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter", shiftKey: true });

    expect(execCommand).toHaveBeenCalledWith("insertLineBreak");
  });

  it("moves focus from caption to image on ArrowUp at start", () => {
    const post = {
      id: "img6",
      slug: "img6",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Caption",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(caption);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(caption, { key: "ArrowUp" });

    expect(document.activeElement).toBe(img);
  });

  it("moves focus from empty caption to image on ArrowLeft at start", () => {
    const post = {
      id: "img8",
      slug: "img8",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(caption, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(caption, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(img);
  });

  it("deletes the image block when pressing Delete on the image", () => {
    const post = {
      id: "img7",
      slug: "img7",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Gone",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "Delete" });

    expect(useEditorStore.getState().document.content[0]?.type).toBe("paragraph");
    expect(document.querySelector("figure")).toBeNull();
  });

  it("shows change and delete actions when the image is focused", () => {
    const post = {
      id: "img9",
      slug: "img9",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(img);

    expect(screen.getByRole("button", { name: "Change Image..." })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete image" })).toBeDefined();
  });

  it("opens the image dialog in change mode from the overlay action", () => {
    const post = {
      id: "img10",
      slug: "img10",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(img);
    fireEvent.click(screen.getByRole("button", { name: "Change Image..." }));

    const dialog = screen.getByTestId("image-dialog");
    expect(dialog.getAttribute("data-mode")).toBe("change");
  });

  it("populates the title from initialPost", () => {
    const post = {
      id: "p1",
      slug: "p1",
      title: "My Post",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const input = screen.getByPlaceholderText("Title") as HTMLInputElement;
    expect(input.value).toBe("My Post");
  });

  it("updates the store title when typing in the title input", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    fireEvent.change(input, { target: { value: "New title" } });
    expect(useEditorStore.getState().title).toBe("New title");
  });

  it("pressing Enter in title moves focus to first body block", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    const firstBlock = document.querySelector("[data-block-index='0']") as HTMLElement;
    const focusSpy = vi.spyOn(firstBlock, "focus");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(focusSpy).toHaveBeenCalled();
  });

  it("does not show the slash menu initially", () => {
    render(<ArticleEditor />);
    expect(screen.queryByTestId("slash-menu")).toBeNull();
  });

  it("removes the slash trigger when a slash-menu item is selected", () => {
    render(<ArticleEditor />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    expect(screen.getByTestId("slash-menu")).toBeDefined();

    fireEvent.click(screen.getByText("media"));
    expect(screen.getByTestId("image-dialog")).toBeDefined();
    expect(block.textContent).toBe("");

    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("image-dialog")).toBeNull();
    expect(block.textContent).toBe("");
  });

  it("keeps the slash when the slash menu is dismissed", () => {
    render(<ArticleEditor />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    expect(screen.getByTestId("slash-menu")).toBeDefined();

    fireEvent.click(screen.getByText("dismiss"));
    expect(screen.queryByTestId("slash-menu")).toBeNull();
    expect(block.textContent).toBe("/");
  });

  it("Backspace at the start of a non-empty heading downgrades it to a paragraph", () => {
    const post = {
      id: "h1",
      slug: "h1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Hello" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    expect(block).not.toBeNull();

    block.focus();
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(block, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
    expect(
      "children" in blocks[0] &&
        blocks[0].children.some((n) => "text" in n && n.text === "Hello")
    ).toBe(true);
  });

  it("Backspace at the start of a non-empty blockquote downgrades it to a paragraph", () => {
    const post = {
      id: "bq1",
      slug: "bq1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(block, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
  });

  it("Enter on a heading splits into a heading and a paragraph", () => {
    const post = {
      id: "h2",
      slug: "h2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Hello World" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    // Place caret after "Hello " (offset 6 in the text node)
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // Original block keeps its type
    expect(blocks[0].type).toBe("heading");
    expect((blocks[0] as { level: number }).level).toBe(2);
    // New block is a default paragraph, not another heading
    expect(blocks[1].type).toBe("paragraph");
  });

  it("⌘B toggles bold on and off over the selection", () => {
    const post = {
      id: "cb",
      slug: "cb",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Hello World" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    const firstText = (root: Node): Text => {
      if (root.nodeType === Node.TEXT_NODE) return root as Text;
      return firstText(root.firstChild!);
    };
    const selectHello = () => {
      block.focus();
      // The first text node holds "Hello" in both the plain and bolded states
      // (bolded: <strong>Hello</strong> World; plain: "Hello World").
      const textNode = firstText(block);
      const sel = window.getSelection()!;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5); // "Hello"
      sel.removeAllRanges();
      sel.addRange(range);
    };

    // First ⌘B applies bold to "Hello".
    selectHello();
    fireEvent.keyDown(block, { key: "b", metaKey: true });
    let children = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    expect(children[0]).toEqual({
      type: "text",
      text: "Hello",
      marks: [{ type: "bold" }],
    });

    // Second ⌘B over the same selection removes it (toggle off).
    selectHello();
    fireEvent.keyDown(block, { key: "b", metaKey: true });
    children = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    expect(children[0].marks).toBeUndefined();
    expect(children[0].text).toBe("Hello World");
  });

  it("Backspace on an empty paragraph keeps the following paragraph intact", () => {
    const post = {
      id: "del",
      slug: "del",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Sub" }],
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Following" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    // Focus the empty paragraph (index 1) and delete it with Backspace.
    const empty = document.querySelector("[data-block-index='1']") as HTMLElement;
    empty.focus();
    fireEvent.keyDown(empty, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    // Only the empty paragraph is removed — heading + following paragraph remain.
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("heading");
    expect(blocks[1].type).toBe("paragraph");
    expect((blocks[1] as { children: InlineNode[] }).children[0].text).toBe(
      "Following",
    );
    // The reused DOM node must show the following paragraph's text, not the
    // deleted paragraph's stale empty content.
    const followingEl = document.querySelector(
      "[data-block-index='1']",
    ) as HTMLElement;
    expect(followingEl.textContent).toBe("Following");
  });

  it("Enter on a blockquote splits into a blockquote and a paragraph", () => {
    const post = {
      id: "bq2",
      slug: "bq2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("blockquote");
    expect(blocks[1].type).toBe("paragraph");
  });

  it("renders a subheading eyebrow caption with an 'Add caption...' placeholder", () => {
    const post = {
      id: "h-cap1",
      slug: "h-cap1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Section" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
  });

  it("updates the heading caption in the store when typing in the eyebrow", () => {
    const post = {
      id: "h-cap2",
      slug: "h-cap2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Section" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    caption.textContent = "Chapter One";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("heading");
    if (block.type === "heading") {
      expect(block.caption).toBe("Chapter One");
    }
  });

  it("clears the heading caption from the store when the eyebrow is emptied", () => {
    const post = {
      id: "h-cap3",
      slug: "h-cap3",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Section" }],
            caption: "Chapter One",
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    // Clear both innerText and textContent — jsdom stores innerText separately.
    caption.innerText = "";
    caption.textContent = "";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("heading");
    if (block.type === "heading") {
      expect(block.caption).toBeUndefined();
    }
  });

  it("renders a blockquote citation caption with an 'Add citation...' placeholder", () => {
    const post = {
      id: "bq-cap1",
      slug: "bq-cap1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    );
    expect(caption).not.toBeNull();
  });

  it("updates the blockquote caption in the store when typing in the citation", () => {
    const post = {
      id: "bq-cap2",
      slug: "bq-cap2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    caption.textContent = "Ada Lovelace";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("blockquote");
    if (block.type === "blockquote") {
      expect(block.caption).toBe("Ada Lovelace");
    }
  });

  it("clears the blockquote caption from the store when the citation is emptied", () => {
    const post = {
      id: "bq-cap3",
      slug: "bq-cap3",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "blockquote" as const,
            children: [{ type: "text" as const, text: "A quote" }],
            caption: "Ada Lovelace",
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    // Clear both innerText and textContent — jsdom stores innerText separately.
    caption.innerText = "";
    caption.textContent = "";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("blockquote");
    if (block.type === "blockquote") {
      expect(block.caption).toBeUndefined();
    }
  });

  it("inserts a paragraph after the blockquote when Enter is pressed in the citation caption", () => {
    const post = {
      id: "bq-cap-enter",
      slug: "bq-cap-enter",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "blockquote" as const,
            children: [{ type: "text" as const, text: "A quote" }],
            caption: "Ada Lovelace",
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Next block" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("blockquote");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[2].type).toBe("paragraph");
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
  });

  it("inserts a paragraph above when Enter is pressed at the start of a paragraph", () => {
    const post = {
      id: "p-enter-start",
      slug: "p-enter-start",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Hello World" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("paragraph");
    if (blocks[0].type === "paragraph") {
      expect(blocks[0].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children[0]?.type === "text" && blocks[1].children[0].text).toBe(
        "Hello World",
      );
    }
  });

  // -------------------------------------------------------------------------
  // Numbered list
  // -------------------------------------------------------------------------

  function listPost(text: string) {
    return {
      id: "li",
      slug: "li",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "list_item" as const, children: [{ type: "text" as const, text }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function placeCaret(block: HTMLElement, offset: number) {
    block.focus();
    const textNode = block.firstChild ?? block;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it("converts the block to a paragraph via the slash menu list_item selection", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    block.textContent = "/";
    placeCaret(block, 1);
    fireEvent.keyUp(block, { key: "/" });
    fireEvent.click(screen.getByText("list_item"));

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("list_item");
  });

  it("Enter at the end of a list item appends a new empty item after it", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // A trailing empty paragraph always follows the list.
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children[0]).toMatchObject({ text: "Hello" });
    if (blocks[1].type === "list_item")
      expect(blocks[1].children.every((c) => !c.text)).toBe(true);
  });

  it("Enter at the start of a list item prepends an empty item before it", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children.every((c) => !c.text)).toBe(true);
    if (blocks[1].type === "list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "Hello" });
  });

  it("does not leave stale text in the reused element when prepending a list item", () => {
    // Regression: the index-based key reuses the focused element as the new
    // empty item; without clearing its DOM the text is duplicated into it.
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const top = document.querySelector("[data-block-index='0']") as HTMLElement;
    const content = document.querySelector("[data-block-index='1']") as HTMLElement;
    expect(top.textContent).toBe("");
    expect(content.textContent).toBe("Hello");
  });

  it("Enter in the middle of a list item splits it into two items", () => {
    render(<ArticleEditor initialPost={listPost("HelloWorld")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 5);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children[0]).toMatchObject({ text: "Hello" });
    if (blocks[1].type === "list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "World" });
  });

  it("keeps a trailing empty paragraph when the last block is a list item", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual(["list_item", "paragraph"]);
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("paragraph");
    if (last.type === "paragraph")
      expect(last.children.every((c) => !c.text)).toBe(true);
    expect(document.querySelector("p[data-block-index='1']")).not.toBeNull();
  });

  it("Enter on an empty list item converts it into a paragraph", () => {
    render(<ArticleEditor initialPost={listPost("")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
  });

  // -------------------------------------------------------------------------
  // Bulleted list (shares list behaviour; only the marker differs)
  // -------------------------------------------------------------------------

  function bulletPost(text: string) {
    return {
      id: "bl",
      slug: "bl",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function bulletPostItems(
    items: Array<{ text: string; marker?: "check" | "cross" }>,
  ) {
    return {
      id: "bl",
      slug: "bl",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: items.map((it) => ({
          type: "bullet_list_item" as const,
          children: [{ type: "text" as const, text: it.text }],
          ...(it.marker ? { marker: it.marker } : {}),
        })),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it("creates a bullet_list_item via the slash menu", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    block.textContent = "/";
    placeCaret(block, 1);
    fireEvent.keyUp(block, { key: "/" });
    fireEvent.click(screen.getByText("bullet_list_item"));

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("bullet_list_item");
  });

  it("Enter at the end of a bullet item appends a new bullet item (same type)", () => {
    render(<ArticleEditor initialPost={bulletPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "bullet_list_item",
      "bullet_list_item",
      "paragraph",
    ]);
  });

  it("Enter on an empty bullet item converts it into a paragraph", () => {
    render(<ArticleEditor initialPost={bulletPost("")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    expect(useEditorStore.getState().document.content[0].type).toBe("paragraph");
  });

  it("carries the bullet glyph forward when Enter appends an item after", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "Hello", marker: "check" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBe("check");
  });

  it("carries the bullet glyph forward when Enter prepends an item before", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "Hello", marker: "cross" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // The new empty item is prepended; the "Hello" item shifts to index 1.
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBe("cross");
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "Hello" });
  });

  it("carries the bullet glyph forward when Enter splits an item", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "HelloWorld", marker: "check" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 5);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBe("check");
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBe("check");
  });

  it("resets a bullet run to the default dot via the popover", () => {
    render(
      <ArticleEditor
        initialPost={bulletPostItems([
          { text: "A", marker: "check" },
          { text: "B", marker: "check" },
        ])}
      />,
    );
    const marker = document.querySelectorAll("[data-bullet-marker]")[0] as HTMLElement;
    fireEvent.click(marker);
    fireEvent.click(screen.getByLabelText("Reset bullets to the default style"));

    const blocks = useEditorStore.getState().document.content;
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBeUndefined();
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBeUndefined();
  });

  it("continues the previous bullet run's style via the popover", () => {
    const post = {
      id: "bl2",
      slug: "bl2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "A" }],
            marker: "cross" as const,
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "gap" }],
          },
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "B" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const markers = document.querySelectorAll("[data-bullet-marker]");
    // The second run's marker button is the last one.
    fireEvent.click(markers[markers.length - 1] as HTMLElement);
    fireEvent.click(screen.getByLabelText("Continue bullets from previous list"));

    const blocks = useEditorStore.getState().document.content;
    if (blocks[2].type === "bullet_list_item")
      expect(blocks[2].marker).toBe("cross");
  });

  it("Backspace at the start of a paragraph merges it into a preceding bullet item without duplicating text", () => {
    const post = {
      id: "bl-merge",
      slug: "bl-merge",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "Item" }],
            marker: "check" as const,
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Tail" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const para = document.querySelector("[data-block-index='1']") as HTMLElement;
    placeCaret(para, 0);
    fireEvent.keyDown(para, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    // Paragraph merges into the bullet; a synthetic trailing paragraph follows
    // the now-terminal list item.
    expect(blocks.map((b) => b.type)).toEqual(["bullet_list_item", "paragraph"]);
    if (blocks[0].type === "bullet_list_item") {
      expect(blocks[0].children[0]).toMatchObject({ text: "ItemTail" });
      expect(blocks[0].marker).toBe("check");
    }
    // Regression: the reused (previously-focused) DOM node must show the empty
    // trailing paragraph, not the deleted paragraph's stale, duplicated "Tail".
    const itemEl = document.querySelector("[data-block-index='0']") as HTMLElement;
    const trailingEl = document.querySelector("[data-block-index='1']") as HTMLElement;
    expect(itemEl.textContent).toBe("ItemTail");
    expect(trailingEl.textContent).toBe("");
  });

  it("inserts a paragraph above when Enter is pressed at the start of a heading", () => {
    const post = {
      id: "h-enter-start",
      slug: "h-enter-start",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Title" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("heading");
    if (blocks[1].type === "heading") {
      expect(blocks[1].children[0]?.type === "text" && blocks[1].children[0].text).toBe(
        "Title",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Selection toolbar — mark manipulation helpers (pure)
// ---------------------------------------------------------------------------

describe("mergeAdjacentInlineNodes", () => {
  it("merges consecutive nodes with identical marks", () => {
    const out = mergeAdjacentInlineNodes([
      { type: "text", text: "foo", marks: [{ type: "bold" }] },
      { type: "text", text: "bar", marks: [{ type: "bold" }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("foobar");
  });

  it("keeps nodes with different marks separate and drops empties", () => {
    const out = mergeAdjacentInlineNodes([
      { type: "text", text: "a", marks: [{ type: "bold" }] },
      { type: "text", text: "" },
      { type: "text", text: "b" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.text)).toEqual(["a", "b"]);
  });
});

describe("rangeHasMark", () => {
  const nodes: InlineNode[] = [
    { type: "text", text: "Hello ", marks: [{ type: "bold" }] },
    { type: "text", text: "world", marks: [{ type: "bold" }, { type: "italic" }] },
  ];

  it("is true when every covered char carries the mark", () => {
    expect(rangeHasMark(nodes, 0, 11, "bold")).toBe(true);
  });

  it("is false when part of the range lacks the mark", () => {
    expect(rangeHasMark(nodes, 0, 11, "italic")).toBe(false);
  });

  it("is false for an empty (collapsed) range", () => {
    expect(rangeHasMark(nodes, 3, 3, "bold")).toBe(false);
  });
});

describe("transformMarksInRange", () => {
  it("adds a mark across the range, splitting at boundaries", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "abcdef" }];
    const out = transformMarksInRange(nodes, 2, 4, (marks) => [
      ...marks,
      { type: "bold" },
    ]);
    // "ab" | "cd"(bold) | "ef"
    expect(out).toHaveLength(3);
    expect(out[0].text).toBe("ab");
    expect(out[1].text).toBe("cd");
    expect(out[1].marks).toEqual([{ type: "bold" }]);
    expect(out[2].text).toBe("ef");
  });

  it("removes a mark and re-merges neighbouring plain text", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "ab" },
      { type: "text", text: "cd", marks: [{ type: "bold" }] },
      { type: "text", text: "ef" },
    ];
    const out = transformMarksInRange(nodes, 2, 4, (marks) =>
      marks.filter((m) => m.type !== "bold"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("abcdef");
    expect(out[0].marks).toBeUndefined();
  });

  it("returns nodes unchanged for a collapsed range", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "abc" }];
    expect(transformMarksInRange(nodes, 1, 1, (m) => m)).toBe(nodes);
  });
});

describe("findLinkRangeAt", () => {
  const nodes: InlineNode[] = [
    { type: "text", text: "see " },
    {
      type: "text",
      text: "this link",
      marks: [{ type: "link", href: "https://example.com" }],
    },
    { type: "text", text: " now" },
  ];

  it("returns the link's bounds and href when the caret is inside it", () => {
    const link = findLinkRangeAt(nodes, 7);
    expect(link).toEqual({ start: 4, end: 13, href: "https://example.com" });
  });

  it("returns null when the caret is outside any link", () => {
    expect(findLinkRangeAt(nodes, 1)).toBeNull();
  });

  it("expands across adjacent nodes sharing the same href", () => {
    const split: InlineNode[] = [
      { type: "text", text: "ab", marks: [{ type: "link", href: "https://x.io" }] },
      {
        type: "text",
        text: "cd",
        marks: [{ type: "bold" }, { type: "link", href: "https://x.io" }],
      },
    ];
    expect(findLinkRangeAt(split, 3)).toEqual({
      start: 0,
      end: 4,
      href: "https://x.io",
    });
  });
});

// ---------------------------------------------------------------------------
// Selection toolbar — component integration
// ---------------------------------------------------------------------------

describe("ArticleEditor selection toolbar", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  function seedParagraph(text: string) {
    const post = {
      id: "p1",
      slug: "s",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    return document.querySelector(
      "[data-block-index='0']",
    ) as HTMLElement;
  }

  function selectRange(el: HTMLElement, start: number, end: number) {
    const textNode = el.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    sel.removeAllRanges();
    sel.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
  }

  it("shows the format toolbar on a non-collapsed selection and toggles bold", () => {
    const block = seedParagraph("hello world");
    block.focus();
    selectRange(block, 0, 5);

    const toolbar = screen.getByRole("toolbar", { name: "Format selection" });
    expect(toolbar).toBeDefined();

    fireEvent.click(screen.getByLabelText("Bold"));

    const nodes = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    const bolded = nodes.find((n) =>
      (n.marks ?? []).some((m: Mark) => m.type === "bold"),
    );
    expect(bolded?.text).toBe("hello");
  });

  it("applies a link through the link editor", () => {
    const block = seedParagraph("click me");
    block.focus();
    selectRange(block, 0, 5);

    fireEvent.click(screen.getByLabelText("Add link"));

    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const nodes = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    const linked = nodes.find((n) =>
      (n.marks ?? []).some((m: Mark) => m.type === "link"),
    );
    expect(linked?.text).toBe("click");
    const linkMark = linked?.marks?.find((m: Mark) => m.type === "link");
    expect(linkMark && linkMark.type === "link" && linkMark.href).toBe(
      "https://example.com",
    );
  });
});

// ---------------------------------------------------------------------------
// ⌘S / Ctrl+S in-place save
// ---------------------------------------------------------------------------

describe("ArticleEditor ⌘S save", () => {
  const DIRTY_DOC: Document = {
    type: "doc",
    content: [
      { type: "paragraph", children: [{ type: "text", text: "edited" }] },
    ],
  };

  function pressSave() {
    return act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      // Flush the async save (createDraft/saveDraft → setDirty → clearAutosave).
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  it("saves an existing draft in place without navigating", async () => {
    const post = {
      id: "post-1",
      slug: "post-1",
      title: "Existing",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(saveDraft).mockResolvedValue({ ...post, content: DIRTY_DOC });
    render(<ArticleEditor initialPost={post} />);

    // Make an unsaved edit.
    act(() => useEditorStore.getState().setDocument(DIRTY_DOC));
    expect(useEditorStore.getState().isDirty).toBe(true);

    await pressSave();

    expect(saveDraft).toHaveBeenCalledWith({
      id: "post-1",
      title: "Existing",
      document: DIRTY_DOC,
    });
    expect(createDraft).not.toHaveBeenCalled();
    // Stays in the editor — no route change for an already-persisted draft.
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(notifyContentUpdated).toHaveBeenCalled();
  });

  it("creates a first-time draft and swaps to its edit URL", async () => {
    vi.mocked(createDraft).mockResolvedValue({
      id: "new-id",
      slug: "new-slug",
      title: null,
      category: "ARTICLE",
      content: DIRTY_DOC,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    render(<ArticleEditor />);

    act(() => useEditorStore.getState().setDocument(DIRTY_DOC));

    await pressSave();

    expect(createDraft).toHaveBeenCalledWith({
      title: undefined,
      document: DIRTY_DOC,
      category: "ARTICLE",
    });
    expect(useEditorStore.getState().draftId).toBe("new-id");
    expect(mockRouter.replace).toHaveBeenCalledWith(
      "/edit/new-slug?category=ARTICLE",
    );
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it("is a no-op when there are no unsaved changes", async () => {
    const post = {
      id: "post-2",
      slug: "post-2",
      title: "Clean",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    // initialPost load leaves isDirty false.
    expect(useEditorStore.getState().isDirty).toBe(false);

    await pressSave();

    expect(saveDraft).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Numbered-list marker popover (continue / reset / swap style)
// ---------------------------------------------------------------------------

describe("ArticleEditor numbering popover", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  type ListItem = { type: "list_item"; children: { type: "text"; text: string }[] };

  function seed(content: Document["content"]) {
    const post = {
      id: "num1",
      slug: "num1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
  }

  const listItem = (text: string): ListItem => ({
    type: "list_item",
    children: [{ type: "text", text }],
  });

  const markers = () =>
    Array.from(document.querySelectorAll("[data-numbering-marker]")).map(
      (el) => el.textContent,
    );

  const openPopoverForMarker = (i: number) => {
    const marker = document.querySelectorAll("[data-numbering-marker]")[i];
    fireEvent.click(marker);
  };

  it("opens the numbering popover when a marker is clicked", () => {
    seed([listItem("one"), listItem("two")]);
    expect(
      screen.queryByRole("toolbar", { name: "List numbering options" }),
    ).toBeNull();

    openPopoverForMarker(0);

    expect(
      screen.getByRole("toolbar", { name: "List numbering options" }),
    ).toBeDefined();
  });

  it("reset numbering restarts the counter at the clicked item", () => {
    seed([listItem("one"), listItem("two"), listItem("three")]);
    expect(markers()).toEqual(["1", "2", "3"]);

    openPopoverForMarker(2);
    fireEvent.click(screen.getByLabelText("Reset numbering at this item"));

    const block = useEditorStore.getState().document.content[2];
    expect(block.type === "list_item" && block.start).toBe(1);
    expect(markers()).toEqual(["1", "2", "1"]);
  });

  it("swaps the run to lettered markers and back", () => {
    seed([listItem("one"), listItem("two"), listItem("three")]);

    openPopoverForMarker(0);
    fireEvent.click(screen.getByLabelText("Switch to lettered list"));

    expect(markers()).toEqual(["a", "b", "c"]);
    const head = useEditorStore.getState().document.content[0];
    expect(head.type === "list_item" && head.marker).toBe("alpha");

    // The third button now offers switching back to numbers.
    openPopoverForMarker(1);
    fireEvent.click(screen.getByLabelText("Switch to numbered list"));
    expect(markers()).toEqual(["1", "2", "3"]);
  });

  it("continue numbering picks up from the previous list", () => {
    seed([
      listItem("a"),
      listItem("b"),
      listItem("c"),
      { type: "paragraph", children: [{ type: "text", text: "gap" }] },
      listItem("d"),
      listItem("e"),
    ]);
    expect(markers()).toEqual(["1", "2", "3", "1", "2"]);

    openPopoverForMarker(3); // head of the second list
    fireEvent.click(
      screen.getByLabelText("Continue numbering from previous list"),
    );

    expect(markers()).toEqual(["1", "2", "3", "4", "5"]);
    const head = useEditorStore.getState().document.content[4];
    expect(head.type === "list_item" && head.continued).toBe(true);
  });

  it("continue numbering is a no-op when no list precedes it", () => {
    seed([listItem("only"), listItem("list")]);

    openPopoverForMarker(0);
    fireEvent.click(
      screen.getByLabelText("Continue numbering from previous list"),
    );

    const head = useEditorStore.getState().document.content[0];
    expect(head.type === "list_item" && head.continued).toBeUndefined();
    expect(markers()).toEqual(["1", "2"]);
  });
});

// ---------------------------------------------------------------------------
// Block indentation (Tab / Shift+Tab)
// ---------------------------------------------------------------------------

describe("ArticleEditor block indent", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  function seed(block: Document["content"][number]) {
    const post = {
      id: "ind1",
      slug: "ind1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [block] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    return document.querySelector("[data-block-index='0']") as HTMLElement;
  }

  function caretAtStart(el: HTMLElement) {
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.firstChild ?? el, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function caretAtEnd(el: HTMLElement) {
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const para = (text: string) => ({
    type: "paragraph" as const,
    children: [{ type: "text" as const, text }],
  });

  const indentOf = (i = 0) => {
    const b = useEditorStore.getState().document.content[i];
    return (b as { indent?: boolean }).indent;
  };

  it("indents a paragraph on Tab at the start", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
    expect(document.querySelector("p[data-block-index='0'][data-indented]")).not.toBeNull();
  });

  it("outdents on Shift+Tab", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab", shiftKey: true });

    expect(indentOf()).toBeUndefined();
    expect(document.querySelector("[data-block-index='0'][data-indented]")).toBeNull();
  });

  it("Tab on an already-indented block is a no-op", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("Shift+Tab on a non-indented block is a no-op", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab", shiftKey: true });

    expect(indentOf()).toBeUndefined();
  });

  it("indents with the caret anywhere in the block (not just the start)", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("carries the indent to the new paragraph when splitting mid-block", () => {
    const el = seed({ ...para("hello world"), indent: true });
    el.focus();
    // Caret between "hello" and " world".
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.firstChild!, 5);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
    expect(content[1].type).toBe("paragraph");
  });

  it("carries the indent to a new block on Enter at the end", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("carries the indent to the empty paragraph on Enter at the start", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Enter" });

    // Both the new empty paragraph and the shifted content stay indented.
    const content = useEditorStore.getState().document.content;
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("splitting an indented heading yields an indented paragraph", () => {
    const el = seed({
      type: "heading",
      level: 2,
      indent: true,
      children: [{ type: "text", text: "Title" }],
    });
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect(content[0].type).toBe("heading");
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect(content[1].type).toBe("paragraph");
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("indents a blockquote on Tab", () => {
    const el = seed({
      type: "blockquote",
      children: [{ type: "text", text: "quote" }],
    });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("indents a metric on Tab", () => {
    const el = seed({
      type: "metric",
      children: [{ type: "text", text: "$1M" }],
    });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  // fireEvent.keyDown returns false when a handler called preventDefault — i.e.
  // Tab was swallowed and won't move the caret to the next node.
  it("swallows Tab on a list item without indenting", () => {
    const el = seed({
      type: "list_item",
      children: [{ type: "text", text: "item" }],
    });
    el.focus();
    caretAtStart(el);

    const notPrevented = fireEvent.keyDown(el, { key: "Tab" });

    expect(notPrevented).toBe(false);
    expect(indentOf()).toBeUndefined();
  });

  it("swallows Tab in a code block", () => {
    const el = seed({
      type: "code_block",
      children: [{ type: "text", text: "const x = 1" }],
    });
    el.focus();
    caretAtStart(el);

    expect(fireEvent.keyDown(el, { key: "Tab" })).toBe(false);
  });

  it("swallows Tab in the title", () => {
    seed(para("body"));
    const title = document.querySelector("#article-title") as HTMLElement;
    title.focus();

    expect(fireEvent.keyDown(title, { key: "Tab" })).toBe(false);
  });

  it("swallows Shift+Tab on a list item (no outdent jump)", () => {
    const el = seed({
      type: "list_item",
      children: [{ type: "text", text: "item" }],
    });
    el.focus();
    caretAtStart(el);

    expect(fireEvent.keyDown(el, { key: "Tab", shiftKey: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bulleted-list marker popover (dot / check / cross)
// ---------------------------------------------------------------------------

describe("ArticleEditor bullet popover", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  type BulletItem = {
    type: "bullet_list_item";
    marker?: "check" | "cross";
    children: { type: "text"; text: string }[];
  };

  function seed(items: BulletItem[]) {
    const post = {
      id: "bul1",
      slug: "bul1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: items },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
  }

  const bullet = (text: string, marker?: "check" | "cross"): BulletItem => ({
    type: "bullet_list_item",
    ...(marker ? { marker } : {}),
    children: [{ type: "text", text }],
  });

  const openPopover = (i: number) => {
    const marker = document.querySelectorAll("[data-bullet-marker]")[i];
    fireEvent.click(marker);
  };

  const markerOf = (i: number) => {
    const b = useEditorStore.getState().document.content[i];
    return b.type === "bullet_list_item" ? b.marker : undefined;
  };

  it("opens the bullet popover when a bullet is clicked", () => {
    seed([bullet("one"), bullet("two")]);
    expect(
      screen.queryByRole("toolbar", { name: "List bullet options" }),
    ).toBeNull();

    openPopover(0);

    expect(
      screen.getByRole("toolbar", { name: "List bullet options" }),
    ).toBeDefined();
    // Default (dot) option is selected.
    expect(
      screen.getByLabelText("Bulleted list").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("sets the check glyph when 'Checked list' is chosen", () => {
    seed([bullet("one")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Checked list"));

    expect(markerOf(0)).toBe("check");
    // The marker button now renders a glyph (svg) instead of the bare dot.
    expect(
      document.querySelector("[data-bullet-marker] svg"),
    ).not.toBeNull();
  });

  it("sets the cross glyph when 'Crossed list' is chosen", () => {
    seed([bullet("one")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Crossed list"));

    expect(markerOf(0)).toBe("cross");
  });

  it("returns to the default dot when 'Bulleted list' is chosen", () => {
    seed([bullet("one", "check")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Bulleted list"));

    expect(markerOf(0)).toBeUndefined();
    expect(document.querySelector("[data-bullet-marker] svg")).toBeNull();
  });

  it("styles bullets per-item (one check, one default)", () => {
    seed([bullet("one", "check"), bullet("two")]);
    expect(markerOf(0)).toBe("check");
    expect(markerOf(1)).toBeUndefined();
  });
});
