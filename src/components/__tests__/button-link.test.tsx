// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ButtonLink, buttonLinkClass } from "../button-link";

describe("ButtonLink", () => {
  afterEach(() => cleanup());

  it("is a link to where it says", () => {
    render(<ButtonLink href="/about">About me</ButtonLink>);
    expect(
      screen.getByRole("link", { name: "About me" }).getAttribute("href"),
    ).toBe("/about");
  });

  it("wears the shared button look, rounded into a pill", () => {
    render(<ButtonLink href="/about">About me</ButtonLink>);
    const link = screen.getByRole("link", { name: "About me" });
    for (const name of buttonLinkClass().split(" ")) {
      expect(link.classList.contains(name)).toBe(true);
    }
  });

  it("opens a web address in the same tab, safely", () => {
    render(<ButtonLink href="https://cal.com/kartik">Book a call</ButtonLink>);
    const link = screen.getByRole("link", { name: "Book a call" });
    expect(link.getAttribute("href")).toBe("https://cal.com/kartik");
    expect(link.getAttribute("target")).toBeNull();
  });

  it("opens in a new tab when asked to, safely", () => {
    render(
      <ButtonLink href="https://cal.com/kartik" newTab>
        Book a call
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Book a call" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("wears the accent look when asked to", () => {
    render(
      <ButtonLink href="/about" color="accent">
        About me
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "About me" });
    expect(buttonLinkClass("accent")).not.toBe(buttonLinkClass());
    for (const name of buttonLinkClass("accent").split(" ")) {
      expect(link.classList.contains(name)).toBe(true);
    }
  });
});
