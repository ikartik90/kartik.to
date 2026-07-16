// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArticleRenderer } from "../article-renderer";
import type { Document } from "@/domain/post";

vi.mock("@/components/demo-frame", () => ({
  DemoFrame: ({ children }: { children: ReactNode }) => (
    <div data-testid="demo-frame">{children}</div>
  ),
}));

vi.mock("@/components/demo/registry", () => ({
  getDemoComponent: () => ({
    id: "calchemy-demo",
    label: "Calchemy Demo",
    Component: () => <div data-testid="demo">Demo</div>,
  }),
}));

function doc(nodes: Document["content"]): Document {
  return { type: "doc", content: nodes };
}

describe("ArticleRenderer", () => {
  describe("block nodes", () => {
    it("renders a paragraph", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [{ type: "text", text: "Hello world" }],
            },
          ])}
        />,
      );
      expect(screen.getByText("Hello world")).toBeDefined();
    });

    it("renders an h2 heading", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "heading",
              level: 2,
              children: [{ type: "text", text: "Section title" }],
            },
          ])}
        />,
      );
      const heading = screen.getByRole("heading", { name: "Section title" });
      expect(heading.tagName).toBe("H2");
    });

    it("renders an h1 heading", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "heading",
              level: 1,
              children: [{ type: "text", text: "Page title" }],
            },
          ])}
        />,
      );
      const heading = screen.getByRole("heading", { name: "Page title" });
      expect(heading.tagName).toBe("H1");
    });

    it("renders an eyebrow caption above a subheading when present", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "heading",
              level: 2,
              children: [{ type: "text", text: "Section title" }],
              caption: "Chapter One",
            },
          ])}
        />,
      );
      const eyebrow = container.querySelector(".article-subheading-caption");
      expect(eyebrow).not.toBeNull();
      expect(eyebrow?.textContent).toBe("Chapter One");
    });

    it("omits the eyebrow caption when a heading has no caption", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "heading",
              level: 2,
              children: [{ type: "text", text: "Section title" }],
            },
          ])}
        />,
      );
      expect(container.querySelector(".article-subheading-caption")).toBeNull();
    });

    it("marks indented blocks with data-indented and leaves others unmarked", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "paragraph", indent: true, children: [{ type: "text", text: "Indented para" }] },
            { type: "paragraph", children: [{ type: "text", text: "Plain para" }] },
            { type: "blockquote", indent: true, children: [{ type: "text", text: "Indented quote" }] },
            { type: "metric", indent: true, children: [{ type: "text", text: "$1M" }] },
            { type: "heading", level: 2, indent: true, children: [{ type: "text", text: "Indented head" }] },
          ])}
        />,
      );
      const indented = container.querySelectorAll("[data-indented]");
      // paragraph + blockquote shell + metric + heading = 4
      expect(indented).toHaveLength(4);
      expect(screen.getByText("Indented para").hasAttribute("data-indented")).toBe(true);
      expect(screen.getByText("Plain para").hasAttribute("data-indented")).toBe(false);
      expect(
        container.querySelector(".article-blockquote-shell")?.hasAttribute("data-indented"),
      ).toBe(true);
    });

    it("renders a blockquote with decorative quote mark styling", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "blockquote",
              children: [{ type: "text", text: "A quoted thought" }],
            },
          ])}
        />,
      );
      const blockquote = container.querySelector("blockquote");
      expect(blockquote).toBeDefined();
      expect(blockquote?.className).toContain("article-blockquote");
      expect(
        container.querySelector(".article-blockquote-shell"),
      ).toBeDefined();
      expect(screen.getByText("A quoted thought")).toBeDefined();
    });

    it("renders a blockquote citation when a caption is present", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "blockquote",
              children: [{ type: "text", text: "A quoted thought" }],
              caption: "Ada Lovelace",
            },
          ])}
        />,
      );
      const cite = container.querySelector("cite");
      expect(cite).not.toBeNull();
      expect(cite?.textContent).toBe("Ada Lovelace");
    });

    it("omits the blockquote citation when no caption is present", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "blockquote",
              children: [{ type: "text", text: "A quoted thought" }],
            },
          ])}
        />,
      );
      expect(container.querySelector("cite")).toBeNull();
    });

    it("renders a code block", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "code_block",
              language: "css",
              children: [{ type: "text", text: ".foo { color: red; }" }],
            },
          ])}
        />,
      );
      expect(container.querySelector("pre")).toBeDefined();
      expect(container.querySelector('[data-syntax-role="primary"], [data-syntax-role="secondary"]')).toBeDefined();
      expect(
        container.querySelector("code")?.textContent,
      ).toBe(".foo { color: red; }");
    });

    it("renders a code block without highlighting when language is unset", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "code_block",
              children: [{ type: "text", text: "plain code" }],
            },
          ])}
        />,
      );

      expect(container.querySelector('[data-syntax-role]')).toBeNull();
      expect(screen.getByText("plain code")).toBeDefined();
    });

    it("groups consecutive list_item blocks into a single ordered list", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "list_item", children: [{ type: "text", text: "ListItemAlpha" }] },
            { type: "list_item", children: [{ type: "text", text: "ListItemBeta" }] },
            { type: "list_item", children: [{ type: "text", text: "ListItemGamma" }] },
          ])}
        />,
      );
      const lists = container.querySelectorAll("ol");
      expect(lists).toHaveLength(1);
      expect(lists[0].querySelectorAll("li")).toHaveLength(3);
      expect(container.textContent).toContain("ListItemAlpha");
    });

    it("does not zero-pad single-digit lists", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc(
            Array.from({ length: 9 }, (_, i) => ({
              type: "list_item" as const,
              children: [{ type: "text" as const, text: `Item ${i + 1}` }],
            })),
          )}
        />,
      );
      const markers = container.querySelectorAll(".list-marker");
      expect(markers[0].textContent).toBe("1");
      expect(markers[8].textContent).toBe("9");
    });

    it("zero-pads ordinals to the width of the largest number", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc(
            Array.from({ length: 12 }, (_, i) => ({
              type: "list_item" as const,
              children: [{ type: "text" as const, text: `Item ${i + 1}` }],
            })),
          )}
        />,
      );
      const markers = container.querySelectorAll(".list-marker");
      expect(markers[0].textContent).toBe("01");
      expect(markers[8].textContent).toBe("09");
      expect(markers[9].textContent).toBe("10");
      expect(markers[11].textContent).toBe("12");
    });

    it("renders lettered markers when the run head is styled alpha", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "list_item", marker: "alpha", children: [{ type: "text", text: "A" }] },
            { type: "list_item", children: [{ type: "text", text: "B" }] },
            { type: "list_item", children: [{ type: "text", text: "C" }] },
          ])}
        />,
      );
      const markers = container.querySelectorAll(".list-marker");
      expect(Array.from(markers).map((m) => m.textContent)).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("continues numbering across separate lists when the head opts in", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "list_item", children: [{ type: "text", text: "1" }] },
            { type: "list_item", children: [{ type: "text", text: "2" }] },
            { type: "list_item", children: [{ type: "text", text: "3" }] },
            { type: "paragraph", children: [{ type: "text", text: "gap" }] },
            { type: "list_item", continued: true, children: [{ type: "text", text: "4" }] },
            { type: "list_item", children: [{ type: "text", text: "5" }] },
          ])}
        />,
      );
      const lists = container.querySelectorAll("ol");
      expect(lists).toHaveLength(2);
      const markers = container.querySelectorAll(".list-marker");
      expect(Array.from(markers).map((m) => m.textContent)).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
      ]);
      // The continued list carries the semantic start ordinal for a11y.
      expect(lists[1].getAttribute("start")).toBe("4");
    });

    it("groups consecutive bullet_list_item blocks into a single unordered list", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "bullet_list_item", children: [{ type: "text", text: "BulletAlpha" }] },
            { type: "bullet_list_item", children: [{ type: "text", text: "BulletBeta" }] },
          ])}
        />,
      );
      const lists = container.querySelectorAll("ul");
      expect(lists).toHaveLength(1);
      expect(container.querySelectorAll("ol")).toHaveLength(0);
      expect(lists[0].querySelectorAll("li")).toHaveLength(2);
      expect(lists[0].querySelectorAll(".list-bullet")).toHaveLength(2);
      expect(container.textContent).toContain("BulletAlpha");
    });

    it("renders per-item check/cross bullet glyphs, keeping plain dots elsewhere", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "bullet_list_item", marker: "check", children: [{ type: "text", text: "Done" }] },
            { type: "bullet_list_item", marker: "cross", children: [{ type: "text", text: "Nope" }] },
            { type: "bullet_list_item", children: [{ type: "text", text: "Plain" }] },
          ])}
        />,
      );
      // Two badge markers (check + cross): each is a 24px box holding a 16px
      // gradient circle with an svg glyph; the third is a plain dot.
      expect(container.querySelectorAll(".list-bullet-icon")).toHaveLength(2);
      expect(
        container.querySelectorAll(".list-bullet-icon .list-bullet-circle"),
      ).toHaveLength(2);
      expect(
        container.querySelectorAll(".list-bullet-circle svg"),
      ).toHaveLength(2);
      expect(container.querySelectorAll(".list-bullet")).toHaveLength(1);
    });

    it("renders adjacent numbered and bulleted runs as separate ol and ul", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "list_item", children: [{ type: "text", text: "N1" }] },
            { type: "bullet_list_item", children: [{ type: "text", text: "B1" }] },
          ])}
        />,
      );
      expect(container.querySelectorAll("ol")).toHaveLength(1);
      expect(container.querySelectorAll("ul")).toHaveLength(1);
    });

    it("starts a new ordered list after a non-list block interrupts the run", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "list_item", children: [{ type: "text", text: "A" }] },
            { type: "paragraph", children: [{ type: "text", text: "break" }] },
            { type: "list_item", children: [{ type: "text", text: "B" }] },
          ])}
        />,
      );
      expect(container.querySelectorAll("ol")).toHaveLength(2);
    });

    it("renders a horizontal rule", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([{ type: "horizontal_rule" }])}
        />,
      );
      expect(container.querySelector("hr")).toBeDefined();
    });

    it("renders an image with caption", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "image",
              src: "https://example.com/img.png",
              alt: "An example image",
              caption: "Image caption text",
            },
          ])}
        />,
      );
      const img = screen.getByRole("img", { name: "An example image" });
      expect(img).toBeDefined();
      expect(screen.getByText("Image caption text")).toBeDefined();
    });

    it("renders an image without caption", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "image",
              src: "https://example.com/img.png",
              alt: "Alt only",
            },
          ])}
        />,
      );
      expect(screen.getByRole("img", { name: "Alt only" })).toBeDefined();
      expect(container.querySelector("figcaption")).toBeNull();
    });

    it("renders a component inside a figure with caption", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "component",
              componentId: "calchemy-demo",
              caption: "Component caption text",
            },
          ])}
        />,
      );
      const figure = container.querySelector("figure");
      expect(figure).not.toBeNull();
      expect(figure?.querySelector("[data-testid='demo']")).not.toBeNull();
      expect(screen.getByText("Component caption text")).toBeDefined();
    });

    it("omits figcaption for a component without caption", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "component",
              componentId: "calchemy-demo",
            },
          ])}
        />,
      );
      const figure = container.querySelector("figure");
      expect(figure).not.toBeNull();
      expect(figure?.querySelector("[data-testid='demo']")).not.toBeNull();
      expect(figure?.querySelector("figcaption")).toBeNull();
    });
  });

  describe("metric", () => {
    it("renders the caption, value, and subtext", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "metric",
              children: [{ type: "text", text: "$377k" }],
              caption: "GMV impact",
              subtext: "Additional GMV contributed since launch (Mar–Sep)",
            },
          ])}
        />,
      );
      expect(
        container.querySelector(".article-metric-caption")?.textContent,
      ).toBe("GMV impact");
      expect(container.querySelector(".article-metric-value")?.textContent).toBe(
        "$377k",
      );
      expect(container.querySelector(".article-metric-label")?.textContent).toBe(
        "Additional GMV contributed since launch (Mar–Sep)",
      );
    });

    it("omits the caption and subtext when absent", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "metric",
              children: [{ type: "text", text: "88%" }],
            },
          ])}
        />,
      );
      expect(container.querySelector(".article-metric-value")?.textContent).toBe(
        "88%",
      );
      expect(container.querySelector(".article-metric-caption")).toBeNull();
      expect(container.querySelector(".article-metric-label")).toBeNull();
    });
  });

  describe("inline marks", () => {
    it("renders bold text", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                { type: "text", text: "bold word", marks: [{ type: "bold" }] },
              ],
            },
          ])}
        />,
      );
      expect(container.querySelector("strong")).toBeDefined();
      expect(screen.getByText("bold word")).toBeDefined();
    });

    it("renders italic text", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "italic word",
                  marks: [{ type: "italic" }],
                },
              ],
            },
          ])}
        />,
      );
      expect(container.querySelector("em")).toBeDefined();
      expect(screen.getByText("italic word")).toBeDefined();
    });

    it("renders inline code", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "someFunction()",
                  marks: [{ type: "code" }],
                },
              ],
            },
          ])}
        />,
      );
      // The inline code mark renders inside a <p>, not a <pre>
      const codes = container.querySelectorAll("p code");
      expect(codes.length).toBeGreaterThan(0);
      expect(screen.getByText("someFunction()")).toBeDefined();
    });

    it("renders underlined text", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "underlined",
                  marks: [{ type: "underline" }],
                },
              ],
            },
          ])}
        />,
      );
      const u = container.querySelector("u");
      expect(u).not.toBeNull();
      expect(screen.getByText("underlined")).toBeDefined();
    });

    it("renders strikethrough text", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "struck",
                  marks: [{ type: "strikethrough" }],
                },
              ],
            },
          ])}
        />,
      );
      expect(container.querySelector("s")).not.toBeNull();
      expect(screen.getByText("struck")).toBeDefined();
    });

    it("renders a link", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "click here",
                  marks: [{ type: "link", href: "https://example.com" }],
                },
              ],
            },
          ])}
        />,
      );
      const link = screen.getByRole("link", { name: "click here" });
      expect(link.getAttribute("href")).toBe("https://example.com");
    });

    it("renders combined bold and italic marks", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "emphasis",
                  marks: [{ type: "bold" }, { type: "italic" }],
                },
              ],
            },
          ])}
        />,
      );
      expect(container.querySelector("strong")).toBeDefined();
      expect(container.querySelector("em")).toBeDefined();
    });
  });

  describe("sidenotes", () => {
    const twoNotes = doc([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "See " },
          {
            type: "text",
            text: "this",
            marks: [{ type: "sidenote", id: "n1", text: "First note" }],
          },
          { type: "text", text: " and " },
          {
            type: "text",
            text: "that",
            marks: [{ type: "sidenote", id: "n2", text: "Second note" }],
          },
        ],
      },
    ]);

    it("wraps annotated text in a sidenote span with an anchor-name and superscript", () => {
      const { container } = render(<ArticleRenderer content={twoNotes} />);
      const spans = container.querySelectorAll("[data-sidenote-id]");
      expect(spans.length).toBe(2);
      const first = spans[0] as HTMLElement;
      expect(first.getAttribute("data-sidenote-id")).toBe("n1");
      expect(first.style.getPropertyValue("anchor-name")).toBe("--sn-n1");
      expect(first.querySelector("sup")).not.toBeNull();
    });

    it("sets the document-order ordinal on each superscript (data-sidenote-number)", () => {
      const { container } = render(<ArticleRenderer content={twoNotes} />);
      const sups = container.querySelectorAll("[data-sidenote-id] sup");
      expect(
        Array.from(sups).map((s) => s.getAttribute("data-sidenote-number")),
      ).toEqual(["1", "2"]);
    });

    it("renders one aside card per note with its body text and matching anchor", () => {
      const { container } = render(<ArticleRenderer content={twoNotes} />);
      const cards = container.querySelectorAll("aside");
      expect(cards.length).toBe(2);
      // Scope to this render's container — the file renders without cleanup.
      expect(cards[0].querySelector(".sidenote-card-body")?.textContent).toBe(
        "First note",
      );
      expect(cards[1].querySelector(".sidenote-card-body")?.textContent).toBe(
        "Second note",
      );
      // Card is anchored to the annotation via --sn-anchor.
      expect(
        (cards[0] as HTMLElement).style.getPropertyValue("--sn-anchor"),
      ).toBe("--sn-n1");
    });

    it("renders no aside cards when there are no sidenotes", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            { type: "paragraph", children: [{ type: "text", text: "plain" }] },
          ])}
        />,
      );
      expect(container.querySelectorAll("aside").length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("renders an empty document without crashing", () => {
      const { container } = render(
        <ArticleRenderer content={doc([])} />,
      );
      expect(container).toBeDefined();
    });

    it("renders multiple block nodes in order", () => {
      render(
        <ArticleRenderer
          content={doc([
            {
              type: "heading",
              level: 2,
              children: [{ type: "text", text: "First" }],
            },
            {
              type: "paragraph",
              children: [{ type: "text", text: "Second" }],
            },
          ])}
        />,
      );
      expect(screen.getByText("First")).toBeDefined();
      expect(screen.getByText("Second")).toBeDefined();
    });

    it("renders plain text with no marks without extra wrapper elements", () => {
      const { container } = render(
        <ArticleRenderer
          content={doc([
            {
              type: "paragraph",
              children: [{ type: "text", text: "plain text" }],
            },
          ])}
        />,
      );
      // No mark elements inside the paragraph
      expect(container.querySelector("p strong")).toBeNull();
      expect(container.querySelector("p em")).toBeNull();
    });
  });
});
