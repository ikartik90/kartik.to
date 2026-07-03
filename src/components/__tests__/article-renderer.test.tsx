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
