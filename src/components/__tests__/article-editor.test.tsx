// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inlineNodesToHtml, domToInlineNodes, ArticleEditor } from "../article-editor";
import type { InlineNode } from "@/domain/nodes";
import { useEditorStore } from "@/store/editor";

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

vi.mock("@/components/demo/registry", () => ({
  getDemoComponent: () => ({
    id: "calchemy-demo",
    label: "Calchemy Demo",
    Component: () => (
      <button type="button" data-testid="demo-interact" onClick={() => undefined}>
        Demo
      </button>
    ),
  }),
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
      "figcaption[data-placeholder='Caption media...']",
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
      "figcaption[data-placeholder='Caption component...']",
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
      "figcaption[data-placeholder='Caption media...']",
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

  it("Enter on a heading splits into two headings of the same level", () => {
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
    // New block inherits the heading type and level
    expect(blocks[1].type).toBe("heading");
    expect((blocks[1] as { level: number }).level).toBe(2);
  });

  it("Enter on a blockquote splits into two blockquotes", () => {
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
    expect(blocks[1].type).toBe("blockquote");
  });
});
