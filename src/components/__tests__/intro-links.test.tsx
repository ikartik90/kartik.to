// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The icon row is WebGL and has its own file; here it only has to be findable.
vi.mock("../social-links", () => ({ SocialLinks: () => <ul /> }));

import { IntroLinks } from "../intro-links";

describe("IntroLinks", () => {
  afterEach(() => cleanup());

  it("links to the about page", () => {
    render(<IntroLinks aboutPublished />);

    const about = screen.getByRole("link", { name: "About me" });
    expect(about.getAttribute("href")).toBe("/about");
  });

  it("puts the about link above the social icons", () => {
    render(<IntroLinks aboutPublished />);

    const about = screen.getByRole("link", { name: "About me" });
    const social = screen.getByRole("navigation", { name: "Social links" });
    expect(
      about.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // Until the About page is published it is a 404, and a button to a 404 is
  // worse than no button.
  it("hides the about link until the about page is published", () => {
    render(<IntroLinks aboutPublished={false} />);

    expect(screen.queryByRole("link", { name: "About me" })).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Social links" }),
    ).toBeDefined();
  });

  // The icon row's extra top margin stands it off the BUTTON. With no button
  // above it the row falls back to the article's own gap under the intro.
  it("stands the icons off the button only while the button is there", () => {
    const { rerender } = render(<IntroLinks aboutPublished />);
    const withButton = screen
      .getByRole("navigation", { name: "Social links" })
      .getAttribute("data-below-button");

    rerender(<IntroLinks aboutPublished={false} />);
    const withoutButton = screen
      .getByRole("navigation", { name: "Social links" })
      .getAttribute("data-below-button");

    expect(withButton).toBe("");
    expect(withoutButton).toBeNull();
  });
});
