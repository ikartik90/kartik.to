// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Link } from "../link";
import { Tooltip } from "../tooltip";

describe("Link", () => {
  afterEach(() => cleanup());

  it("renders an internal href as a router link", () => {
    render(
      <Link href="/about">
        <Link.Text>About</Link.Text>
      </Link>,
    );
    const link = screen.getByRole("link", { name: "About" });
    expect(link.getAttribute("href")).toBe("/about");
    // next/link does not add target/rel to internal links.
    expect(link.hasAttribute("target")).toBe(false);
  });

  it("renders an external href as a plain anchor with a safe rel", () => {
    render(
      <Link href="https://github.com/x" target="_blank" aria-label="GitHub">
        <svg />
      </Link>,
    );
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/x");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps a caller-provided rel", () => {
    render(
      <Link href="https://x.com" target="_blank" rel="me" aria-label="Me">
        <svg />
      </Link>,
    );
    expect(screen.getByRole("link", { name: "Me" }).getAttribute("rel")).toBe(
      "me",
    );
  });

  it("forwards ref to the anchor", () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link href="/" ref={ref}>
        Home
      </Link>,
    );
    expect(ref.current?.tagName).toBe("A");
  });

  it("hosts a cursor-following tooltip on hover", () => {
    render(
      <Link href="https://github.com/x" target="_blank" aria-label="GitHub">
        <svg />
        <Link.Tooltip>
          <Tooltip.Text>GitHub</Tooltip.Text>
          <svg />
        </Link.Tooltip>
      </Link>,
    );
    const link = screen.getByRole("link", { name: "GitHub" });
    const tip = screen.getByText("GitHub").parentElement as HTMLElement;
    expect(tip.getAttribute("aria-hidden")).toBe("true");
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseEnter(link, { clientX: 5, clientY: 5 });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.mouseLeave(link);
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });
});
